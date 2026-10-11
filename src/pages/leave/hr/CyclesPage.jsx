import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Badge, Button, ErrorState, Modal, Skeleton, useToast } from '../../../components/ui';
import CrudPanel, { FormDialog } from '../../../components/timeoffice/CrudPanel';
import ResponsiveList from '../../../components/ResponsiveList';
import { Banner, Screen, guarded } from '../../../components/timeoffice/parts';
import { useAuth } from '../../../lib/auth';
import { addDays, options, paths, send, titleCase, today, useList } from '../../../lib/leaveHrApi';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(2000, i, 1).toLocaleString('en', { month: 'long' }) }));
const fields = [
  { name: 'name', label: 'Name', required: true },
  { name: 'code', label: 'Code', required: true, hint: 'Cannot be changed after creation.' },
  { name: 'kind', label: 'Kind', type: 'select', required: true, default: 'calendar', options: options(['calendar', 'fiscal', 'anniversary', 'custom']) },
  { name: 'start_month', label: 'Starts in', type: 'select', default: '1', options: MONTHS, showIf: (v) => ['fiscal', 'custom'].includes(v.kind) },
  { name: 'start_day', label: 'Start day', type: 'number', default: 1, min: 1, max: 31, showIf: (v) => ['fiscal', 'custom'].includes(v.kind) },
  { name: 'length_months', label: 'Length (months)', type: 'number', default: 12, min: 1, max: 60, showIf: (v) => v.kind === 'custom' },
  { name: 'active', label: 'Active', type: 'checkbox', default: true },
];
const toPayload = (b, editing) => {
  const out = Object.fromEntries(Object.entries(b).filter(([, v]) => v !== null));
  if (out.start_month) out.start_month = Number(out.start_month);
  if (editing) delete out.code;
  return out;
};

function Periods({ cycle, onClose }) {
  const { can } = useAuth();
  const toast = useToast();
  const list = useList(paths.cyclePeriods(cycle.uuid));
  const [gen, setGen] = useState(false);
  const anniversary = cycle.kind === 'anniversary';
  return (
    <Modal open onClose={onClose} title={`Periods: ${cycle.name}`}>
      {anniversary && <Banner tone="info" title="Per employee">Anniversary periods are not pre-generated; they follow each employee's joining date.</Banner>}
      {list.loading ? (
        <Skeleton rows={2} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : (
        <ResponsiveList
          label="Periods"
          rows={list.rows}
          rowKey={(p) => p.uuid ?? p.id ?? p.start_date ?? p.starts_on}
          columns={[{ key: 'label', label: 'Period', render: (p) => p.label ?? p.name ?? '—' }, { key: 'start', label: 'Starts', render: (p) => p.start_date ?? p.starts_on ?? p.period_start }, { key: 'end', label: 'Ends', render: (p) => p.end_date ?? p.ends_on ?? p.period_end }]}
          mobile={{ title: (p) => p.label ?? p.name ?? 'Period', subtitle: (p) => `${p.start_date ?? p.starts_on ?? p.period_start} to ${p.end_date ?? p.ends_on ?? p.period_end}` }}
          empty={{ title: 'No periods generated', description: anniversary ? 'Not needed for anniversary cycles.' : 'Generate periods for the years you need.' }}
        />
      )}
      {can('leave.policy.manage|leave.manage') && !anniversary && (
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setGen(true)}>Generate periods</Button>
        </div>
      )}
      <FormDialog
        open={gen}
        onClose={() => setGen(false)}
        title="Generate periods"
        fields={[
          { name: 'from', label: 'From', type: 'date', required: true, default: today() },
          { name: 'to', label: 'To', type: 'date', required: true, default: addDays(today(), 365 * 2) },
        ]}
        notice={<Banner tone="info">Safe to repeat: existing periods are never changed. Once periods exist the cycle shape is frozen.</Banner>}
        submitLabel="Generate"
        onSubmit={async (b) => {
          const r = await send('POST', paths.cyclePeriodsGenerate(cycle.uuid), b);
          const d = r?.data ?? r;
          toast(`${d?.created ?? 0} created, ${d?.existing ?? 0} already existed`);
          list.reload();
        }}
      />
    </Modal>
  );
}

function CyclesPageInner() {
  const { can } = useAuth();
  const manage = can('leave.policy.manage|leave.manage');
  const [periods, setPeriods] = useState(null);
  const columns = [
    { key: 'name', label: 'Cycle', render: (c) => <strong>{c.name}</strong> },
    { key: 'code', label: 'Code' },
    { key: 'kind', label: 'Kind', render: (c) => titleCase(c.kind) },
    { key: 'start', label: 'Starts', priority: 'md', render: (c) => (['fiscal', 'custom'].includes(c.kind) ? `${c.start_month}/${c.start_day}` : c.kind === 'calendar' ? '1 Jan' : 'Joining date') },
    { key: 'length_months', label: 'Months', priority: 'lg' },
    { key: 'locked', label: 'Shape', priority: 'md', render: (c) => (c.locked ? <span className="inline-flex items-center gap-1"><Lock size={12} /> Locked</span> : 'Editable') },
    { key: 'active', label: 'State', render: (c) => <Badge tone={c.active ? 'green' : 'neutral'}>{c.active ? 'Active' : 'Inactive'}</Badge> },
  ];
  return (
    <Screen title="Leave cycles" description="The yearly (or custom) window that entitlements, balances and carry-forward are measured in." permission="leave.policy.manage|leave.manage">
      <CrudPanel
        noun="cycle"
        listPath={paths.cycles}
        itemPath={(c) => `${paths.cycles}/${c.uuid}`}
        fields={fields}
        columns={columns}
        canEdit={manage}
        toPayload={toPayload}
        fromRow={(c) => ({ ...c, start_month: String(c.start_month ?? 1) })}
        mobile={{ title: 'name', subtitle: (c) => `${c.code} · ${titleCase(c.kind)}`, badge: (c) => <Badge tone={c.active ? 'green' : 'neutral'}>{c.active ? 'Active' : 'Inactive'}</Badge> }}
        empty={{ title: 'No cycles yet', description: manage ? 'Create a calendar or fiscal cycle for your policies to reference.' : 'Nothing has been set up yet.' }}
        rowActions={(c) => <Button variant="secondary" aria-label={`Periods for ${c.name}`} onClick={() => setPeriods(c)}>Periods</Button>}
      />
      {periods && <Periods cycle={periods} onClose={() => setPeriods(null)} />}
    </Screen>
  );
}

export default guarded(CyclesPageInner, { title: 'Leave cycles', permission: 'leave.policy.manage|leave.manage' });
