import { useState } from 'react';
import { api } from '../../../lib/api';
import { useResource } from '../../../lib/hooks';
import { describeError, fmtDate, fmtRange, fmtUnits, leavePaths, listOf, personName, typeName } from '../../../lib/leaveApi';
import ResponsiveList from '../../../components/ResponsiveList';
import { Badge, Button, Card, FormError, Modal, PageHeader, Resource, Tabs, Textarea, useToast } from '../../../components/ui';
import RequestDetail from '../../../components/leave/shared/RequestDetail';
import { ConflictList } from '../../../components/leave/shared/LeaveBadge';

const TABS = [
  { value: 'leave', label: 'Leave requests' },
  { value: 'compoff', label: 'Comp-off' },
];

function LeaveQueue() {
  const resource = useResource(leavePaths.approvals);
  const [open, setOpen] = useState(null);
  const columns = [
    { key: 'employee', label: 'Employee', render: (r) => personName(r.employee) },
    { key: 'type', label: 'Type', render: (r) => typeName(r.type) },
    { key: 'dates', label: 'Dates', render: (r) => fmtRange(r) },
    { key: 'units', label: 'Charged', priority: 'md', render: (r) => fmtUnits(r.charged_units, r.unit) },
    {
      key: 'flags',
      label: 'Needs a look',
      priority: 'lg',
      render: (r) =>
        (r.conflicts || []).length || (r.warnings || []).length ? (
          <Badge tone="amber">{(r.conflicts || []).length + (r.warnings || []).length} flag(s)</Badge>
        ) : (
          '-'
        ),
    },
    { key: 'review', label: '', render: (r) => <Button variant="secondary" onClick={() => setOpen(r.uuid)}>Review</Button> },
  ];
  return (
    <>
      <Resource resource={resource}>
        {(res) => (
          <ResponsiveList
            label="Leave approvals"
            rows={listOf(res)}
            onRowClick={(r) => setOpen(r.uuid)}
            empty={{ title: 'Nothing waiting for you', description: 'Requests you can decide will appear here.' }}
            columns={columns}
            card={(r) => (
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <strong className="truncate text-sm">{personName(r.employee)}</strong>
                  <span className="text-xs text-slate-600 dark:text-slate-300">{fmtUnits(r.charged_units, r.unit)}</span>
                </div>
                <p className="m-0 text-xs text-slate-600 dark:text-slate-300">
                  {typeName(r.type)} · {fmtRange(r)}
                </p>
                {(r.conflicts || []).length > 0 && <ConflictList conflicts={r.conflicts.slice(0, 2)} />}
              </div>
            )}
          />
        )}
      </Resource>
      <Modal open={!!open} onClose={() => setOpen(null)} title="Review leave request">
        {open && (
          <RequestDetail
            uuid={open}
            perspective="manager"
            onChanged={() => {
              resource.reload();
            }}
          />
        )}
      </Modal>
    </>
  );
}

function CompOffDecision({ credit, kind, onClose, onDone }) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(leavePaths.compOffAction(credit.uuid, kind), { method: 'POST', body: comment.trim() ? { comment: comment.trim() } : {} });
      toast(kind === 'approve' ? 'Comp-off approved. The credit was added to the balance.' : 'Comp-off rejected.');
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={kind === 'approve' ? 'Approve comp-off' : 'Reject comp-off'}>
      <form onSubmit={submit} noValidate>
        <p className="m-0 mb-4 text-xs text-slate-600 dark:text-slate-300">
          {personName(credit.employee)} · {fmtUnits(credit.units)} for work on {fmtDate(credit.work_date)}
        </p>
        <FormError error={error && { message: describeError(error) }} />
        <Textarea label="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={kind === 'approve' ? 'primary' : 'danger'} loading={busy}>
            {kind === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CompOffQueue() {
  const resource = useResource(`${leavePaths.compOff}?scope=team&status=pending`);
  const [decision, setDecision] = useState(null);
  const actions = (c) => (
    <span className="flex gap-2">
      <Button onClick={() => setDecision({ credit: c, kind: 'approve' })}>Approve</Button>
      <Button variant="secondary" onClick={() => setDecision({ credit: c, kind: 'reject' })}>
        Reject
      </Button>
    </span>
  );
  return (
    <>
      <Resource resource={resource}>
        {(res) => (
          <ResponsiveList
            label="Comp-off approvals"
            rows={listOf(res)}
            empty={{ title: 'No comp-off waiting', description: 'Comp-off requests from your team will appear here.' }}
            columns={[
              { key: 'employee', label: 'Employee', render: (c) => personName(c.employee) },
              { key: 'work_date', label: 'Worked on', render: (c) => fmtDate(c.work_date) },
              { key: 'units', label: 'Units', render: (c) => fmtUnits(c.units) },
              { key: 'actions', label: '', render: actions },
            ]}
            card={(c) => (
              <div className="space-y-1">
                <strong className="text-sm">{personName(c.employee)}</strong>
                <p className="m-0 text-xs text-slate-600 dark:text-slate-300">
                  {fmtUnits(c.units)} · worked {fmtDate(c.work_date)}
                </p>
                <div className="mt-2">{actions(c)}</div>
              </div>
            )}
          />
        )}
      </Resource>
      {decision && (
        <CompOffDecision
          {...decision}
          onClose={() => setDecision(null)}
          onDone={() => {
            setDecision(null);
            resource.reload();
          }}
        />
      )}
    </>
  );
}

/** Manager inbox. Requests open with conflicts, balance impact, history and the employee's time story before deciding. */
export default function Approvals() {
  const [tab, setTab] = useState('leave');
  return (
    <>
      <PageHeader title="Leave approvals" description="Review the impact, then approve or reject with a comment." />
      <Card>
        <Tabs items={TABS} value={tab} onChange={setTab} />
        <div role="tabpanel" aria-label={TABS.find((t) => t.value === tab).label} className="p-2 sm:p-4">
          {tab === 'leave' ? <LeaveQueue /> : <CompOffQueue />}
        </div>
      </Card>
    </>
  );
}
