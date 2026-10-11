import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, ErrorState, Skeleton, Tabs, useToast } from '../../components/ui';
import ResponsiveList from '../../components/ResponsiveList';
import { Banner, PartialFailure, Screen, StatusBadge, guarded } from '../../components/timeoffice/parts';
import { PreviewConfirm, ReasonDialog } from '../../components/timeoffice/dialogs';
import { useResource } from '../../lib/hooks';
import { A, listOf, paths, send, titleCase } from '../../lib/timeOfficeApi';

const KINDS = [
  { value: 'regularization', label: 'Regularization', path: 'regularizations' },
  { value: 'overtime', label: 'Overtime', path: 'overtime' },
  { value: 'on_duty', label: 'On-duty', path: 'on-duty' },
  { value: 'shift_swap', label: 'Shift swap', path: 'shift-swaps' },
  { value: 'adjustment', label: 'Adjustment', path: 'adjustments' },
];
const MAKER_CHECKER = {
  adjustment: 'Adjustments follow maker-checker: you cannot approve an adjustment you made yourself.',
  shift_swap: 'Shift swaps are decided by the scheduling approver chain and take effect on the published roster.',
};
const when = (r) => String(r.date ?? r.attendance_date ?? r.work_date ?? r.start_date ?? '').slice(0, 10);
const who = (r) => r.employee?.name ?? r.employee?.display_name ?? r.employee_name ?? '—';
const detail = (r) => r.reason ?? r.note ?? titleCase(r.type) ?? '';

function ApprovalsPage() {
  const [params, setParams] = useSearchParams();
  const kind = KINDS.some((k) => k.value === params.get('kind')) ? params.get('kind') : 'regularization';
  const meta = KINDS.find((k) => k.value === kind);
  const toast = useToast();
  const resource = useResource(`${paths.approvals}?kind=${kind}&status=pending`);
  const [selected, setSelected] = useState(new Set());
  const [decision, setDecision] = useState(null); // {rows, action}
  const [bulk, setBulk] = useState(null); // 'approve' | 'reject'
  const [outcome, setOutcome] = useState(null);
  const rows = resource.data ? listOf(resource.data) : [];
  /** Shift swaps decide through `/shift-swaps/{uuid}/decision {approve, comment}`; the other kinds have approve and reject routes. */
  const decide = (row, action, comment) =>
    kind === 'shift_swap'
      ? send('POST', `${paths.shiftSwaps}/${row.uuid}/decision`, { approve: action === 'approve', comment })
      : send('POST', `${A}/${meta.path}/${row.uuid}/${action}`, { comment });
  const picked = rows.filter((r) => selected.has(r.uuid));
  const decidable = picked.filter((r) => r.can_decide !== false);
  const toggle = (row) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(row.uuid) ? n.delete(row.uuid) : n.add(row.uuid);
      return n;
    });
  const columns = [
    { key: 'employee', label: 'Employee', render: who },
    { key: 'date', label: 'Date', render: when },
    { key: 'type', label: 'Type', priority: 'md', render: (r) => titleCase(r.type) },
    { key: 'reason', label: 'Reason', priority: 'md', render: detail },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      label: 'Decision',
      render: (r) => (
        <span className="flex gap-1.5">
          <Button variant="secondary" disabled={r.can_decide === false} title={r.can_decide === false ? 'You cannot decide this request' : undefined} onClick={() => setDecision({ rows: [r], action: 'approve' })}>
            Approve
          </Button>
          <Button variant="secondary" disabled={r.can_decide === false} onClick={() => setDecision({ rows: [r], action: 'reject' })}>
            Reject
          </Button>
        </span>
      ),
    },
  ];
  const mobile = { title: who, subtitle: (r) => `${when(r)} · ${titleCase(r.type)}`, badge: (r) => <StatusBadge status={r.status} />, facts: [{ label: 'Reason', value: detail }] };

  /** Sequential decisions so one failure never hides the others; the result feeds the partial-failure banner. */
  async function runMany(list, action, comment) {
    const failures = [];
    for (const row of list) {
      try {
        await decide(row, action, comment);
      } catch (e) {
        failures.push(`${who(row)} ${when(row)}: ${e.message}`);
      }
    }
    setOutcome({ failed: failures.length, total: list.length, items: failures });
    setSelected(new Set());
    resource.reload();
    if (!failures.length) toast(`${list.length} request${list.length === 1 ? '' : 's'} ${action === 'approve' ? 'approved' : 'rejected'}`);
  }

  return (
    <Screen title="Approvals" description="Requests waiting for your decision." permission="attendance.approve|attendance.overtime.approve|attendance.adjust.approve|attendance.manage">
      <Card>
        <Tabs items={KINDS} value={kind} onChange={(v) => { setParams({ kind: v }); setSelected(new Set()); setOutcome(null); }} />
        <div className="p-5 pb-0">
          {MAKER_CHECKER[kind] && <Banner tone="info">{MAKER_CHECKER[kind]}</Banner>}
          {outcome && <PartialFailure {...outcome} />}
          {selected.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs" role="region" aria-label="Bulk actions">
              <strong>{selected.size} selected</strong>
              <Button variant="secondary" onClick={() => setBulk('approve')}>Approve selected</Button>
              <Button variant="secondary" onClick={() => setBulk('reject')}>Reject selected</Button>
              <Button variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          )}
        </div>
        {resource.loading ? (
          <Skeleton />
        ) : resource.error ? (
          <ErrorState error={resource.error} onRetry={resource.reload} />
        ) : (
          <ResponsiveList
            label={`${meta.label} approvals`}
            columns={columns}
            rows={rows}
            mobile={mobile}
            selected={selected}
            onToggle={toggle}
            empty={{ title: 'All caught up', description: `No ${meta.label.toLowerCase()} requests are waiting for you.` }}
          />
        )}
      </Card>
      <ReasonDialog
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        title={decision?.action === 'approve' ? 'Approve request' : 'Reject request'}
        label={decision?.action === 'approve' ? 'Comment (optional)' : 'Why is this rejected? (shown to the employee)'}
        required={decision?.action === 'reject'}
        danger={decision?.action === 'reject'}
        notice={MAKER_CHECKER[kind]}
        confirmLabel={decision?.action === 'approve' ? 'Approve' : 'Reject'}
        onConfirm={async (comment) => {
          await decide(decision.rows[0], decision.action, comment);
          toast(decision.action === 'approve' ? 'Approved' : 'Rejected');
          resource.reload();
        }}
      />
      <PreviewConfirm
        open={Boolean(bulk)}
        onClose={() => setBulk(null)}
        title={bulk === 'approve' ? 'Approve selected requests' : 'Reject selected requests'}
        intro="Review what will happen. Requests you cannot decide are skipped."
        load={async () => ({
          selected: picked.length,
          will_be_decided: decidable.length,
          skipped_not_permitted: picked.length - decidable.length,
          requests: decidable.map((r) => `${who(r)} · ${when(r)} · ${titleCase(r.type)}`),
          blocked: decidable.length === 0,
        })}
        withReason
        danger={bulk === 'reject'}
        confirmLabel={bulk === 'approve' ? 'Approve all' : 'Reject all'}
        onConfirm={(_, reason) => runMany(decidable, bulk, reason)}
      />
    </Screen>
  );
}

export default guarded(ApprovalsPage, { title: 'Approvals', permission: 'attendance.approve|attendance.overtime.approve|attendance.adjust.approve|attendance.manage' });
