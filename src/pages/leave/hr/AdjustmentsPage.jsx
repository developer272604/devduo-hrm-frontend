import { useState } from 'react';
import { Layers, Plus } from 'lucide-react';
import { Button, Select, useToast } from '../../../components/ui';
import ResponsiveList from '../../../components/ResponsiveList';
import { FormDialog } from '../../../components/timeoffice/CrudPanel';
import { ReasonDialog } from '../../../components/timeoffice/dialogs';
import { Banner, Screen, StatusBadge, guarded } from '../../../components/timeoffice/parts';
import { ConfirmPreview, ListCard, Tiles } from '../../../components/leave/hr/kit';
import { useAuth } from '../../../lib/auth';
import { dateOnly, newKey, options, paths, query, send, splitIds, titleCase, today, typeOptions, unwrap, units, useList } from '../../../lib/leaveHrApi';

const KINDS = [
  { value: 'adjustment', label: 'Adjustment (correction, positive or negative)' },
  { value: 'grant', label: 'Grant (extra credit)' },
  { value: 'debit', label: 'Debit (deduct)' },
];
const who = (e) => e?.name ?? e?.employee_number ?? (typeof e === 'string' ? e : '—');
const nameOf = (a) => who(a.employee);

function BulkRows({ rows }) {
  return (
    <div className="max-h-64 overflow-y-auto">
      <ResponsiveList
        label="Bulk adjustment preview"
        rows={rows}
        rowKey={(r) => r.employee?.uuid ?? r.employee_uuid ?? JSON.stringify(r)}
        columns={[
          { key: 'employee', label: 'Employee', render: (r) => who(r.employee ?? r.employee_name ?? r.employee_number) },
          { key: 'current_available', label: 'Now', render: (r) => units(r.current_available) },
          { key: 'delta', label: 'Change', render: (r) => units(r.delta) },
          { key: 'projected_available', label: 'After', render: (r) => units(r.projected_available) },
          { key: 'will_apply', label: 'Result', render: (r) => (r.will_apply ? 'Will apply' : 'Skipped') },
          { key: 'issues', label: 'Issues', priority: 'md', render: (r) => (r.issues ?? []).map((x) => (typeof x === 'string' ? x : (x.message ?? x.code))).join('; ') || '—' },
        ]}
        mobile={{ title: (r) => who(r.employee ?? r.employee_name), subtitle: (r) => (r.will_apply ? 'Will apply' : 'Skipped'), facts: [{ label: 'Now', value: (r) => units(r.current_available) }, { label: 'After', value: (r) => units(r.projected_available) }] }}
        empty={{ title: 'No rows', description: 'Add employees to preview.' }}
      />
    </div>
  );
}

