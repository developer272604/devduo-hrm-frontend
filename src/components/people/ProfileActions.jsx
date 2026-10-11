import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import {
  WORKER_TYPES,
  cancelInvitation,
  changeAssignment,
  changeManager,
  changeStatus,
  completeSeparation,
  confirmProbation,
  extendProbation,
  fieldErrors,
  inviteEmployee,
  label,
  rehireEmployee,
  resendInvitation,
  startSeparation,
  withdrawSeparation,
} from '../../lib/peopleApi';
import { Button, FormError, Input, Modal, Select, useToast } from '../ui';
import { EmployeePicker, OrgSelect } from './lookups';

const today = () => new Date().toLocaleDateString('en-CA');
const SEPARATION_TYPES = ['resignation', 'termination', 'retirement', 'contract_end', 'absconding', 'other'];

/** A small modal form: collects values, validates required ones, surfaces server errors inline. */
function ActionDialog({ title, onClose, onSubmit, children, submitLabel, valid = true }) {
  const [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={submit} noValidate>
        <FormError error={error} />
        {typeof children === 'function' ? children(fieldErrors(error)) : children}
        <div className="mt-4 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!valid}>{submitLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}

function StatusDialog({ uuid, onClose, onDone }) {
  const allowed = useResource(`/v1/employees/${uuid}/status`);
  const [status, setStatus] = useState(''),
    [date, setDate] = useState(today()),
    [reason, setReason] = useState('');
  // Separation has its own workflow (notice, complete, withdraw), so it is not offered as a plain status change.
  const options = (allowed.data?.allowed || []).filter((s) => s !== 'separated').map((s) => ({ value: s, label: label(s) }));
  return (
    <ActionDialog
      title="Change status"
      onClose={onClose}
      valid={Boolean(status)}
      submitLabel="Change status"
      onSubmit={async () => {
        await changeStatus(uuid, { status, effective_date: date, reason: reason || undefined });
        onDone('Status updated.');
      }}
    >
      <Select label="New status" required value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: '', label: 'Choose…' }, ...options]} />
      <Input label="Effective date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
    </ActionDialog>
  );
}

function ConfirmProbationDialog({ uuid, onClose, onDone }) {
  const [date, setDate] = useState(today()),
    [comments, setComments] = useState('');
  return (
    <ActionDialog
      title="Confirm probation"
      onClose={onClose}
      valid={Boolean(date)}
      submitLabel="Confirm probation"
      onSubmit={async () => {
        await confirmProbation(uuid, { confirmation_date: date, comments: comments || undefined });
        onDone('Probation confirmed.');
      }}
    >
      {(errors) => (
        <>
          <Input label="Confirmation date" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.confirmation_date} />
          <Input label="Comments" value={comments} onChange={(e) => setComments(e.target.value)} maxLength={1000} />
        </>
      )}
    </ActionDialog>
  );
}

function ExtendDialog({ uuid, current, onClose, onDone }) {
  const [end, setEnd] = useState(''),
    [reason, setReason] = useState('');
  return (
    <ActionDialog
      title="Extend probation"
      onClose={onClose}
      valid={Boolean(end) && Boolean(reason.trim())}
      submitLabel="Extend probation"
      onSubmit={async () => {
        if (current && end <= current) {
          const e = new Error('Choose a date after the current probation end.');
          e.errors = {};
          throw e;
        }
        await extendProbation(uuid, { new_end_date: end, reason });
        onDone('Probation extended.');
      }}
    >
      {(errors) => (
        <>
          <p className="mt-0 text-sm">Current probation end: {current || 'not set'}</p>
          <Input label="New probation end date" type="date" required value={end} onChange={(e) => setEnd(e.target.value)} error={errors.new_end_date} />
          <Input label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} error={errors.reason} />
        </>
      )}
    </ActionDialog>
  );
}

function SeparateDialog({ uuid, onClose, onDone }) {
  const [v, setV] = useState({ type: 'resignation', last_working_date: today(), reason: '', comments: '', rehire_eligible: true });
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  return (
    <ActionDialog
      title="Start separation"
      onClose={onClose}
      valid={Boolean(v.type && v.last_working_date)}
      submitLabel="Start separation"
      onSubmit={async () => {
        await startSeparation(uuid, { ...v, reason: v.reason || undefined, comments: v.comments || undefined });
        onDone('Separation started. The employee is now on notice.');
      }}
    >
      {(errors) => (
        <>
          <p className="mt-0 text-sm">Moves the employee to notice period. Complete the separation on or after the last working date.</p>
          <Select label="Separation type" required value={v.type} onChange={set('type')} options={SEPARATION_TYPES.map((x) => ({ value: x, label: label(x) }))} error={errors.type} />
          <Input label="Last working date" type="date" required value={v.last_working_date} onChange={set('last_working_date')} error={errors.last_working_date} />
          <Input label="Reason" value={v.reason} onChange={set('reason')} maxLength={2000} error={errors.reason} />
          <Input label="Comments" value={v.comments} onChange={set('comments')} maxLength={2000} />
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.rehire_eligible} onChange={set('rehire_eligible')} /> Eligible for rehire
          </label>
        </>
      )}
    </ActionDialog>
  );
}

