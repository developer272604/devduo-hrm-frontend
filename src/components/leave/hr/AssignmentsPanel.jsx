import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Card, FormError, Input, Select, useToast } from '../../ui';
import { Banner, StatusBadge } from '../../timeoffice/parts';
import { FormDialog } from '../../timeoffice/CrudPanel';
import { ConfirmDialog, ListCard, Pill } from './kit';
import {
  ASSIGN_TARGETS,
  options,
  paths,
  query,
  send,
  titleCase,
  today,
  typeOptions,
  unwrap,
  useAction,
  useList,
} from '../../../lib/leaveHrApi';
import { api } from '../../../lib/api';
import { EmployeePicker } from '../../people/lookups';

const fields = [
  {
    name: 'target_type',
    label: 'Applies to',
    type: 'select',
    required: true,
    default: 'tenant',
    options: options(ASSIGN_TARGETS),
  },
  {
    name: 'target_id',
    label: 'Target ID',
    showIf: (v) => v.target_type !== 'tenant',
    required: true,
    hint: 'Record id or uuid (country: ISO-2 code).',
  },
  {
    name: 'effective_from',
    label: 'Effective from',
    type: 'date',
    required: true,
    default: today(),
  },
  { name: 'effective_to', label: 'Effective to (optional)', type: 'date' },
  {
    name: 'priority',
    label: 'Priority',
    type: 'number',
    hint: 'Breaks ties between equally specific assignments.',
  },
  {
    name: 'is_override',
    label: 'Override (wins over other assignments of the same specificity)',
    type: 'checkbox',
  },
  { name: 'note', label: 'Note', type: 'textarea' },
];

