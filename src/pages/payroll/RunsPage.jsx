import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Select, useToast } from '../../components/ui';
import { ConfirmPreview, FormModal, ListCard, Page, StatusBadge, Tiles, optionsOf, withEmpty } from '../../components/payroll/kit';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { idem, newKey, paths, query, send, titleCase, unwrap, useList } from '../../lib/payrollApi';

export const periodOf = (r) => (r?.period && typeof r.period === 'object' ? (r.period.label ?? `${r.period.start} to ${r.period.end}`) : (r?.period_label ?? r?.period ?? '—'));
const STATUSES = ['draft', 'inputs', 'calculating', 'review', 'approval', 'approved', 'locked', 'outputs', 'payment', 'closed', 'reopened', 'cancelled'];

export default function RunsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [status, setStatus] = useState('');
  const list = useList(`${paths.runs}?${query({ status, per_page: 50 })}`);
  const periods = useList(`${paths.periods}?per_page=100`);
  const [form, setForm] = useState(false);
  const [draft, setDraft] = useState(null);
  return (
    <Page permission="payroll.view|payroll.run" title="Payroll runs" description="Create, calculate, approve and lock a run for a pay period." action={can('payroll.run') && <Button onClick={() => setForm(true)}>New run</Button>}>
      <div className="mb-4 max-w-xs">
        <Select label="Status" options={withEmpty(STATUSES.map((s) => ({ value: s, label: titleCase(s) })), 'Any status')} value={status} onChange={(e) => setStatus(e.target.value)} />
      </div>
      <ListCard
        title="Runs"
        list={list}
        onRowClick={(r) => nav(`/payroll/runs/${r.uuid}`)}
        columns={[
          { key: 'period', label: 'Period', render: periodOf },
          { key: 'group', label: 'Group', priority: 'md', render: (r) => r.group_name ?? r.group?.name ?? '—' },
          { key: 'run_type', label: 'Type', priority: 'md', render: (r) => titleCase(r.run_type) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          { key: 'employee_count', label: 'Employees', priority: 'lg', render: (r) => r.employee_count ?? r.employees ?? '—' },
        ]}
        mobile={{ title: periodOf, subtitle: (r) => titleCase(r.run_type), badge: (r) => <StatusBadge value={r.status} />, facts: [{ label: 'Group', value: (r) => r.group_name ?? r.group?.name }, { label: 'Employees', value: (r) => r.employee_count ?? r.employees }] }}
        empty={{ title: 'No payroll runs', description: 'Create a run for an open period to begin.' }}
      />
      <FormModal
        open={form}
        onClose={() => setForm(false)}
        title="New payroll run"
        intro="You will see who would be included before anything is created."
        initial={{ run_type: 'regular' }}
        submitLabel="Preview"
        fields={[
          { name: 'period_uuid', label: 'Period', options: optionsOf(periods.rows, (p) => `${p.label} (${titleCase(p.state)})`) },
          { name: 'run_type', label: 'Run type', options: ['regular', 'off_cycle', 'correction'].map((t) => ({ value: t, label: titleCase(t) })) },
          { name: 'notes', label: 'Notes', textarea: true, required: false },
        ]}
        onSubmit={async (v) => setDraft({ ...v, key: newKey() })}
      />
      <ConfirmPreview
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title="Create payroll run"
        load={() => send('POST', paths.runPreview, { period_uuid: draft.period_uuid, run_type: draft.run_type })}
        confirmLabel="Create run"
        onConfirm={async () => {
          const body = { period_uuid: draft.period_uuid, run_type: draft.run_type, ...(draft.notes ? { notes: draft.notes } : {}) };
          const r = unwrap(await api(paths.runs, { method: 'POST', body, headers: idem(draft.key) }));
          toast('Payroll run created');
          nav(`/payroll/runs/${r.uuid}`);
        }}
      >
        {(p) => (
          <Tiles
            items={[
              { label: 'Employees', value: p.employees },
              { label: 'Joiners', value: p.joiners },
              { label: 'Leavers', value: p.leavers },
              { label: 'Transfers', value: p.transfers },
              { label: 'Out of scope', value: p.out_of_scope },
              { label: 'Skipped', value: p.skipped, tone: p.skipped > 0 ? 'warn' : undefined },
            ]}
          />
        )}
      </ConfirmPreview>
    </Page>
  );
}