function NoticeDialog({ uuid, mode, onClose, onDone }) {
  const [comments, setComments] = useState('');
  const complete = mode === 'complete';
  return (
    <ActionDialog
      title={complete ? 'Complete separation' : 'Withdraw separation'}
      onClose={onClose}
      submitLabel={complete ? 'Complete separation' : 'Withdraw separation'}
      onSubmit={async () => {
        const body = { comments: comments || undefined };
        await (complete ? completeSeparation(uuid, body) : withdrawSeparation(uuid, body));
        onDone(complete ? 'Separation completed.' : 'Separation withdrawn.');
      }}
    >
      <p className="mt-0 text-sm">
        {complete
          ? 'Moves the employee to Separated and deactivates their login. Allowed on or after the last working date.'
          : 'Cancels the notice and restores the employee to their previous status.'}
      </p>
      <Input label="Comments" value={comments} onChange={(e) => setComments(e.target.value)} maxLength={2000} />
    </ActionDialog>
  );
}

function RehireDialog({ uuid, onClose, onDone }) {
  const [v, setV] = useState({ joined_on: today(), worker_type: 'employee', override_reason: '' });
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <ActionDialog
      title="Rehire employee"
      onClose={onClose}
      valid={Boolean(v.joined_on && v.worker_type)}
      submitLabel="Rehire"
      onSubmit={async () => {
        const created = await rehireEmployee(uuid, {
          employment: { joined_on: v.joined_on, worker_type: v.worker_type },
          override_reason: v.override_reason || undefined,
        });
        onDone('Employee rehired.', created?.uuid);
      }}
    >
      {(errors) => (
        <>
          <p className="mt-0 text-sm">Creates a new employment for the same person. The joining date must be after the previous last working date.</p>
          <Input label="Joining date" type="date" required value={v.joined_on} onChange={set('joined_on')} error={errors['employment.joined_on']} />
          <Select label="Worker type" required value={v.worker_type} onChange={set('worker_type')} options={WORKER_TYPES.map((x) => ({ value: x, label: label(x) }))} error={errors['employment.worker_type']} />
          <Input label="Override reason (only if the last separation was not marked rehire-eligible)" value={v.override_reason} onChange={set('override_reason')} maxLength={1000} error={errors.override_reason} />
        </>
      )}
    </ActionDialog>
  );
}