/** Shows how the winner is chosen for one employee on one date, including skipped candidates and ambiguity. */
export function ResolveCheck({ policyUuid, types }) {
  const [f, setF] = useState({ employee: '', date: today(), leave_type: '' });
  const [state, setState] = useState(null);
  const { busy, error, run } = useAction();
  async function check(e) {
    e.preventDefault();
    const r = await run(async () => unwrap(await api(`${paths.policyResolve}?${query(f)}`)));
    if (r) setState(r);
  }
  const considered = state?.considered ?? [];
  return (
    <Card title="Resolve check" className="mb-5">
      <form onSubmit={check} className="px-6 pb-5">
        <p className="mt-0 text-xs text-slate-500 dark:text-slate-400">
          Pick an employee and a date to see which policy applies and why.
        </p>
        <FormError error={error} />
        <div className="grid gap-x-4 sm:grid-cols-3">
          <EmployeePicker
            label="Employee"
            value={f.employee}
            onChange={(employee) => setF({ ...f, employee })}
          />
          <Input
            label="Date"
            type="date"
            required
            value={f.date}
            onChange={(e) => setF({ ...f, date: e.target.value })}
          />
          <Select
            label="Leave type (optional)"
            value={f.leave_type}
            options={typeOptions(types, 'Any')}
            onChange={(e) => setF({ ...f, leave_type: e.target.value })}
          />
        </div>
        <Button type="submit" loading={busy}>
          Check
        </Button>
        {state && (
          <div className="mt-4 space-y-3 text-xs" data-testid="resolve-result">
            {state.ambiguous && (
              <Banner tone="warn" title="Ambiguous">
                Two assignments tie on specificity, override, priority and date. Change a priority
                or add an override.
              </Banner>
            )}
            <p className="m-0">
              {state.policy ? (
                <>
                  Policy <strong>{state.policy.name}</strong> v{state.policy.version}
                  {state.matched_by && <> matched by {titleCase(state.matched_by)}</>}
                  {policyUuid && state.policy.uuid && state.policy.uuid !== policyUuid && (
                    <Pill>a different policy applies</Pill>
                  )}
                </>
              ) : (
                <strong>No policy applies on this date.</strong>
              )}
            </p>
            {state.explanation && (
              <p className="m-0 text-slate-600 dark:text-slate-300">{state.explanation}</p>
            )}
            {state.leave_type && (
              <p className="m-0">
                {state.leave_type.code}:{' '}
                {state.leave_type.granted
                  ? 'granted'
                  : `not granted${state.leave_type.reason ? `: ${state.leave_type.reason}` : ''}`}
              </p>
            )}
            {considered.length > 0 && (
              <div className="overflow-x-auto">
                <table
                  className="w-full border-collapse text-left"
                  aria-label="Assignments considered"
                >
                  <thead>
                    <tr className="text-slate-500">
                      <th scope="col" className="py-1 pr-3 font-medium">
                        Policy
                      </th>
                      <th scope="col" className="py-1 pr-3 font-medium">
                        Target
                      </th>
                      <th scope="col" className="py-1 pr-3 font-medium">
                        Rank
                      </th>
                      <th scope="col" className="py-1 pr-3 font-medium">
                        Outcome
                      </th>
                      <th scope="col" className="py-1 font-medium">
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {considered.map((c, i) => (
                      <tr
                        key={c.assignment_id ?? i}
                        className="border-t border-slate-100 dark:border-slate-800"
                      >
                        <td className="py-1.5 pr-3">{c.policy}</td>
                        <td className="py-1.5 pr-3">
                          {titleCase(c.target_type)}
                          {c.is_override ? ' (override)' : ''}
                        </td>
                        <td className="py-1.5 pr-3">{c.rank}</td>
                        <td className="py-1.5 pr-3">
                          <StatusBadge status={c.outcome === 'selected' ? 'active' : c.outcome}>
                            {titleCase(c.outcome)}
                          </StatusBadge>
                        </td>
                        <td className="py-1.5 wrap-anywhere">{c.reason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </form>
    </Card>
  );
}

/** Assignments for one policy plus the resolve check. Precedence: specificity, override, priority, effective date. */
export default function AssignmentsPanel({ policyUuid, types, canManage }) {
  const toast = useToast();
  const list = useList(`${paths.policyAssignments}?${query({ policy: policyUuid })}`);
  const [form, setForm] = useState(false);
  const [remove, setRemove] = useState(null);
  const columns = [
    {
      key: 'target',
      label: 'Applies to',
      render: (a) =>
        `${titleCase(a.target_type)}${a.target_label ? `: ${a.target_label}` : a.target_id ? `: ${a.target_id}` : ''}`,
    },
    {
      key: 'dates',
      label: 'Dates',
      render: (a) => `${a.effective_from ?? '—'} to ${a.effective_to ?? 'open'}`,
    },
    { key: 'priority', label: 'Priority', priority: 'md', render: (a) => a.priority ?? 0 },
    {
      key: 'is_override',
      label: 'Override',
      priority: 'md',
      render: (a) => (a.is_override ? 'Yes' : 'No'),
    },
    { key: 'note', label: 'Note', priority: 'lg', render: (a) => a.note ?? '—' },
    {
      key: 'actions',
      label: 'Actions',
      render: (a) =>
        canManage && (
          <Button variant="ghost" aria-label="Remove assignment" onClick={() => setRemove(a)}>
            Remove
          </Button>
        ),
    },
  ];
  return (
    <>
      <Banner tone="info" title="Precedence">
        The most specific assignment wins (employee, then team, department, group, business unit,
        location, employee type, legal entity, country, whole organisation). Ties go to overrides,
        then higher priority, then the later start date.
      </Banner>
      <ListCard
        title="Assignments"
        list={list}
        columns={columns}
        action={
          canManage && (
            <Button onClick={() => setForm(true)}>
              <Plus size={14} /> Assign
            </Button>
          )
        }
        mobile={{
          title: (a) => titleCase(a.target_type),
          subtitle: (a) => `${a.effective_from ?? '—'} to ${a.effective_to ?? 'open'}`,
          facts: [
            { label: 'Priority', value: (a) => a.priority ?? 0 },
            { label: 'Override', value: (a) => (a.is_override ? 'Yes' : 'No') },
          ],
        }}
        empty={{
          title: 'Not assigned',
          description: 'Until this policy is assigned to someone it applies to nobody.',
        }}
      />
      <FormDialog
        open={form}
        onClose={() => setForm(false)}
        title="Assign policy"
        fields={fields}
        onSubmit={async (b) => {
          const body = Object.fromEntries(Object.entries(b).filter(([, v]) => v !== null));
          await send('POST', paths.policyAssignments, { ...body, policy: policyUuid });
          toast('Policy assigned');
          list.reload();
        }}
      />
      <ConfirmDialog
        open={Boolean(remove)}
        onClose={() => setRemove(null)}
        title="Remove assignment"
        intro="Employees covered only by this assignment fall back to the next most specific one, or to no policy."
        confirmLabel="Remove assignment"
        danger
        onConfirm={async () => {
          await send('DELETE', `${paths.policyAssignments}/${remove.uuid}`);
          toast('Assignment removed');
          list.reload();
        }}
      />
      <ResolveCheck policyUuid={policyUuid} types={types} />
    </>
  );
}
