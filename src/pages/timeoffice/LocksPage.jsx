import { useState } from 'react';
import { Lock, Plus } from 'lucide-react';
import { Button, Card, ErrorState, Skeleton, useToast } from '../../components/ui';
import ResponsiveList from '../../components/ResponsiveList';
import { Banner, LockedBanner, Screen, StatusBadge, guarded } from '../../components/timeoffice/parts';
import { PreviewConfirm, ReasonDialog } from '../../components/timeoffice/dialogs';
import { FormDialog } from '../../components/timeoffice/CrudPanel';
import { useAuth } from '../../lib/auth';
import { paths, send, titleCase, useList, addDays, today } from '../../lib/timeOfficeApi';

const SCOPES = ['tenant', 'legal_entity', 'payroll_group', 'location', 'employee_group', 'employee'].map((v) => ({ value: v, label: v === 'tenant' ? 'Whole organisation' : titleCase(v) }));
const lockFields = [
  { name: 'scope_type', label: 'What to lock', type: 'select', required: true, default: 'tenant', options: SCOPES },
  { name: 'scope_id', label: 'Record or employee ID', showIf: (v) => v.scope_type !== 'tenant', required: true },
  { name: 'start_date', label: 'From', type: 'date', required: true, default: addDays(today(), -30) },
  { name: 'end_date', label: 'To', type: 'date', required: true, default: addDays(today(), -1) },
  { name: 'reason', label: 'Why is this period being locked?', type: 'textarea', required: true },
];
const status = (l) => (l.unlock_requested && l.status === 'locked' ? 'unlock_requested' : l.status);

function LocksPagePage() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useList(paths.locks);
  const [creating, setCreating] = useState(null); // body awaiting confirmation
  const [form, setForm] = useState(false);
  const [dialog, setDialog] = useState(null); // {lock, kind: 'request'|'approve'|'reject'}
  const canLock = can('attendance.lock');
  const canUnlock = can('attendance.unlock|attendance.lock');
  const done = (msg) => {
    toast(msg);
    list.reload();
  };
  const columns = [
    { key: 'scope', label: 'Scope', render: (l) => l.scope_label ?? titleCase(l.scope_type) },
    { key: 'period', label: 'Period', render: (l) => `${l.start_date} to ${l.end_date}` },
    { key: 'status', label: 'State', render: (l) => <StatusBadge status={status(l)} /> },
    { key: 'reason', label: 'Reason', priority: 'md' },
    { key: 'unlock_reason', label: 'Unlock request', priority: 'lg', render: (l) => l.unlock_reason ?? '—' },
    {
      key: 'actions',
      label: 'Actions',
      render: (l) =>
        l.status !== 'locked' || !canUnlock ? null : l.unlock_requested ? (
          <span className="flex gap-1.5">
            <Button variant="secondary" onClick={() => setDialog({ lock: l, kind: 'approve' })}>Approve unlock</Button>
            <Button variant="secondary" onClick={() => setDialog({ lock: l, kind: 'reject' })}>Decline</Button>
          </span>
        ) : (
          <Button variant="secondary" onClick={() => setDialog({ lock: l, kind: 'request' })}>Request unlock</Button>
        ),
    },
  ];
  const mobile = { title: (l) => l.scope_label ?? titleCase(l.scope_type), subtitle: (l) => `${l.start_date} to ${l.end_date}`, badge: (l) => <StatusBadge status={status(l)} />, facts: [{ label: 'Reason', value: 'reason' }] };
  const kind = dialog?.kind;
  return (
    <Screen
      title="Attendance locks"
      description="Lock finished periods so payroll figures cannot change. Unlocking needs a second person."
      permission="attendance.lock|attendance.unlock|attendance.manage"
      action={canLock && <Button onClick={() => setForm(true)}><Plus size={14} /> Lock a period</Button>}
    >
      <Banner tone="info" title="Maker-checker">
        A person requests an unlock with a reason; a different authorised person approves or declines it. Nobody can approve their own request.
      </Banner>
      {list.rows.some((l) => l.status === 'locked') && <LockedBanner>Locked periods reject adjustments, regularizations and recalculation.</LockedBanner>}
      <Card>
        {list.loading ? (
          <Skeleton />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : (
          <ResponsiveList label="Locks" columns={columns} rows={list.rows} mobile={mobile} empty={{ title: 'No locks', description: 'Nothing is locked yet.' }} />
        )}
      </Card>
      <FormDialog
        open={form}
        onClose={() => setForm(false)}
        title="Lock a period"
        fields={lockFields}
        submitLabel="Preview impact"
        onSubmit={async (b) => setCreating(b)}
      />
      <PreviewConfirm
        open={Boolean(creating)}
        onClose={() => setCreating(null)}
        title="Confirm lock"
        intro="Locking freezes calculated attendance for the period. Review the impact first."
        load={async () => {
          const { reason: _reason, ...scope } = creating;
          const p = await send('POST', paths.lockPreview, scope);
          const d = p?.data ?? p;
          return { ...d, blocked: d.can_lock === false };
        }}
        onConfirm={async (preview) => {
          await send('POST', paths.locks, { ...creating, acknowledge_unresolved: Boolean(preview?.requires_acknowledgement) });
          done('Period locked');
        }}
        confirmLabel={<><Lock size={14} /> Lock period</>}
      />
      <ReasonDialog
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        title={kind === 'request' ? 'Request unlock' : kind === 'approve' ? 'Approve unlock' : 'Decline unlock request'}
        intro={dialog && `${dialog.lock.scope_label ?? titleCase(dialog.lock.scope_type)}, ${dialog.lock.start_date} to ${dialog.lock.end_date}`}
        notice={kind === 'request' ? 'A different authorised person must approve before the period reopens.' : kind === 'approve' ? 'Approving reopens every day in this period. You cannot approve a request you made.' : undefined}
        label={kind === 'request' ? 'Why must this be unlocked?' : 'Comment'}
        required={kind !== 'approve'}
        danger={kind === 'approve'}
        confirmLabel={kind === 'request' ? 'Send request' : kind === 'approve' ? 'Approve and unlock' : 'Decline'}
        onConfirm={async (text) => {
          const base = `${paths.locks}/${dialog.lock.uuid}`;
          if (kind === 'request') await send('POST', `${base}/unlock-request`, { reason: text });
          else if (kind === 'approve') await send('POST', `${base}/unlock-approve`, { comment: text });
          else await send('POST', `${base}/unlock-reject`, { comment: text });
          done(kind === 'request' ? 'Unlock requested' : kind === 'approve' ? 'Period unlocked' : 'Request declined');
        }}
      />
    </Screen>
  );
}

export default guarded(LocksPagePage, { title: 'Attendance locks', permission: 'attendance.lock|attendance.unlock|attendance.manage' });
