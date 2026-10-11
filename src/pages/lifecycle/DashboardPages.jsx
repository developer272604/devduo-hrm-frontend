import { Link } from 'react-router-dom';
import { Card, ErrorState, Skeleton } from '../../components/ui';
import { ListCard, Page, StatusBadge, Tiles } from '../../components/lifecycle/kit';
import { paths, unwrap, useList } from '../../lib/lifecycleApi';

/** A dashboard metric may be a number or a list of rows. */
const count = (v) => (Array.isArray(v) ? v.length : (v ?? 0));
/** blockers_by_owner may be [{owner, count}] or {owner: count}. */
const owners = (v) =>
  Array.isArray(v)
    ? v.map((o) => ({
        owner: o.owner ?? o.owner_name ?? o.name ?? 'Unassigned',
        count: o.count ?? o.total ?? 0,
      }))
    : Object.entries(v ?? {}).map(([owner, n]) => ({
        owner,
        count: typeof n === 'object' ? (n?.count ?? 0) : n,
      }));

export function DashboardPage() {
  const res = useList(paths.dashboard);
  const d = unwrap(res.data) ?? {};
  const rows = owners(d.blockers_by_owner);
  return (
    <Page
      permission="lifecycle.view"
      title="Lifecycle dashboard"
      description="Open cases, late tasks and who is blocking whom."
    >
      {res.loading ? (
        <Skeleton />
      ) : res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : (
        <>
          <Tiles
            items={[
              {
                label: 'Open cases',
                value: d.open_cases ?? ((d.open_onboarding ?? 0) + (d.open_offboarding ?? 0)),
              },
              {
                label: 'Overdue tasks',
                value: d.tasks_overdue ?? count(d.overdue_tasks),
                tone: (d.tasks_overdue ?? count(d.overdue_tasks)) ? 'warn' : undefined,
              },
              { label: 'Joining soon', value: count(d.joining_soon) },
              {
                label: 'Joining, not ready',
                value: count(d.joining_not_ready),
                tone: count(d.joining_not_ready) ? 'warn' : undefined,
              },
              { label: 'Pending moves', value: count(d.pending_moves) },
            ]}
          />
          <Card title="Blockers by owner" className="mb-5">
            {rows.length ? (
              <ul className="m-0 list-none space-y-1.5 p-0 text-sm">
                {rows.map((o) => (
                  <li key={o.owner} className="flex justify-between gap-3">
                    <span>{o.owner}</span>
                    <strong className="tabular-nums">{o.count}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-sm text-slate-500 dark:text-slate-400">
                Nothing is blocked right now.
              </p>
            )}
          </Card>
          {Array.isArray(d.overdue_tasks) && d.overdue_tasks.length > 0 && (
            <Card title="Late tasks" className="mb-5">
              <ul className="m-0 list-none space-y-1.5 p-0 text-sm">
                {d.overdue_tasks.map((t) => (
                  <li key={t.uuid}>
                    {t.case_uuid ? (
                      <Link
                        className="text-brand-700 dark:text-brand-300"
                        to={`/lifecycle/cases/${t.case_uuid}`}
                      >
                        {t.title}
                      </Link>
                    ) : (
                      t.title
                    )}
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {' '}
                      · {t.owner_name ?? 'Unowned'} · due {t.due_date}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </Page>
  );
}

export function PreboardersPage() {
  const list = useList(paths.preboarders);
  const ready = (r) => r.case?.readiness?.day_one_ready ?? r.readiness?.day_one_ready ?? r.day_one_ready;
  const pct = (r) => `${r.case?.readiness?.percent ?? r.readiness?.percent ?? r.percent ?? 0}%`;
  const blockers = (r) =>
    (r.case?.readiness?.blockers ?? r.readiness?.blockers ?? r.blockers ?? [])
      .map((b) => (typeof b === 'string' ? b : (b.title ?? b.message)))
      .join('; ');
  return (
    <Page
      permission="lifecycle.view"
      title="Pre-joiners"
      description="People who have not started yet and their day-one readiness."
    >
      <ListCard
        title="Pre-joiners"
        list={list}
        columns={[
          { key: 'name', label: 'Name', render: (r) => r.employee_name ?? r.name ?? r.case?.employee?.name ?? '—' },
          {
            key: 'start_date',
            label: 'Starts',
            priority: 'md',
            render: (r) => r.joining_date ?? r.start_date ?? r.anchor_date ?? '—',
          },
          { key: 'percent', label: 'Checklist', priority: 'md', render: pct },
          {
            key: 'ready',
            label: 'Day one',
            render: (r) => <StatusBadge value={ready(r) ? 'ready' : 'blocked'} />,
          },
          { key: 'blockers', label: 'Blockers', priority: 'lg', render: (r) => blockers(r) || '—' },
          {
            key: 'open',
            label: '',
            render: (r) =>
              (r.case?.uuid ?? r.case_uuid) ? (
                <Link
                  className="text-brand-700 dark:text-brand-300"
                  to={`/lifecycle/cases/${r.case?.uuid ?? r.case_uuid}`}
                >
                  Open
                </Link>
              ) : null,
          },
        ]}
        mobile={{
          title: (r) => r.employee_name ?? r.name ?? r.case?.employee?.name ?? '—',
          badge: (r) => <StatusBadge value={ready(r) ? 'ready' : 'blocked'} />,
          facts: [{ label: 'Checklist', value: pct }],
        }}
        empty={{
          title: 'No pre-joiners',
          description: 'Accepted hires appear here until they start.',
        }}
      />
    </Page>
  );
}
