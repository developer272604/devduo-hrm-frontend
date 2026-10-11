import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useResource } from '../../../lib/hooks';
import { useAuth } from '../../../lib/auth';
import { describeError, fmtDate, fmtUnits, leavePaths, listOf, unwrap } from '../../../lib/leaveApi';
import ResponsiveList from '../../ResponsiveList';
import { Badge, Button, Card, FormError, Input, Modal, Resource, Select, Textarea, useToast } from '../../ui';

const SOURCES = [
  { value: 'overtime', label: 'Overtime' },
  { value: 'holiday_work', label: 'Holiday work' },
  { value: 'rest_day_work', label: 'Rest day work' },
];
const tone = { approved: 'green', pending: 'amber', rejected: 'amber', expired: 'neutral' };

export function validateEarn(v, authorized) {
  const e = {};
  if (!v.source_type) e.source_type = 'Choose what you worked.';
  if (v.source_type === 'authorized') {
    if (!v.work_date) e.work_date = 'Choose the work date.';
    if (!(Number(v.units) > 0)) e.units = 'Enter the units to grant.';
    if (!authorized) e.source_type = 'You cannot grant comp-off directly.';
  } else if (v.source_type && !v.source_id.trim()) {
    e.source_id = 'Enter the approved overtime request this comes from.';
  }
  return e;
}

function EarnDialog({ open, onClose, onDone }) {
  const { can } = useAuth();
  const authorized = can('leave.compoff.manage');
  const [v, setV] = useState({ source_type: '', source_id: '', work_date: '', units: '', note: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (n) => (e) => setV((s) => ({ ...s, [n]: e.target.value }));
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const found = validateEarn(v, authorized);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const body = Object.fromEntries(Object.entries(v).filter(([, x]) => String(x).trim() !== ''));
      await api(leavePaths.compOff, { method: 'POST', body });
      toast('Comp-off request submitted for approval.');
      onDone();
    } catch (err) {
      setServerError(err);
      const fe = {};
      Object.entries(err.errors || {}).forEach(([k, m]) => (fe[k] = [].concat(m).join(' ')));
      setErrors(fe);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Earn comp-off">
      <form onSubmit={submit} noValidate>
        <FormError error={serverError && { message: describeError(serverError) }} />
        <Select
          label="Worked on"
          name="source_type"
          value={v.source_type}
          error={errors.source_type}
          onChange={set('source_type')}
          options={[{ value: '', label: 'Choose…' }, ...SOURCES, ...(authorized ? [{ value: 'authorized', label: 'HR grant' }] : [])]}
        />
        {v.source_type && v.source_type !== 'authorized' && (
          <Input
            label="Approved overtime request ID"
            name="source_id"
            value={v.source_id}
            error={errors.source_id}
            hint="The units and date come from that overtime request."
            onChange={set('source_id')}
          />
        )}
        {v.source_type === 'authorized' && (
          <div className="grid gap-x-5 sm:grid-cols-2">
            <Input label="Work date" type="date" name="work_date" value={v.work_date} error={errors.work_date} onChange={set('work_date')} />
            <Input label="Units (days)" type="number" step="0.5" min="0" name="units" value={v.units} error={errors.units} onChange={set('units')} />
          </div>
        )}
        <Textarea label="Note (optional)" name="note" value={v.note} onChange={set('note')} />
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Submit
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Trace({ credit, onClose }) {
  const resource = useResource(leavePaths.compOffTrace(credit.uuid));
  return (
    <Modal open onClose={onClose} title="Where this comp-off came from and went">
      <Resource resource={resource}>
        {(res) => {
          const t = unwrap(res);
          return (
            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-200">
              <p className="m-0">
                Earned from {String(t.source?.type ?? '').replaceAll('_', ' ')} on {fmtDate(t.source?.work_date)}:{' '}
                <strong>{fmtUnits(t.units)}</strong>, valid until {fmtDate(t.expires_on)}.
              </p>
              {(t.uses || []).length === 0 ? (
                <p className="m-0">Not used yet.</p>
              ) : (
                <ul className="m-0 list-disc space-y-1 pl-5" aria-label="Uses">
                  {t.uses.map((u, i) => (
                    <li key={i}>
                      {fmtDate(u.date)}: {fmtUnits(u.units)} ({u.status})
                      {u.request && (
                        <>
                          {' '}
                          <Link className="text-brand-700 underline dark:text-brand-300" to={`/leave/requests/${u.request.uuid ?? u.request}`}>
                            View request
                          </Link>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        }}
      </Resource>
    </Modal>
  );
}

/** Comp-off credits: earn, claim through a normal request, and trace source-to-use. */
export default function CompOffSection() {
  const resource = useResource(`${leavePaths.compOff}?scope=mine`);
  const [earn, setEarn] = useState(false);
  const [trace, setTrace] = useState(null);
  const { can } = useAuth();
  const claim = (c) =>
    c.status === 'approved' && Number(c.remaining) > 0 ? (
      <Link
        to={`/leave/new?compoff=${c.uuid}`}
        className="inline-flex min-h-10 items-center rounded-lg bg-brand-500 px-4 text-xs font-semibold text-white hover:bg-brand-600"
      >
        Use credit
      </Link>
    ) : null;
  return (
    <Card title="Comp-off" action={can('leave.request|leave.compoff.manage') && <Button onClick={() => setEarn(true)}>Earn comp-off</Button>}>
      <Resource resource={resource}>
        {(res) => (
          <ResponsiveList
            label="Comp-off credits"
            rows={listOf(res)}
            empty={{ title: 'No comp-off yet', description: 'Work on a holiday or rest day, or log approved overtime, to earn comp-off.' }}
            columns={[
              { key: 'work_date', label: 'Worked on', render: (c) => fmtDate(c.work_date) },
              { key: 'units', label: 'Earned', render: (c) => fmtUnits(c.units) },
              { key: 'remaining', label: 'Remaining', render: (c) => fmtUnits(c.remaining) },
              { key: 'expires_on', label: 'Expires', priority: 'md', render: (c) => fmtDate(c.expires_on) },
              { key: 'status', label: 'Status', render: (c) => <Badge tone={tone[c.status]}>{c.status}</Badge> },
              {
                key: 'actions',
                label: '',
                render: (c) => (
                  <span className="flex gap-2">
                    {claim(c)}
                    <Button variant="secondary" onClick={() => setTrace(c)}>
                      Trace
                    </Button>
                  </span>
                ),
              },
            ]}
            card={(c) => (
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <strong className="text-sm">{fmtDate(c.work_date)}</strong>
                  <Badge tone={tone[c.status]}>{c.status}</Badge>
                </div>
                <p className="m-0 text-xs text-slate-600 dark:text-slate-300">
                  {fmtUnits(c.remaining)} left of {fmtUnits(c.units)} · expires {fmtDate(c.expires_on)}
                </p>
                <span className="mt-2 flex gap-2">
                  {claim(c)}
                  <Button variant="secondary" onClick={() => setTrace(c)}>
                    Trace
                  </Button>
                </span>
              </div>
            )}
          />
        )}
      </Resource>
      {earn && (
        <EarnDialog
          open
          onClose={() => setEarn(false)}
          onDone={() => {
            setEarn(false);
            resource.reload();
          }}
        />
      )}
      {trace && <Trace credit={trace} onClose={() => setTrace(null)} />}
    </Card>
  );
}
