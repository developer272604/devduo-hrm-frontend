import { useState } from 'react';
import { Button, Drawer, Select } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { FormModal, KeyValues, ListCard, Page, StatusBadge, optionsOf, withEmpty } from '../../components/payroll/kit';
import { paths, query, send, titleCase, today, useList, useLookup } from '../../lib/payrollApi';

const SETUP = 'payroll.configure|payroll.compensation.manage|payroll.view';
const FREQ = ['weekly', 'biweekly', 'semi_monthly', 'monthly', 'four_weekly', 'custom'].map((f) => ({ value: f, label: titleCase(f) }));

function GroupDrawer({ group, onClose, canEdit }) {
  const calendars = useList(group ? paths.group(group.uuid, 'calendars') : '/v1/payroll/groups/none/calendars');
  const [calOpen, setCalOpen] = useState(false);
  const [gen, setGen] = useState(null);
  return (
    <Drawer open={Boolean(group)} onClose={onClose} title={group?.name ?? 'Pay group'}>
      {group && (
        <div className="space-y-4">
          <KeyValues data={{ code: group.code, country: group.country, currency: group.currency, frequency: group.frequency, timezone: group.timezone, cutoff_day: group.cutoff_day, active: group.active }} />
          <ListCard
            title="Calendars"
            list={calendars}
            action={canEdit && <Button variant="secondary" onClick={() => setCalOpen(true)}>Add calendar</Button>}
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'frequency', label: 'Frequency', render: (r) => titleCase(r.frequency) },
              { key: 'effective_from', label: 'From' },
              { key: 'act', label: '', render: (r) => canEdit && <Button variant="secondary" onClick={() => setGen(r)}>Generate periods</Button> },
            ]}
            card={(r) => (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <strong className="text-sm">{r.name}</strong>
                  <p className="m-0 text-xs text-slate-500">
                    {titleCase(r.frequency)} from {r.effective_from}
                  </p>
                </div>
                {canEdit && <Button variant="secondary" onClick={() => setGen(r)}>Generate</Button>}
              </div>
            )}
            empty={{ title: 'No calendars', description: 'Add a calendar, then generate its periods.' }}
          />
          <FormModal
            open={calOpen}
            onClose={() => setCalOpen(false)}
            title="Add pay calendar"
            intro={`Frequency follows the group: ${titleCase(group.frequency)}.`}
            fields={[
              { name: 'name', label: 'Name' },
              { name: 'effective_from', label: 'Effective from', type: 'date' },
              { name: 'anchor_date', label: 'Anchor date (weekly, biweekly, four-weekly)', type: 'date', required: false },
            ]}
            onSubmit={async (v) => {
              await send('POST', paths.group(group.uuid, 'calendars'), { name: v.name, frequency: group.frequency, effective_from: v.effective_from, ...(v.anchor_date ? { anchor_date: v.anchor_date } : {}) });
              calendars.reload();
            }}
            success="Calendar added"
          />
          <FormModal
            open={Boolean(gen)}
            onClose={() => setGen(null)}
            title={`Generate periods for ${gen?.name ?? ''}`}
            intro="Existing periods are skipped, so this is safe to repeat."
            initial={{ from: today(), to: today() }}
            fields={[
              { name: 'from', label: 'From', type: 'date' },
              { name: 'to', label: 'To', type: 'date' },
            ]}
            submitLabel="Generate"
            onSubmit={(v) => send('POST', paths.calendarGenerate(gen.uuid), v)}
            success="Periods generated"
          />
        </div>
      )}
    </Drawer>
  );
}

export function GroupsPage() {
  const { can } = useAuth();
  const list = useList(`${paths.groups}?per_page=100`);
  const entities = useLookup('/v1/organization/legal-entities');
  const [create, setCreate] = useState(false);
  const [open, setOpen] = useState(null);
  const canEdit = can('payroll.configure');
  return (
    <Page permission={SETUP} title="Pay groups" description="Who is paid together, in which currency and how often." action={can('payroll.configure') && <Button onClick={() => setCreate(true)}>New pay group</Button>}>
      <ListCard
        title="Groups"
        list={list}
        onRowClick={setOpen}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'code', label: 'Code' },
          { key: 'country', label: 'Country', priority: 'md' },
          { key: 'currency', label: 'Currency' },
          { key: 'frequency', label: 'Frequency', priority: 'md', render: (r) => titleCase(r.frequency) },
          { key: 'active', label: 'Status', render: (r) => <StatusBadge value={r.active ? 'active' : 'inactive'} /> },
        ]}
        mobile={{ title: 'name', subtitle: 'code', badge: (r) => <StatusBadge value={r.active ? 'active' : 'inactive'} />, facts: [{ label: 'Currency', value: 'currency' }, { label: 'Frequency', value: (r) => titleCase(r.frequency) }] }}
        empty={{ title: 'No pay groups', description: 'Create a pay group to define a payroll population.' }}
      />
      <FormModal
        open={create}
        onClose={() => setCreate(false)}
        title="New pay group"
        initial={{ currency: 'USD', frequency: 'monthly', timezone: 'UTC', country: '' }}
        fields={[
          { name: 'name', label: 'Group name' },
          { name: 'code', label: 'Code', hint: 'Uppercase letters, numbers and underscores.' },
          { name: 'legal_entity_id', label: 'Legal entity', options: entities.map((e) => ({ value: e.id, label: e.name })) },
          { name: 'country', label: 'Country code', hint: 'Two-letter code.' },
          { name: 'currency', label: 'Currency', hint: 'Three-letter code.' },
          { name: 'timezone', label: 'Timezone', hint: 'IANA name, for example Europe/London.' },
          { name: 'frequency', label: 'Pay frequency', options: FREQ },
        ]}
        onSubmit={async (v) => {
          await send('POST', paths.groups, v);
          list.reload();
        }}
        success="Pay group created"
      />
      <GroupDrawer group={open} onClose={() => setOpen(null)} canEdit={canEdit} />
    </Page>
  );
}

