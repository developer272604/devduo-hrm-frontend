import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, ErrorState, Modal, Select, Skeleton, useToast } from '../../../components/ui';
import { FormDialog } from '../../../components/timeoffice/CrudPanel';
import { ReasonDialog } from '../../../components/timeoffice/dialogs';
import { Banner, Screen, StatusBadge, guarded } from '../../../components/timeoffice/parts';
import { KeyValues, ListCard } from '../../../components/leave/hr/kit';
import { useAuth } from '../../../lib/auth';
import { useResource } from '../../../lib/hooks';
import {
  dateOnly,
  options,
  paths,
  query,
  send,
  today,
  unwrap,
  units,
  useList,
} from '../../../lib/leaveHrApi';

const who = (e) => e?.name ?? e?.employee_number ?? (typeof e === 'string' ? e : '—');

function Trace({ credit, onClose }) {
  const res = useResource(paths.compOffAction(credit.uuid, 'trace'));
  const t = res.data ? unwrap(res.data) : null;
  return (
    <Modal open onClose={onClose} title="Comp-off trace">
      {res.loading ? (
        <Skeleton rows={2} />
      ) : res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : (
        <div className="space-y-3 text-xs">
          <KeyValues
            data={{ ...t.source, units: units(t.units), expires_on: dateOnly(t.expires_on) }}
          />
          <h3 className="mb-1 text-sm">Used by</h3>
          {(t.uses ?? []).length ? (
            <ul className="m-0 list-disc pl-5">
              {t.uses.map((u, i) => (
                <li key={i}>
                  {dateOnly(u.date)}: {units(u.units)} ({u.status})
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0">Not used yet.</p>
          )}
        </div>
      )}
    </Modal>
  );
}

function CompOffPageInner() {
  const { can } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const list = useList(`${paths.compOff}?${query({ scope: 'team', status })}`);
  const [grant, setGrant] = useState(false);
  const [decide, setDecide] = useState(null);
  const [trace, setTrace] = useState(null);
  const manage = can('leave.compoff.manage|leave.manage');
  const decideRight = can('leave.approve|leave.compoff.manage|leave.manage');
  const done = (m) => {
    toast(m);
    list.reload();
  };
  const columns = [
    { key: 'employee', label: 'Employee', render: (c) => who(c.employee) },
    {
      key: 'source',
      label: 'Source',
      render: (c) => (c.source_type ?? c.source?.type ?? '—').replace(/_/g, ' '),
    },
    {
      key: 'work_date',
      label: 'Worked on',
      render: (c) => dateOnly(c.work_date ?? c.source?.work_date),
    },
    { key: 'units', label: 'Units', render: (c) => units(c.units) },
    { key: 'remaining', label: 'Remaining', priority: 'md', render: (c) => units(c.remaining) },
    { key: 'expires_on', label: 'Expires', priority: 'lg', render: (c) => dateOnly(c.expires_on) },
    { key: 'status', label: 'Status', render: (c) => <StatusBadge status={c.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (c) => (
        <span className="flex flex-wrap gap-1.5">
          {c.status === 'pending' && decideRight && (
            <>
              <Button
                variant="secondary"
                aria-label={`Approve comp-off for ${who(c.employee)}`}
                onClick={() => setDecide({ c, kind: 'approve' })}
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                aria-label={`Reject comp-off for ${who(c.employee)}`}
                onClick={() => setDecide({ c, kind: 'reject' })}
              >
                Reject
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            aria-label={`Trace comp-off for ${who(c.employee)}`}
            onClick={() => setTrace(c)}
          >
            Trace
          </Button>
        </span>
      ),
    },
  ];
  return (
    <Screen
      title="Comp-off credits"
      description="Time off earned for working overtime, holidays or rest days. Approval posts a credit that expires on a set date."
      permission="leave.compoff.manage|leave.manage"
      action={
        manage && (
          <Button onClick={() => setGrant(true)}>
            <Plus size={14} /> Grant credit
          </Button>
        )
      }
    >
      <ListCard
        title="Credits"
        list={list}
        columns={columns}
        extra={
          <div className="px-6 pb-3">
            <Select
              label="Status"
              value={status}
              options={options(['pending', 'approved', 'rejected'], 'All')}
              onChange={(e) => setStatus(e.target.value)}
            />
          </div>
        }
        mobile={{
          title: (c) => who(c.employee),
          subtitle: (c) =>
            `${units(c.units)} units · ${dateOnly(c.work_date ?? c.source?.work_date)}`,
          badge: (c) => <StatusBadge status={c.status} />,
        }}
        empty={{
          title: 'No comp-off credits',
          description: 'Credits earned from overtime or granted by HR appear here.',
        }}
      />
      <FormDialog
        open={grant}
        onClose={() => setGrant(false)}
        title="Grant comp-off credit"
        notice={
          <Banner tone="info">
            An authorised grant credits the employee directly with the units you enter. It is
            recorded in the audit trail.
          </Banner>
        }
        fields={[
          { name: 'employee', label: 'Employee', type: 'employee', required: true },
          { name: 'units', label: 'Units (days)', required: true, hint: 'Up to 4 decimals.' },
          { name: 'work_date', label: 'Work date', type: 'date', required: true, default: today() },
          { name: 'note', label: 'Note', type: 'textarea' },
        ]}
        onSubmit={async (b) => {
          await send('POST', paths.compOff, {
            source_type: 'authorized',
            ...Object.fromEntries(Object.entries(b).filter(([, v]) => v !== null)),
          });
          done('Comp-off credit created');
        }}
      />
      <ReasonDialog
        open={Boolean(decide)}
        onClose={() => setDecide(null)}
        title={decide?.kind === 'approve' ? 'Approve comp-off credit' : 'Reject comp-off credit'}
        intro={decide && `${who(decide.c.employee)}: ${units(decide.c.units)} units`}
        required={decide?.kind === 'reject'}
        label={decide?.kind === 'approve' ? 'Note (optional)' : 'Why is this rejected?'}
        confirmLabel={decide?.kind === 'approve' ? 'Approve' : 'Reject'}
        danger={decide?.kind === 'reject'}
        onConfirm={async (note) => {
          await send('POST', paths.compOffAction(decide.c.uuid, decide.kind), note ? { note } : {});
          done(decide.kind === 'approve' ? 'Credit approved and posted' : 'Credit rejected');
        }}
      />
      {trace && <Trace credit={trace} onClose={() => setTrace(null)} />}
    </Screen>
  );
}

export default guarded(CompOffPageInner, {
  title: 'Comp-off credits',
  permission: 'leave.compoff.manage|leave.manage',
});
