import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, ErrorState, Select, Skeleton } from '../../components/ui';
import { Banner, ListCard, Page, Pill, Section, StatusBadge, Tiles, Amount, optionsOf, withEmpty } from '../../components/payroll/kit';
import { useResource } from '../../lib/hooks';
import { paths, query, unwrap, useList, titleCase } from '../../lib/payrollApi';
import { localAction } from '../../lib/api';

const OPS = 'payroll.configure|payroll.view|payroll.run|payroll.results.view|payroll.compensation.view';
const nameOf = (x) => (x && typeof x === 'object' ? (x.name ?? x.label ?? x.code) : x);
const Go = ({ to, children }) => (
  <Link to={to} className="text-xs font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
    {children}
  </Link>
);
const sum = (o) => Object.values(o ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);

export function CommandCenterPage() {
  const res = useResource(paths.commandCenter);
  const d = res.data ? unwrap(res.data) : null;
  const nav = useNavigate();
  const groups = d?.readiness?.groups ?? [];
  return (
    <Page permission={OPS} title="Payroll command center" description="What is ready, what is blocked and what needs a decision before pay day.">
      {res.loading ? (
        <Skeleton rows={3} />
      ) : res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : (
        <>
          {d.readiness?.state && (
            <Banner tone={d.readiness.state === 'ready' ? 'success' : d.readiness.state === 'blocked' ? 'error' : 'warn'} title={`Payroll readiness: ${titleCase(d.readiness.state)}`} action={<Go to="/payroll/readiness">Open readiness</Go>}>
              {d.readiness.rule}
            </Banner>
          )}
          <Tiles
            items={[
              { label: 'Blocking errors', value: d.blocking_errors?.count, tone: d.blocking_errors?.count > 0 ? 'warn' : undefined },
              { label: 'Warnings', value: d.warnings?.count },
              { label: 'Active runs', value: d.processing?.active_runs?.length },
              { label: 'Failed calculations', value: d.processing?.failed_calculations, tone: d.processing?.failed_calculations > 0 ? 'warn' : undefined },
              { label: 'Pending approvals', value: sum(d.pending_approvals?.payroll) + (Number(d.pending_approvals?.compensation) || 0) },
              { label: 'Variance alerts', value: d.variance_alerts },
              { label: 'Locked runs', value: d.locks?.locked },
              { label: 'Reopen requests', value: d.locks?.reopen_requested },
            ]}
          />
          {d.money_visible === false && <Banner tone="info">Amounts are hidden for your role. Counts and statuses are still shown.</Banner>}
          <Card title="Active runs" className="mb-5">
            <Section>
              {(d.processing?.active_runs ?? []).length === 0 ? (
                <p className="m-0 text-xs text-slate-500">No payroll runs are in progress.</p>
              ) : (
                <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800">
                  {d.processing.active_runs.map((r) => (
                    <li key={r.uuid} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                      <Link to={`/payroll/runs/${r.uuid}`} className="font-semibold text-brand-700 dark:text-brand-300">
                        {nameOf(r.group)} · {nameOf(r.period)}
                      </Link>
                      <StatusBadge value={r.status} />
                      <span>
                        Net <Amount value={r.control_totals?.net_total} currency={r.control_totals?.currency} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </Card>
          <Card title="Readiness by pay group" className="mb-5">
            <Section>
              {groups.length === 0 ? (
                <p className="m-0 text-xs text-slate-500">No pay groups to report on yet.</p>
              ) : (
                <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800">
                  {groups.map((g, i) => (
                    <li key={nameOf(g.group) ?? i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                      <button type="button" className="font-semibold text-brand-700 hover:underline dark:text-brand-300" onClick={() => nav(`/payroll/readiness?group=${g.group?.uuid ?? ''}`)}>
                        {nameOf(g.group)} · {nameOf(g.period)}
                      </button>
                      <StatusBadge value={g.state} />
                      <span>
                        {g.employees_ready ?? 0}/{g.employees_expected ?? 0} ready
                      </span>
                      <span>
                        {g.blocking ?? 0} blocking · {g.warning ?? 0} warnings
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </Card>
        </>
      )}
    </Page>
  );
}

function Checks({ data }) {
  const checks = data.checks ?? [];
  return (
    <>
      <Tiles
        items={[
          { label: 'Employees expected', value: data.employees_expected },
          { label: 'Employees ready', value: data.employees_ready, detail: data.percent_ready != null ? `${data.percent_ready}%` : undefined },
          { label: 'Blocking', value: data.counts?.blocking, tone: data.counts?.blocking > 0 ? 'warn' : undefined },
          { label: 'Warnings', value: data.counts?.warning },
        ]}
      />
      {(data.skipped_modules ?? []).length > 0 && <Banner tone="warn">Skipped modules: {data.skipped_modules.join(', ')}</Banner>}
      <Card title={`Checks (${checks.length})`} className="mb-5">
        {checks.length === 0 ? (
          <Section>
            <p className="m-0 text-xs text-slate-500">No checks were returned.</p>
          </Section>
        ) : (
          <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800">
            {checks.map((c) => {
              const href = localAction(c.action?.href);
              return (
                <li key={c.key} className="px-6 py-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm">{c.label ?? titleCase(c.key)}</strong>
                    <StatusBadge value={c.state === 'resolved' ? 'resolved' : c.severity} />
                    {c.count > 0 && (
                      <Pill>
                        {c.count} {c.unit ?? 'items'}
                      </Pill>
                    )}
                  </div>
                  {c.why && <p className="m-0 mt-1 text-slate-500 dark:text-slate-400">{c.why}</p>}
                  {(c.sample ?? []).length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-slate-600 dark:text-slate-300">Affected employees ({c.affected_employees ?? c.sample.length})</summary>
                      <ul className="m-0 mt-1 list-disc pl-5">
                        {c.sample.map((s) => (
                          <li key={s.employee_uuid}>
                            {s.name} {s.employee_number ? `(${s.employee_number})` : ''}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {href && c.action?.label && (
                    <p className="m-0 mt-1">
                      <Go to={href}>{c.action.label}</Go>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

export function ReadinessPage() {
  const groups = useList(`${paths.groups}?per_page=100`);
  const [group, setGroup] = useState(new URLSearchParams(window.location.search).get('group') ?? '');
  const res = useResource(`${paths.readiness}${group ? `?${query({ group })}` : ''}`);
  const d = res.data ? unwrap(res.data) : null;
  return (
    <Page permission={OPS} title="Payroll readiness" description="Every blocker explained, with the employees affected and where to fix it.">
      <div className="mb-4 max-w-sm">
        <Select label="Pay group" options={withEmpty(optionsOf(groups.rows), 'All groups (overview)')} value={group} onChange={(e) => setGroup(e.target.value)} />
      </div>
      {res.loading ? (
        <Skeleton rows={3} />
      ) : res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : group ? (
        <Checks data={d} />
      ) : (
        <ListCard
          title="Pay groups"
          list={{ loading: false, error: null, rows: d?.groups ?? [] }}
          rowKey={(r) => r.group?.uuid ?? nameOf(r.group)}
          onRowClick={(r) => r.group?.uuid && setGroup(r.group.uuid)}
          columns={[
            { key: 'group', label: 'Group', render: (r) => nameOf(r.group) },
            { key: 'period', label: 'Period', render: (r) => nameOf(r.period) },
            { key: 'state', label: 'State', render: (r) => <StatusBadge value={r.state} /> },
            { key: 'ready', label: 'Ready', render: (r) => `${r.employees_ready ?? 0}/${r.employees_expected ?? 0}` },
            { key: 'blocking', label: 'Blocking' },
            { key: 'warning', label: 'Warnings' },
          ]}
          mobile={{ title: (r) => nameOf(r.group), subtitle: (r) => nameOf(r.period), badge: (r) => <StatusBadge value={r.state} />, facts: [{ label: 'Ready', value: (r) => `${r.employees_ready ?? 0}/${r.employees_expected ?? 0}` }, { label: 'Blocking', value: 'blocking' }] }}
          empty={{ title: 'No pay groups yet', description: 'Create a pay group to start tracking readiness.' }}
        />
      )}
    </Page>
  );
}
