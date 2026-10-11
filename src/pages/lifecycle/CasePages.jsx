import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, ErrorState, Pagination, Skeleton } from '../../components/ui';
import {
  Banner,
  FormModal,
  KeyValues,
  ListCard,
  Page,
  StatusBadge,
  useEmployeeOptions,
} from '../../components/lifecycle/kit';
import { useAuth } from '../../lib/auth';
import {
  clean,
  pageOf,
  paths,
  send,
  titleCase,
  today,
  unwrap,
  useList,
} from '../../lib/lifecycleApi';

const KIND = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'offboarding', label: 'Offboarding' },
];
const employeeName = (row) => row.employee_name ?? row.employee?.name ?? row.uuid;
const OWNERS = ['manager', 'hr', 'it', 'finance', 'employee', 'user'].map((o) => ({
  value: o,
  label: titleCase(o),
}));
const ANCHORS = ['joining', 'last_day', 'effective'].map((o) => ({
  value: o,
  label: titleCase(o),
}));

export function CasesPage() {
  const { can } = useAuth();
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const list = useList(`${paths.cases}?page=${page}${kind ? `&kind=${kind}` : ''}`);
  const [create, setCreate] = useState(null);
  const employees = useEmployeeOptions();
  const pct = (c) => `${c.readiness?.percent ?? 0}%`;
  return (
    <Page
      permission="lifecycle.view"
      title="Onboarding and offboarding cases"
      description="One open case per employee and kind."
      action={
        can('lifecycle.manage') && (
          <Button onClick={() => setCreate({ kind: 'onboarding' })}>New case</Button>
        )
      }
    >
      <div className="mb-4 max-w-xs">
        <label
          className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300"
          htmlFor="case-kind"
        >
          Kind
        </label>
        <select
          id="case-kind"
          className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All</option>
          {KIND.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <ListCard
        title="Cases"
        list={list}
        columns={[
          {
            key: 'employee_name',
            label: 'Employee',
            render: (c) => (
              <Link
                className="text-brand-700 dark:text-brand-300"
                to={`/lifecycle/cases/${c.uuid}`}
              >
                {employeeName(c)}
              </Link>
            ),
          },
          { key: 'kind', label: 'Kind', priority: 'md', render: (c) => titleCase(c.kind) },
          { key: 'anchor_date', label: 'Anchor date', priority: 'md' },
          { key: 'percent', label: 'Progress', priority: 'lg', render: pct },
          { key: 'status', label: 'Status', render: (c) => <StatusBadge value={c.status} /> },
        ]}
        card={(c) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <Link
                className="text-sm font-semibold text-brand-700 dark:text-brand-300"
                to={`/lifecycle/cases/${c.uuid}`}
              >
                {employeeName(c)}
              </Link>
              <StatusBadge value={c.status} />
            </div>
            <p className="m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">
              {titleCase(c.kind)} · {c.anchor_date ?? '—'} · {pct(c)}
            </p>
          </div>
        )}
        empty={{
          title: 'No cases',
          description: 'Cases are created from hires and separations, or manually.',
        }}
      />
      <Pagination data={list.data ? pageOf(list.data) : null} onChange={setPage} />
      <FormModal
        open={Boolean(create)}
        onClose={() => setCreate(null)}
        title="New case"
        initial={create ?? {}}
        fields={[
          {
            name: 'employee_uuid',
            label: 'Employee',
            options: [{ value: '', label: 'Select' }, ...employees],
          },
          { name: 'kind', label: 'Kind', options: KIND },
          {
            name: 'anchor_date',
            label: 'Joining or last working date',
            type: 'date',
            required: false,
          },
        ]}
        onSubmit={async (v) => {
          await send('POST', paths.cases, clean(v));
          list.reload();
        }}
        success="Case created"
      />
    </Page>
  );
}

/** Clearance status with blockers; settlement stays disabled until the server reports cleared. */
function ClearanceCard({ uuid }) {
  const { can } = useAuth();
  const clearance = useList(paths.case(uuid, 'clearance'));
  const [open, setOpen] = useState(false);
  const cl = unwrap(clearance.data);
  const cleared = Boolean(cl?.cleared);
  return (
    <>
      <Card title="Clearance and settlement" className="mb-5">
        {clearance.loading ? (
          <Skeleton rows={2} />
        ) : clearance.error ? (
          <ErrorState error={clearance.error} onRetry={clearance.reload} />
        ) : (
          <>
            <Banner
              tone={cleared ? 'success' : 'warn'}
              title={cleared ? 'Cleared' : 'Clearance pending'}
            >
              {cleared
                ? 'All departments have cleared this leaver.'
                : 'Settlement cannot start until every blocker is resolved.'}
            </Banner>
            {(cl?.departments ?? []).length > 0 && (
              <ul className="m-0 mb-3 list-none space-y-1 p-0 text-sm">
                {cl.departments.map((d, i) => (
                  <li key={d.department ?? d.name ?? i} className="flex justify-between gap-3">
                    <span>{titleCase(d.department ?? d.name)}</span>
                    <StatusBadge value={d.cleared ? 'approved' : (d.status ?? 'pending')} />
                  </li>
                ))}
              </ul>
            )}
            {(cl?.blockers ?? []).length > 0 && (
              <ul aria-label="Clearance blockers" className="m-0 mb-3 space-y-1 pl-5 text-sm">
                {cl.blockers.map((b, i) => (
                  <li key={i}>{typeof b === 'string' ? b : (b.title ?? b.message ?? b.reason)}</li>
                ))}
              </ul>
            )}
            {can('lifecycle.clearance.manage') && (
              <Button
                disabled={!cleared}
                onClick={() => setOpen(true)}
                aria-describedby={cleared ? undefined : 'settlement-hint'}
              >
                Initiate settlement
              </Button>
            )}
            {!cleared && can('lifecycle.clearance.manage') && (
              <p
                id="settlement-hint"
                className="mb-0 mt-2 text-xs text-slate-500 dark:text-slate-400"
              >
                Disabled until clearance is complete.
              </p>
            )}
          </>
        )}
      </Card>
      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Initiate settlement"
        intro="Creates the final settlement in Payroll (once per case)."
        initial={{ currency: '', daily_rate: '', salary_days: '' }}
        fields={[
          { name: 'currency', label: 'Currency (3 letters)', minLength: 3 },
          { name: 'daily_rate', label: 'Daily rate', required: false },
          { name: 'salary_days', label: 'Salary days', type: 'number', required: false },
        ]}
        submitLabel="Initiate"
        onSubmit={async (v) => {
          await send('POST', paths.case(uuid, 'settlement'), clean(v));
          clearance.reload();
        }}
        success="Settlement initiated"
      />
    </>
  );
}

