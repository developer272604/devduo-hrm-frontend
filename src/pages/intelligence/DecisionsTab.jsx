import { useState } from 'react';
import { Badge, Card, EmptyState, ErrorState, Input, Skeleton } from '../../components/ui';
import { useList } from '../../lib/timeOfficeApi';

const D = '/v1/intelligence/decisions';
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function defaultPeriod(now = new Date()) {
  const from = new Date(now);
  from.setDate(from.getDate() - 89);
  return { from: iso(from), to: iso(now) };
}
export const hoursText = (h) => (h >= 48 ? `${(h / 24).toFixed(1)} days` : `${h} h`);

export function DecisionsTab() {
  const [p, setP] = useState(defaultPeriod());
  const [target, setTarget] = useState('48');
  const list = useList(`${D}?from=${p.from}&to=${p.to}&target_hours=${target || 48}`);
  const d = list.data;
  return (
    <Card title="How quickly requests get a decision">
      <div className="space-y-4 p-5 text-xs">
        <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          This shows response time only. It is not a performance rating and does not say whether decisions were right.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <Input label="From" type="date" value={p.from} onChange={(e) => setP({ ...p, from: e.target.value })} />
          <Input label="To" type="date" value={p.to} onChange={(e) => setP({ ...p, to: e.target.value })} />
          <Input label="Target (hours)" type="number" min="1" max="720" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        {list.loading ? (
          <Skeleton />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : (
          <>
            <p className="m-0 text-slate-500">
              {d.scope === 'company' ? 'Everyone with at least' : 'Your numbers, shown once you have at least'} {d.minimum_decisions} decisions in the period.
              {d.withheld_people ? ` ${d.withheld_people} other approver(s) have too few decisions to show.` : ''}
            </p>
            {d.rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="py-2 pr-4">Approver</th>
                      <th className="py-2 pr-4">Decisions</th>
                      <th className="py-2 pr-4">Typical wait</th>
                      <th className="py-2 pr-4">Slower than {d.target_hours} h</th>
                      <th className="py-2 pr-4">Approved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rows.map((r) => (
                      <tr key={r.person.id} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="py-2 pr-4">
                          {r.person.name} {r.person.is_you && <Badge tone="purple">you</Badge>}
                        </td>
                        <td className="py-2 pr-4">{r.decisions}</td>
                        <td className="py-2 pr-4">{hoursText(r.median_hours)}</td>
                        <td className="py-2 pr-4">{r.slower_than_target_pct}%</td>
                        <td className="py-2 pr-4">{r.approved_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Not enough decisions yet" description={`Approvers appear once they have ${d.minimum_decisions} completed decisions in the period.`} />
            )}
            <p className="m-0 text-slate-500">{d.limitations}</p>
          </>
        )}
      </div>
    </Card>
  );
}