function InviteDialog({ uuid, onClose }) {
  const list = useResource(`/v1/employees/${uuid}/invitations`);
  const toast = useToast();
  const [email, setEmail] = useState(''),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const rows = list.data?.data || [];
  async function act(fn, message) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      toast(message);
      list.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title="Invite to sign in">
      <FormError error={error} />
      <p className="mt-0 text-sm">Sends an email link so the employee can set a password and sign in. Leave the address empty to use their work, then personal, email.</p>
      <Input label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldErrors(error).email} />
      {rows.length > 0 && (
        <ul aria-label="Invitations" className="m-0 mt-3 list-none divide-y divide-slate-100 p-0 text-sm dark:divide-slate-800">
          {rows.map((i) => (
            <li key={i.uuid} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {i.email} · {label(i.status)}
                {i.expires_at ? ` · expires ${String(i.expires_at).slice(0, 10)}` : ''}
              </span>
              {i.status === 'pending' && (
                <span className="flex gap-2">
                  <Button variant="secondary" disabled={busy} onClick={() => act(() => resendInvitation(i.uuid), 'Invitation resent.')}>Resend</Button>
                  <Button variant="secondary" disabled={busy} onClick={() => act(() => cancelInvitation(i.uuid), 'Invitation cancelled.')}>Cancel invitation</Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end gap-2.5">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button
          loading={busy}
          onClick={() =>
            act(async () => {
              await inviteEmployee(uuid, email ? { email } : {});
              setEmail('');
            }, 'Invitation sent.')
          }
        >
          Send invitation
        </Button>
      </div>
    </Modal>
  );
}

function JobDialog({ uuid, onClose, onDone }) {
  const [v, setV] = useState({ effective_from: today(), change_type: 'transfer' });
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const body = () => {
    const out = {};
    Object.entries(v).forEach(([k, val]) => {
      if (val === '' || val == null) return;
      out[k] = k.endsWith('_id') ? Number(val) : val;
    });
    return out;
  };
  return (
    <ActionDialog
      title="Change job"
      onClose={onClose}
      valid={Boolean(v.effective_from)}
      submitLabel="Save job change"
      onSubmit={async () => {
        await changeAssignment(uuid, body());
        onDone('Job change saved.');
      }}
    >
      {(errors) => (
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Input label="Effective from" type="date" required value={v.effective_from} onChange={set('effective_from')} error={errors.effective_from} />
          <Select label="Change type" value={v.change_type} onChange={set('change_type')}
            options={['transfer', 'promotion', 'demotion', 'reorganization', 'correction', 'update'].map((x) => ({ value: x, label: label(x) }))} />
          <OrgSelect type="departments" label="Department" any="No change" value={v.department_id} onChange={set('department_id')} error={errors.department_id} />
          <OrgSelect type="designations" label="Designation" any="No change" value={v.designation_id} onChange={set('designation_id')} />
          <OrgSelect type="locations" label="Location" any="No change" value={v.location_id} onChange={set('location_id')} />
          <OrgSelect type="employee-types" label="Employee type" any="No change" value={v.employee_type_id} onChange={set('employee_type_id')} />
          <div className="sm:col-span-2"><Input label="Reason" value={v.reason || ''} onChange={set('reason')} maxLength={255} /></div>
        </div>
      )}
    </ActionDialog>
  );
}

function ManagerDialog({ uuid, onClose, onDone }) {
  const [manager, setManager] = useState(''),
    [date, setDate] = useState(today()),
    [reason, setReason] = useState('');
  return (
    <ActionDialog
      title="Change manager"
      onClose={onClose}
      valid={Boolean(date)}
      submitLabel="Save manager change"
      onSubmit={async () => {
        await changeManager(uuid, { type: 'primary', manager_uuid: manager || null, effective_from: date, reason: reason || undefined });
        onDone('Manager updated.');
      }}
    >
      <EmployeePicker label="New manager" value={manager} onChange={setManager} />
      <Input label="Effective from" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} />
    </ActionDialog>
  );
}

/** Lifecycle actions. Each button needs the permission of its endpoint, and the status must allow it. */
export default function ProfileActions({ uuid, profile, onChanged }) {
  const { can } = useAuth(),
    toast = useToast(),
    navigate = useNavigate();
  const [dialog, setDialog] = useState(null);
  const manage = can('people.manage'),
    separate = can('people.separate'),
    rehire = can('people.rehire'),
    invite = can('people.invite');
  if (!manage && !separate && !rehire && !invite) return null;
  const status = profile.header?.status;
  const closed = ['separated', 'archived'].includes(status);
  const probation = profile.employment?.probation;
  const done = (message, openUuid) => {
    setDialog(null);
    toast(message);
    if (openUuid) navigate(`/people/${openUuid}`);
    else onChanged();
  };
  const items = [
    manage && !closed && { key: 'status', text: 'Change status' },
    manage && status === 'probation' && { key: 'confirm', text: 'Confirm probation' },
    manage && status === 'probation' && probation && { key: 'extend', text: 'Extend probation' },
    manage && !closed && { key: 'job', text: 'Change job' },
    manage && !closed && { key: 'manager', text: 'Change manager' },
    invite && !closed && status !== 'inactive' && { key: 'invite', text: 'Invite' },
    separate && !closed && status !== 'notice_period' && { key: 'separate', text: 'Separate' },
    separate && status === 'notice_period' && { key: 'complete', text: 'Complete separation' },
    separate && status === 'notice_period' && { key: 'withdraw', text: 'Withdraw separation' },
    rehire && status === 'separated' && { key: 'rehire', text: 'Rehire' },
  ].filter(Boolean);
  const close = () => setDialog(null);
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Employee actions">
      {items.map((i) => (
        <Button key={i.key} variant="secondary" onClick={() => setDialog(i.key)}>
          {i.text}
        </Button>
      ))}
      {dialog === 'status' && <StatusDialog uuid={uuid} onClose={close} onDone={done} />}
      {dialog === 'confirm' && <ConfirmProbationDialog uuid={uuid} onClose={close} onDone={done} />}
      {dialog === 'extend' && <ExtendDialog uuid={uuid} current={probation?.probation_end} onClose={close} onDone={done} />}
      {dialog === 'job' && <JobDialog uuid={uuid} onClose={close} onDone={done} />}
      {dialog === 'manager' && <ManagerDialog uuid={uuid} onClose={close} onDone={done} />}
      {dialog === 'invite' && <InviteDialog uuid={uuid} onClose={close} />}
      {dialog === 'separate' && <SeparateDialog uuid={uuid} onClose={close} onDone={done} />}
      {(dialog === 'complete' || dialog === 'withdraw') && <NoticeDialog uuid={uuid} mode={dialog} onClose={close} onDone={done} />}
      {dialog === 'rehire' && <RehireDialog uuid={uuid} onClose={close} onDone={done} />}
    </div>
  );
}