export function CaseDetailPage() {
  const { uuid } = useParams();
  const { can } = useAuth();
  const res = useList(paths.case(uuid));
  const c = unwrap(res.data);
  const offboarding = c?.kind === 'offboarding';
  const [dlg, setDlg] = useState(null);
  const manage = can('lifecycle.manage');
  const reload = res.reload;
  const open = c && !['completed', 'cancelled'].includes(c.status);
  const tasks = c?.tasks ?? [];

  return (
    <Page
      permission="lifecycle.view"
      title={c ? `${titleCase(c.kind)}: ${c.employee_name ?? c.employee?.name ?? ''}` : 'Case'}
      description="Tasks, owners and due dates."
      action={
        c &&
        open &&
        manage && (
          <>
            <Button variant="secondary" onClick={() => setDlg('task')}>
              Add task
            </Button>
            <Button variant="secondary" onClick={() => setDlg('reschedule')}>
              Reschedule
            </Button>
            <Button variant="secondary" onClick={() => setDlg('cancel')}>
              Cancel case
            </Button>
          </>
        )
      }
    >
      {res.loading ? (
        <Skeleton />
      ) : res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : (
        <>
          <Card title="Summary" className="mb-5">
            <div className="flex items-center gap-2 pb-3">
              <StatusBadge value={c.status} />
            </div>
            <KeyValues
              data={{
                anchor_date: c.anchor_date,
                progress: `${c.readiness?.percent ?? 0}%`,
                overdue: c.readiness?.overdue,
                mandatory_pending: c.readiness?.mandatory_pending,
              }}
            />
          </Card>

          {offboarding && <ClearanceCard uuid={uuid} />}

          <Card title="Tasks" className="mb-5">
            {tasks.length === 0 ? (
              <p className="m-0 text-sm text-slate-500 dark:text-slate-400">No tasks yet.</p>
            ) : (
              <ul className="m-0 list-none divide-y divide-slate-200 p-0 dark:divide-slate-700">
                {tasks.map((t) => (
                  <li
                    key={t.uuid}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <strong>{t.title}</strong>
                      {t.mandatory ? ' *' : ''}
                      <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
                        {t.group_name ? `${t.group_name} · ` : ''}Owner{' '}
                        {t.owner_name ?? titleCase(t.owner_type)} · due {t.due_date ?? '—'}
                        {t.overdue ? ' (overdue)' : ''}
                      </p>
                    </div>
                    <StatusBadge value={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <FormModal
        open={dlg === 'task'}
        onClose={() => setDlg(null)}
        title="Add task"
        initial={{
          owner_type: 'hr',
          due_anchor: offboarding ? 'last_day' : 'joining',
          due_offset_days: 0,
        }}
        fields={[
          { name: 'title', label: 'Title' },
          { name: 'owner_type', label: 'Owner', options: OWNERS },
          { name: 'due_anchor', label: 'Due relative to', options: ANCHORS },
          { name: 'due_offset_days', label: 'Offset in days', type: 'number' },
          { name: 'mandatory', label: 'Mandatory', type: 'checkbox' },
        ]}
        onSubmit={async (v) => {
          await send('POST', paths.case(uuid, 'tasks'), {
            ...v,
            due_offset_days: Number(v.due_offset_days) || 0,
            mandatory: Boolean(v.mandatory),
          });
          reload();
        }}
        success="Task added"
      />
      <FormModal
        open={dlg === 'reschedule'}
        onClose={() => setDlg(null)}
        title="Reschedule case"
        intro="Pending due dates shift with the new date."
        initial={{ anchor_date: c?.anchor_date ?? today() }}
        fields={[{ name: 'anchor_date', label: 'New date', type: 'date' }]}
        onSubmit={async (v) => {
          await send('POST', paths.case(uuid, 'reschedule'), v);
          reload();
        }}
        success="Case rescheduled"
      />
      <FormModal
        open={dlg === 'cancel'}
        onClose={() => setDlg(null)}
        title="Cancel case"
        initial={{ reason: '' }}
        fields={[{ name: 'reason', label: 'Reason', textarea: true }]}
        submitLabel="Cancel case"
        onSubmit={async (v) => {
          await send('POST', paths.case(uuid, 'cancel'), v);
          reload();
        }}
        success="Case cancelled"
      />
    </Page>
  );
}