function AdjustmentsPageInner() {
  const { can } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const list = useList(`${paths.adjustments}?${query({ status })}`);
  const types = useList(`${paths.types}?active_only=1`);
  const canMake = can('leave.adjust|leave.manage');
  const canApprove = can('leave.adjust.approve|leave.manage');
  const [single, setSingle] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [bulkReq, setBulkReq] = useState(null);
  const [decide, setDecide] = useState(null); // {row, kind, batch?}
  const done = (msg) => {
    toast(msg);
    list.reload();
  };
  const fields = (withEmployees) => [
    withEmployees
      ? { name: 'employees', label: 'Employee IDs', type: 'textarea', required: true, hint: 'Employee uuids separated by commas, spaces or new lines (up to 500).' }
      : { name: 'employee', label: 'Employee ID (uuid)', required: true },
    { name: 'leave_type', label: 'Leave type', type: 'select', required: true, options: typeOptions(types.rows, 'Choose…') },
    { name: 'kind', label: 'Kind', type: 'select', required: true, default: 'adjustment', options: KINDS },
    { name: 'units', label: 'Units', required: true, hint: 'Up to 4 decimals. For a correction, a negative number removes balance.' },
    { name: 'effective_date', label: 'Effective date', type: 'date', default: today() },
    { name: 'expires_on', label: 'Expires on (optional)', type: 'date' },
    { name: 'reason', label: 'Reason', type: 'textarea', required: true, hint: 'Recorded in the audit trail.' },
  ];
  const clean = (b) => Object.fromEntries(Object.entries(b).filter(([, v]) => v !== null));
  const columns = [
    { key: 'employee', label: 'Employee', render: nameOf },
    { key: 'leave_type', label: 'Type', render: (a) => a.leave_type?.code ?? a.leave_type?.name ?? '—' },
    { key: 'kind', label: 'Kind', priority: 'md', render: (a) => titleCase(a.kind) },
    { key: 'units', label: 'Units', render: (a) => units(a.units) },
    { key: 'status', label: 'Status', render: (a) => <StatusBadge status={a.status} /> },
    { key: 'requested_by', label: 'Requested by', priority: 'lg', render: (a) => who(a.requested_by) },
    { key: 'reason', label: 'Reason', priority: 'lg' },
    { key: 'effective_date', label: 'Effective', priority: 'lg', render: (a) => dateOnly(a.effective_date) },
    {
      key: 'actions',
      label: 'Actions',
      render: (a) =>
        a.status === 'pending' && canApprove ? (
          <span className="flex flex-wrap gap-1.5">
            <Button variant="secondary" aria-label={`Approve adjustment for ${nameOf(a)}`} onClick={() => setDecide({ row: a, kind: 'approve' })}>Approve</Button>
            <Button variant="secondary" aria-label={`Reject adjustment for ${nameOf(a)}`} onClick={() => setDecide({ row: a, kind: 'reject' })}>Reject</Button>
            {a.bulk_key && <Button variant="ghost" onClick={() => setDecide({ row: a, kind: 'approve', batch: true })}>Approve batch</Button>}
          </span>
        ) : null,
    },
  ];
  const kind = decide?.kind;
  return (
    <Screen
      title="Leave adjustments"
      description="Manual grants, debits and corrections. Every change is reviewed by a second person before it touches a balance."
      permission="leave.adjust|leave.adjust.approve|leave.manage"
      action={
        canMake && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setBulk(true)}><Layers size={14} /> Bulk adjustment</Button>
            <Button onClick={() => setSingle(true)}><Plus size={14} /> New adjustment</Button>
          </div>
        )
      }
    >
      <Banner tone="info" title="Maker-checker">
        A request stays pending and changes no balance until a different person with approval rights accepts it. You cannot approve what you requested.
      </Banner>
      <ListCard
        title="Adjustments"
        list={list}
        columns={columns}
        extra={
          <div className="px-6 pb-3">
            <Select label="Status" value={status} options={options(['pending', 'approved', 'rejected'], 'All')} onChange={(e) => setStatus(e.target.value)} />
          </div>
        }
        mobile={{ title: nameOf, subtitle: (a) => `${titleCase(a.kind)} · ${units(a.units)} ${a.leave_type?.code ?? ''}`, badge: (a) => <StatusBadge status={a.status} />, facts: [{ label: 'Reason', value: 'reason' }] }}
        empty={{ title: 'No adjustments', description: status === 'pending' ? 'Nothing is waiting for approval.' : 'No adjustments match this filter.' }}
      />

      <FormDialog
        open={single}
        onClose={() => setSingle(false)}
        title="New adjustment"
        fields={fields(false)}
        submitLabel="Submit for approval"
        notice={<Banner tone="info">This creates a pending request. The balance changes only after approval.</Banner>}
        onSubmit={async (b) => {
          await send('POST', paths.adjustments, clean(b));
          done('Adjustment submitted for approval');
        }}
      />
      <FormDialog
        open={bulk}
        onClose={() => setBulk(false)}
        title="Bulk adjustment"
        fields={fields(true)}
        submitLabel="Preview impact"
        onSubmit={async (b) => setBulkReq({ ...clean(b), employees: splitIds(b.employees) })}
      />
      <ConfirmPreview
        open={Boolean(bulkReq)}
        onClose={() => setBulkReq(null)}
        title="Confirm bulk adjustment"
        intro="One pending adjustment is created per employee that will apply. Nothing changes a balance until the batch is approved."
        load={async () => unwrap(await send('POST', paths.adjustmentsBulkPreview, bulkReq))}
        blocked={(d) => ((d.rows ?? []).some((r) => r.will_apply) ? null : 'No employee in this list would receive the adjustment.')}
        confirmLabel="Create pending batch"
        onConfirm={async () => {
          const r = await send('POST', paths.adjustmentsBulk, { ...bulkReq, idempotency_key: newKey() });
          done(r?.duplicate ? 'This batch was already submitted' : 'Batch submitted for approval');
        }}
      >
        {(d) => (
          <>
            <Tiles items={Object.entries(d.summary ?? {}).filter(([, v]) => typeof v !== 'object').map(([k, v]) => ({ label: titleCase(k), value: String(v) }))} />
            <BulkRows rows={d.rows ?? []} />
          </>
        )}
      </ConfirmPreview>

      <ReasonDialog
        open={Boolean(decide)}
        onClose={() => setDecide(null)}
        title={decide?.batch ? 'Approve the whole batch' : kind === 'approve' ? 'Approve adjustment' : 'Reject adjustment'}
        intro={decide && `${nameOf(decide.row)}: ${titleCase(decide.row.kind)} ${units(decide.row.units)} ${decide.row.leave_type?.code ?? ''}`}
        notice={kind === 'approve' ? 'Approving posts the change to the ledger. The approver must differ from the requester.' : undefined}
        label={kind === 'approve' ? 'Note (optional)' : 'Why is this rejected?'}
        required={kind !== 'approve'}
        confirmLabel={kind === 'approve' ? 'Approve' : 'Reject'}
        danger={kind === 'reject'}
        onConfirm={async (note) => {
          const body = note ? { note } : {};
          if (decide.batch) await send('POST', paths.adjustmentsBulkDecide(decide.row.bulk_key, kind), body);
          else await send('POST', paths.adjustment(decide.row.uuid, kind), body);
          done(kind === 'approve' ? 'Adjustment approved and posted' : 'Adjustment rejected');
        }}
      />
    </Screen>
  );
}

export default guarded(AdjustmentsPageInner, { title: 'Leave adjustments', permission: 'leave.adjust|leave.adjust.approve|leave.manage' });
