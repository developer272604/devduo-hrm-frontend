import { useState } from 'react';
import { useResource } from '../../lib/hooks';
import { query } from '../../lib/api';
import { decide, fmtMinutes, fmtTime } from '../../lib/attendanceApi';
import { useAuth } from '../../lib/auth';
import ResponsiveList from '../../components/ResponsiveList';
import StatusBadge from '../../components/attendance/StatusBadge';
import TeamScheduleSection from '../../components/attendance/TeamScheduleSection';
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Resource,
  Tabs,
  Textarea,
  useToast,
} from '../../components/ui';

const ORDER = ['in', 'not_in_yet', 'absent', 'late', 'remote_or_on_duty', 'missing_punches', 'on_leave', 'checked_out', 'pending_regularizations'];
const SHORT = {
  in: "Who's in",
  not_in_yet: 'Not in yet',
  absent: 'Absent',
  late: 'Late',
  remote_or_on_duty: 'Remote / on duty',
  missing_punches: 'Missing punches',
  on_leave: 'On leave',
  checked_out: 'Checked out',
  pending_regularizations: 'Pending requests',
};

export default function TeamAttendance() {
  const today = new Date().toLocaleDateString('en-CA');
  const [date, setDate] = useState(today);
  const [tab, setTab] = useState('in');
  const [busy, setBusy] = useState({});
  const [rejecting, setRejecting] = useState(null);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const { can } = useAuth();
  const toast = useToast();
  const resource = useResource(`/v1/attendance/team/today?${query({ date })}`);
  const canDecide = can('attendance.approve|attendance.manage');

  async function act(row, action, body) {
    setBusy((b) => ({ ...b, [row.uuid]: action }));
    try {
      await decide('regularizations', row.uuid, action, body);
      toast(`Request ${action === 'approve' ? 'approved' : 'rejected'} for ${row.name}.`);
      setRejecting(null);
      setComment('');
      resource.reload();
    } catch (e) {
      // Partial failure: the other rows stay actionable, this one keeps its buttons.
      toast(e.status === 423 ? `That day is locked. ${e.message}` : e.message, 'error');
    } finally {
      setBusy((b) => ({ ...b, [row.uuid]: undefined }));
    }
  }
  function confirmReject() {
    if (!comment.trim()) return setCommentError('Tell the employee why this was rejected.');
    act(rejecting, 'reject', { comment: comment.trim() });
  }

  const employeeColumns = [
    { key: 'name', label: 'Employee' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} label={r.status_label} /> },
    { key: 'first_in', label: 'In', render: (r) => fmtTime(r.first_in), priority: 'md' },
    { key: 'last_out', label: 'Out', render: (r) => fmtTime(r.last_out), priority: 'md' },
    { key: 'late_minutes', label: 'Late', render: (r) => (r.late_minutes ? fmtMinutes(r.late_minutes) : '—'), priority: 'lg' },
  ];

  return (
    <>
      <PageHeader title="Team attendance" description="Who is in, absent or needs attention. Only people in your scope are shown." />
      <Card>
        <div className="flex flex-wrap items-end gap-3 p-4 sm:p-5">
          <Input label="Date" type="date" max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <Button variant="secondary" className="mb-5" onClick={resource.reload}>
            Refresh
          </Button>
        </div>
        <Resource resource={resource}>
          {(data) => {
            const groups = data.groups || {};
            if (!data.team_size)
              return <EmptyState title="No team members" description="There are no people in your data scope for this date." />;
            const items = ORDER.filter((k) => groups[k]).map((k) => ({ value: k, label: `${SHORT[k]} (${groups[k].count})` }));
            const group = groups[tab] || groups.in;
            return (
              <>
                <Tabs items={items} value={tab} onChange={setTab} />
                <div role="tabpanel" aria-label={SHORT[tab]}>
                  {tab === 'pending_regularizations' ? (
                    <ResponsiveList
                      label="Pending regularizations"
                      rows={group.requests || []}
                      empty={{ title: 'Nothing waiting', description: 'No regularization requests need your decision.' }}
                      columns={[
                        { key: 'name', label: 'Employee' },
                        { key: 'date', label: 'Date' },
                        { key: 'type', label: 'Type', render: (r) => r.type.replaceAll('_', ' ') },
                        {
                          key: 'actions',
                          label: '',
                          render: (r) =>
                            canDecide && (
                              <span className="flex gap-2">
                                <Button loading={busy[r.uuid] === 'approve'} disabled={!!busy[r.uuid]} onClick={() => act(r, 'approve', {})} aria-label={`Approve ${r.name}`}>
                                  Approve
                                </Button>
                                <Button variant="secondary" disabled={!!busy[r.uuid]} onClick={() => { setRejecting(r); setCommentError(''); }} aria-label={`Reject ${r.name}`}>
                                  Reject
                                </Button>
                              </span>
                            ),
                        },
                      ]}
                      card={(r) => (
                        <div>
                          <div className="flex justify-between gap-2">
                            <strong className="text-sm">{r.name}</strong>
                            <span className="text-xs">{r.date}</span>
                          </div>
                          <p className="m-0 text-xs capitalize text-slate-500 dark:text-slate-400">{r.type.replaceAll('_', ' ')}</p>
                          {canDecide && (
                            <div className="mt-2 flex gap-2">
                              <Button loading={busy[r.uuid] === 'approve'} disabled={!!busy[r.uuid]} onClick={() => act(r, 'approve', {})} aria-label={`Approve ${r.name}`}>
                                Approve
                              </Button>
                              <Button variant="secondary" disabled={!!busy[r.uuid]} onClick={() => { setRejecting(r); setCommentError(''); }} aria-label={`Reject ${r.name}`}>
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    />
                  ) : (
                    <ResponsiveList
                      label={SHORT[tab]}
                      rowKey={(r) => r.employee_uuid}
                      rows={group.employees || []}
                      empty={{ title: `No one in “${SHORT[tab]}”`, description: group.note || 'Nobody in your team matches this view for the selected date.' }}
                      columns={employeeColumns}
                      mobile={{
                        title: 'name',
                        subtitle: 'employee_number',
                        badge: (r) => <StatusBadge status={r.status} label={r.status_label} />,
                        facts: [
                          { label: 'In', value: (r) => fmtTime(r.first_in) },
                          { label: 'Out', value: (r) => fmtTime(r.last_out) },
                        ],
                      }}
                    />
                  )}
                  {group.count > (group.employees || group.requests || []).length && (
                    <p className="m-0 px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
                      Showing the first {(group.employees || group.requests).length} of {group.count}.
                    </p>
                  )}
                </div>
              </>
            );
          }}
        </Resource>
      </Card>
      <div className="mt-5">
        <TeamScheduleSection today={today} />
      </div>
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Reject regularization">
        <p className="mt-0 text-sm">
          {rejecting?.name} · {rejecting?.date}
        </p>
        <Textarea label="Reason (required)" value={comment} error={commentError} onChange={(e) => setComment(e.target.value)} />
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={() => setRejecting(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={!!(rejecting && busy[rejecting.uuid])} onClick={confirmReject}>
            Reject request
          </Button>
        </div>
      </Modal>
    </>
  );
}