export function PeriodsPage() {
  const groups = useList(`${paths.groups}?per_page=100`);
  const [group, setGroup] = useState('');
  const [state, setState] = useState('');
  const list = useList(`${paths.periods}?${query({ group_uuid: group, state, per_page: 100 })}`);
  const [transition, setTransition] = useState(null);
  const [create, setCreate] = useState(false);
  return (
    <Page permission={SETUP} title="Payroll periods" description="Each period moves through legal states; reopening needs a reason." action={<Button onClick={() => setCreate(true)}>Add off-cycle period</Button>}>
      <div className="mb-4 grid max-w-2xl gap-x-4 sm:grid-cols-2">
        <Select label="Pay group" options={withEmpty(optionsOf(groups.rows), 'All groups')} value={group} onChange={(e) => setGroup(e.target.value)} />
        <Select label="State" options={withEmpty(['open', 'processing', 'validation', 'approval', 'approved', 'locked', 'reopened', 'closed'].map((s) => ({ value: s, label: titleCase(s) })), 'Any state')} value={state} onChange={(e) => setState(e.target.value)} />
      </div>
      <ListCard
        title="Periods"
        list={list}
        columns={[
          { key: 'label', label: 'Period' },
          { key: 'type', label: 'Type', priority: 'md', render: (r) => titleCase(r.period_type) },
          { key: 'dates', label: 'Dates', render: (r) => `${r.period_start} to ${r.period_end}` },
          { key: 'payment_date', label: 'Payment date', priority: 'lg' },
          { key: 'state', label: 'State', render: (r) => <StatusBadge value={r.state} /> },
          {
            key: 'next',
            label: 'Move to',
            render: (r) => (
              <span className="flex flex-wrap gap-1">
                {(r.allowed_next ?? []).map((n) => (
                  <Button key={n} variant="secondary" className="min-h-8! px-2! py-1!" onClick={() => setTransition({ period: r, to: n })}>
                    {titleCase(n)}
                  </Button>
                ))}
              </span>
            ),
          },
        ]}
        card={(r) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <strong className="text-sm">{r.label}</strong>
              <StatusBadge value={r.state} />
            </div>
            <p className="m-0 text-xs text-slate-500">
              {r.period_start} to {r.period_end} · {titleCase(r.period_type)}
            </p>
            <span className="mt-2 flex flex-wrap gap-1">
              {(r.allowed_next ?? []).map((n) => (
                <Button key={n} variant="secondary" className="min-h-8! px-2! py-1!" onClick={() => setTransition({ period: r, to: n })}>
                  {titleCase(n)}
                </Button>
              ))}
            </span>
          </div>
        )}
        empty={{ title: 'No periods', description: 'Generate periods from a pay group calendar.' }}
      />
      <TransitionDialog t={transition} onClose={() => setTransition(null)} onDone={list.reload} />
      <FormModal
        open={create}
        onClose={() => setCreate(false)}
        title="Add off-cycle period"
        initial={{ period_type: 'off_cycle', group: group }}
        fields={[
          { name: 'group', label: 'Pay group', options: optionsOf(groups.rows) },
          { name: 'period_type', label: 'Type', options: ['off_cycle', 'bonus', 'correction'].map((s) => ({ value: s, label: titleCase(s) })) },
          { name: 'label', label: 'Label' },
          { name: 'period_start', label: 'Start', type: 'date' },
          { name: 'period_end', label: 'End', type: 'date' },
          { name: 'payment_date', label: 'Payment date', type: 'date', required: false },
        ]}
        onSubmit={async (v) => {
          const { group: g, ...body } = v;
          await send('POST', paths.group(g, 'periods'), Object.fromEntries(Object.entries(body).filter(([, x]) => x !== '')));
          list.reload();
        }}
        success="Period added"
      />
    </Page>
  );
}

function TransitionDialog({ t, onClose, onDone }) {
  const reopen = t?.to === 'reopened';
  return (
    <FormModal
      open={Boolean(t)}
      onClose={onClose}
      title={t ? `Move ${t.period.label} to ${titleCase(t.to)}` : ''}
      intro="Only legal moves are offered. This is recorded in the period history."
      fields={[{ name: 'reason', label: reopen ? 'Reason (required)' : 'Reason (optional)', textarea: true, required: reopen }]}
      submitLabel="Move period"
      onSubmit={async (v) => {
        await send('POST', paths.period(t.period.uuid, 'transition'), { to: t.to, ...(v.reason ? { reason: v.reason } : {}) });
        onDone();
      }}
      success="Period updated"
    />
  );
}
