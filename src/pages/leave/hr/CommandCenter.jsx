import { Link } from 'react-router-dom';
import { Card, ErrorState, Skeleton } from '../../../components/ui';
import { Banner, Screen, StatusBadge, guarded } from '../../../components/timeoffice/parts';
import { CountMap, Section, Tiles } from '../../../components/leave/hr/kit';
import { useResource } from '../../../lib/hooks';
import { HR, paths, titleCase, unwrap } from '../../../lib/leaveHrApi';

const nameOf = (p) => p.employee_name ?? p.name ?? p.employee?.name ?? p.employee_number ?? 'Employee';
const Go = ({ to, children }) => (
  <Link to={to} className="text-xs font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
    {children}
  </Link>
);

function CommandCenterPage() {
  const res = useResource(paths.commandCenter);
  const d = res.data ? unwrap(res.data) : null;
  return (
    <Screen title="Absence command center" description="Who is away, what needs a decision and what could go wrong before payroll closes.">
      {res.loading ? (
        <Skeleton rows={3} />
      ) : res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : (
        <>
          <p className="mt-0 text-xs text-slate-500 dark:text-slate-400">
            As of {d.as_of ?? 'today'} for {d.employees_in_scope ?? 0} employees in your scope.
          </p>
          {d.payroll?.unlock_requests_waiting > 0 && (
            <Banner tone="warn" title="Unlock requests waiting" action={<Go to={`${HR}/locks`}>Review locks</Go>}>
              {d.payroll.unlock_requests_waiting} period unlock request(s) need a second person.
            </Banner>
          )}
          <Tiles
            items={[
              { label: 'Away today', value: d.away_today?.count },
              { label: 'Pending approvals', value: d.approvals?.pending },
              { label: 'Overdue approvals', value: d.approvals?.overdue, tone: d.approvals?.overdue > 0 ? 'warn' : undefined, detail: d.approvals?.escalate_after_hours ? `Escalates after ${d.approvals.escalate_after_hours} h` : undefined },
              { label: 'Negative balances', value: d.balances?.negative_accounts, tone: d.balances?.negative_accounts > 0 ? 'warn' : undefined },
              { label: 'Expiring lots', value: d.balances?.expiring_lots, detail: d.balances?.expiring_units != null ? `${d.balances.expiring_units} units` : undefined },
            ]}
          />
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Away today" className="mb-5">
              <Section>
                <CountMap map={d.away_today?.by_type} empty="Nobody is away today" />
                {(d.away_today?.people ?? []).length > 0 && (
                  <ul className="m-0 mt-3 list-disc pl-5 text-xs">
                    {d.away_today.people.slice(0, 12).map((p, i) => (
                      <li key={p.employee_uuid ?? i}>
                        {nameOf(p)}
                        {(p.leave_type ?? p.type) && ` · ${typeof (p.leave_type ?? p.type) === 'object' ? (p.leave_type ?? p.type).name : (p.leave_type ?? p.type)}`}
                      </li>
                    ))}
                  </ul>
                )}
                {(d.away_today?.next_7_days ?? []).length > 0 && (
                  <>
                    <h3 className="mb-1 mt-4 text-xs">Next 7 days</h3>
                    <ul className="m-0 list-none p-0 text-xs">
                      {d.away_today.next_7_days.map((x, i) => (
                        <li key={x.date ?? i}>
                          {x.date}: {x.count ?? x.away ?? (x.people ?? []).length} away
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Section>
            </Card>
            <Card title="Payroll readiness" className="mb-5">
              <Section>
                <dl className="m-0 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-slate-500">Previous period</dt>
                    <dd className="m-0">{typeof d.payroll?.previous_period === 'object' ? `${d.payroll.previous_period.start ?? d.payroll.previous_period.period_start ?? ''} to ${d.payroll.previous_period.end ?? d.payroll.previous_period.period_end ?? ''}` : (d.payroll?.previous_period ?? '—')}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Cutoff</dt>
                    <dd className="m-0">{typeof d.payroll?.cutoff === 'object' ? (d.payroll.cutoff?.cutoff_date ?? titleCase(d.payroll.cutoff?.status)) : (d.payroll?.cutoff ?? '—')}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Period locked</dt>
                    <dd className="m-0">{d.payroll?.period_locked ? 'Yes' : 'No'}</dd>
                  </div>
                </dl>
                <p className="mb-0 mt-3 flex gap-4">
                  <Go to={`${HR}/payroll`}>Payroll contract</Go>
                  <Go to={`${HR}/locks`}>Locks</Go>
                </p>
              </Section>
            </Card>
            {d.confidence && (
              <Card title="Data confidence" className="mb-5">
                <Section>
                  <p className="mt-0 text-xs">
                    <StatusBadge status={d.confidence.level}>{d.confidence.label ?? titleCase(d.confidence.level)}</StatusBadge> {d.confidence.meaning}
                  </p>
                  <ul className="m-0 list-disc pl-5 text-xs">
                    {(d.confidence.reasons ?? []).map((r) => (
                      <li key={r.key}>{r.message}</li>
                    ))}
                  </ul>
                </Section>
              </Card>
            )}
            {d.operations && (
              <Card title="Operations" className="mb-5">
                <Section>
                  <Tiles items={Object.entries(d.operations).filter(([, v]) => typeof v !== 'object').map(([k, v]) => ({ label: titleCase(k), value: String(v) }))} />
                  <p className="m-0 flex gap-4">
                    <Go to={`${HR}/accruals`}>Accrual runs</Go>
                    <Go to={`${HR}/adjustments`}>Adjustments</Go>
                  </p>
                </Section>
              </Card>
            )}
          </div>
        </>
      )}
    </Screen>
  );
}

export default guarded(CommandCenterPage, { title: 'Absence command center', permission: 'leave.reports.view|leave.manage|leave.team.view' });
