import { Card, ErrorState, Skeleton } from '../../components/ui';
import { CountMap, Page, Section, Tiles } from '../../components/recruitment/kit';
import { paths, titleCase, unwrap, useList } from '../../lib/recruitmentApi';

/** Stage SLA breaches among active applications and average hours per completed stage visit (decimal strings). */
export function SlaSection({ sla }) {
  const by = Object.entries(sla?.by_stage ?? {});
  const avg = Object.entries(sla?.average_hours_in_stage ?? {});
  const head = 'py-1 pr-2 font-medium';
  const cell = 'border-t border-slate-200 dark:border-slate-700';
  return (
    <Card title="Stage SLAs" className="mb-5">
      <Section>
        {!sla ? (
          <p className="m-0 text-xs text-slate-500 dark:text-slate-400">SLA figures are not available.</p>
        ) : (
          <>
            <p className="mt-0 text-sm">
              <strong className={sla.breached_total > 0 ? 'text-amber-700 dark:text-amber-300' : ''}>{sla.breached_total ?? 0}</strong> active application(s) have exceeded their stage SLA.
            </p>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs" aria-label="SLA breaches by stage">
                  <thead>
                    <tr className="text-slate-500 dark:text-slate-400">
                      <th scope="col" className={head}>Stage</th>
                      <th scope="col" className={head}>Active</th>
                      <th scope="col" className={head}>Breached</th>
                    </tr>
                  </thead>
                  <tbody>
                    {by.length === 0 ? (
                      <tr><td colSpan={3} className="py-2 text-slate-500 dark:text-slate-400">No active applications</td></tr>
                    ) : (
                      by.map(([stage, row]) => (
                        <tr key={stage} className={cell}>
                          <th scope="row" className="py-1 pr-2 text-left font-medium">{titleCase(stage)}</th>
                          <td className="py-1 pr-2 tabular-nums">{row.active}</td>
                          <td className={`py-1 pr-2 tabular-nums ${row.breached > 0 ? 'font-semibold text-amber-700 dark:text-amber-300' : ''}`}>{row.breached}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs" aria-label="Average hours in stage">
                  <thead>
                    <tr className="text-slate-500 dark:text-slate-400">
                      <th scope="col" className={head}>Stage</th>
                      <th scope="col" className={head}>Average hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {avg.length === 0 ? (
                      <tr><td colSpan={2} className="py-2 text-slate-500 dark:text-slate-400">No completed stage visits yet</td></tr>
                    ) : (
                      avg.map(([stage, hours]) => (
                        <tr key={stage} className={cell}>
                          <th scope="row" className="py-1 pr-2 text-left font-medium">{titleCase(stage)}</th>
                          <td className="py-1 pr-2 tabular-nums">{hours} h</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </Section>
    </Card>
  );
}

export default function AnalyticsPage() {
  const res = useList(paths.analytics);
  const d = unwrap(res.data) ?? {};
  const rq = d.requisitions ?? {};
  const pl = d.pipeline ?? {};
  const ttf = d.time_to_fill ?? {};
  const of = d.offers ?? {};
  const pct = (v) => (v == null ? '—' : `${v}%`);
  return (
    <Page permission="recruitment.reports.view" title="Recruitment analytics" description="Hiring demand, pipeline health and offer outcomes within your scope.">
      {res.loading ? (
        <Card><Skeleton /></Card>
      ) : res.error ? (
        <Card><ErrorState error={res.error} onRetry={res.reload} /></Card>
      ) : (
        <>
          <Tiles
            items={[
              { label: 'Open openings', value: rq.openings },
              { label: 'Filled', value: rq.filled },
              { label: 'Overdue requisitions', value: rq.overdue, tone: rq.overdue > 0 ? 'warn' : undefined },
              { label: 'Avg days to fill', value: ttf.average_days ?? '—', detail: `${ttf.filled_requisitions ?? 0} filled requisition(s)` },
              { label: 'Offer acceptance', value: pct(of.acceptance_rate) },
            ]}
          />
          <Card title="Requisitions by status" className="mb-5"><Section><CountMap map={rq.by_status} empty="No requisitions" /></Section></Card>
          <Card title="Active pipeline by stage" className="mb-5"><Section><CountMap map={pl.by_stage} empty="No active applications" /></Section></Card>
          <SlaSection sla={d.sla} />
          <Card title="Applications by status" className="mb-5"><Section><CountMap map={pl.by_status} empty="No applications" /></Section></Card>
          <Card title="Applications by source" className="mb-5"><Section><CountMap map={pl.by_source} empty="No applications" /></Section></Card>
          <Card title="Offers by status" className="mb-5"><Section><CountMap map={of.by_status} empty="No offers" /></Section></Card>
        </>
      )}
    </Page>
  );
}
