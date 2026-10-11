import { useState } from 'react';
import { Lock, Plus } from 'lucide-react';
import { Button, useToast } from '../../../components/ui';
import { FormDialog } from '../../../components/timeoffice/CrudPanel';
import { ReasonDialog } from '../../../components/timeoffice/dialogs';
import { Banner, LockedBanner, Screen, StatusBadge, guarded } from '../../../components/timeoffice/parts';
import { ConfirmDialog, ConfirmPreview, ListCard, Tiles } from '../../../components/leave/hr/kit';
import { useAuth } from '../../../lib/auth';
import { addDays, dateOnly, paths, send, titleCase, today, unwrap, useList } from '../../../lib/leaveHrApi';

const SCOPES = ['tenant', 'legal_entity', 'payroll_group', 'location', 'employee_group', 'employee'].map((v) => ({ value: v, label: v === 'tenant' ? 'Whole organisation' : titleCase(v) }));
const status = (l) => (l.unlock_requested && l.status === 'locked' ? 'unlock_requested' : l.status);
const label = (l) => l.scope_label ?? titleCase(l.scope_type);

function LocksPageInner() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useList(paths.locks);
  const [form, setForm] = useState(false);
  const [creating, setCreating] = useState(null);
  const [dialog, setDialog] = useState(null); // {lock, kind: request|reject|approve}
  const canLock = can('leave.lock|leave.manage');
  const canRequest = can('leave.lock|leave.unlock|leave.manage');
  const canDecide = can('leave.unlock');
  const canAttendance = can('attendance.lock');
  const done = (msg) => {
    toast(msg);
    list.reload();
  };
  const fields = [
    { name: 'scope_type', label: 'What to lock', type: 'select', required: true, default: 'tenant', options: SCOPES },
    { name: 'scope_id', label: 'Record or employee ID', showIf: (v) => v.scope_type !== 'tenant', required: true },
    { name: 'start_date', label: 'From', type: 'date', required: true, default: addDays(today(), -30) },
    { name: 'end_date', label: 'To (must be in the past)', type: 'date', required: true, default: addDays(today(), -1), max: addDays(today(), -1) },
    { name: 'reason', label: 'Why is this period being locked?', type: 'textarea', required: true },
    ...(canAttendance ? [{ name: 'coordinate_attendance', label: 'Also lock the same period in Attendance', type: 'checkbox' }] : []),
  ];
  const columns = [
    { key: 'scope', label: 'Scope', render: label },
    { key: 'period', label: 'Period', render: (l) => `${dateOnly(l.start_date)} to ${dateOnly(l.end_date)}` },
    { key: 'status', label: 'State', render: (l) => <StatusBadge status={status(l)} /> },
    { key: 'reason', label: 'Reason', priority: 'md' },
    { key: 'unlock_reason', label: 'Unlock request', priority: 'lg', render: (l) => l.unlock_reason ?? '—' },
    {
      key: 'actions',
      label: 'Actions',
      render: (l) => {
        if (l.status !== 'locked') return null;
        if (l.unlock_requested)
          return canDecide ? (
            <span className="flex gap-1.5">
              <Button variant="secondary" aria-label={`Approve unlock of ${label(l)}`} onClick={() => setDialog({ lock: l, kind: 'approve' })}>Approve unlock</Button>
              <Button variant="secondary" aria-label={`Decline unlock of ${label(l)}`} onClick={() => setDialog({ lock: l, kind: 'reject' })}>Decline</Button>
            </span>
          ) : null;
        return canRequest ? <Button variant="secondary" aria-label={`Request unlock of ${label(l)}`} onClick={() => setDialog({ lock: l, kind: 'request' })}>Request unlock</Button> : null;
      },
    },
  ];
  const kind = dialog?.kind;
  const base = dialog && paths.lockAction(dialog.lock.uuid, '');
  return (
    <Screen
      title="Leave locks"
      description="Lock finished periods so balances and payroll units cannot change. Unlocking needs a second person."
      permission="leave.lock|leave.unlock|leave.manage"
      action={canLock && <Button onClick={() => setForm(true)}><Plus size={14} /> Lock a period</Button>}
    >
      <Banner tone="info" title="Maker-checker">
        One person requests an unlock with a reason; a different person with unlock rights approves or declines. Nobody can approve their own request.
      </Banner>
      {list.rows.some((l) => l.status === 'locked') && <LockedBanner>Locked periods reject every ledger post for the employees they cover.</LockedBanner>}
      <ListCard
        title="Locks"
        list={list}
        columns={columns}
        mobile={{ title: label, subtitle: (l) => `${dateOnly(l.start_date)} to ${dateOnly(l.end_date)}`, badge: (l) => <StatusBadge status={status(l)} />, facts: [{ label: 'Reason', value: 'reason' }] }}
        empty={{ title: 'No locks', description: 'Nothing is locked yet.' }}
      />
      <FormDialog open={form} onClose={() => setForm(false)} title="Lock a period" fields={fields} submitLabel="Preview impact" onSubmit={async (b) => setCreating(b)} />
      <ConfirmPreview
        open={Boolean(creating)}
        onClose={() => setCreating(null)}
        title="Confirm lock"
        intro="Locking freezes balances for the period. Review the impact first."
        load={async () => {
          const { reason: _reason, coordinate_attendance: _c, ...scope } = creating;
          return unwrap(await send('POST', paths.lockPreview, scope));
        }}
        blocked={(d) => (d.can_lock === false ? (d.message ?? 'This period cannot be locked.') : null)}
        ack={(d) => (d.requires_acknowledgement ? `I understand ${d.unresolved?.pending_requests ?? 0} pending request(s) and ${d.unresolved?.pending_adjustments ?? 0} pending adjustment(s) are not resolved.` : null)}
        confirmLabel={<><Lock size={14} /> Lock period</>}
        onConfirm={async (d, { acknowledged }) => {
          await send('POST', paths.locks, { ...creating, acknowledge_unresolved: acknowledged, coordinate_attendance: Boolean(creating.coordinate_attendance) });
          done('Period locked');
        }}
      >
        {(d) => (
          <>
            <Tiles items={[{ label: 'Employees', value: d.employees }, { label: 'Employee days', value: d.employee_days }, { label: 'Pending requests', value: d.unresolved?.pending_requests, tone: d.unresolved?.pending_requests > 0 ? 'warn' : undefined }, { label: 'Pending adjustments', value: d.unresolved?.pending_adjustments, tone: d.unresolved?.pending_adjustments > 0 ? 'warn' : undefined }]} />
            {(d.conflicts ?? []).length > 0 && (
              <ul className="m-0 mb-3 list-disc pl-5 text-xs">{d.conflicts.map((c, i) => <li key={i}>{typeof c === 'string' ? c : (c.message ?? JSON.stringify(c))}</li>)}</ul>
            )}
          </>
        )}
      </ConfirmPreview>
      <ReasonDialog
        open={kind === 'request' || kind === 'reject'}
        onClose={() => setDialog(null)}
        title={kind === 'request' ? 'Request unlock' : 'Decline unlock request'}
        intro={dialog && `${label(dialog.lock)}, ${dateOnly(dialog.lock.start_date)} to ${dateOnly(dialog.lock.end_date)}`}
        notice={kind === 'request' ? 'A different authorised person must approve before the period reopens.' : undefined}
        label={kind === 'request' ? 'Why must this be unlocked?' : 'Comment (optional)'}
        required={kind === 'request'}
        confirmLabel={kind === 'request' ? 'Send request' : 'Decline'}
        onConfirm={async (text) => {
          if (kind === 'request') await send('POST', `${base}unlock-request`, { reason: text });
          else await send('POST', `${base}unlock-reject`, text ? { comment: text } : {});
          done(kind === 'request' ? 'Unlock requested' : 'Request declined');
        }}
      />
      <ConfirmDialog
        open={kind === 'approve'}
        onClose={() => setDialog(null)}
        title="Approve unlock"
        intro={dialog && `Approving reopens ${label(dialog.lock)} (${dateOnly(dialog.lock.start_date)} to ${dateOnly(dialog.lock.end_date)}). You cannot approve a request you made.${dialog.lock.unlock_reason ? ` Reason given: ${dialog.lock.unlock_reason}` : ''}`}
        confirmLabel="Approve and unlock"
        danger
        onConfirm={async () => {
          await send('POST', `${base}unlock-approve`);
          done('Period unlocked');
        }}
      />
    </Screen>
  );
}

export default guarded(LocksPageInner, { title: 'Leave locks', permission: 'leave.lock|leave.unlock|leave.manage' });
