import { useState } from 'react';
import { Badge, Card, EmptyState, ErrorState, Input, Skeleton } from '../../components/ui';
import { useList } from '../../lib/timeOfficeApi';

const D = '/v1/intelligence/disruption';
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function defaultWindow(now = new Date()) {
  const end = new Date(now);
  end.setDate(end.getDate() + 13);
  return { from: iso(now), to: iso(end) };
}
export const fitPct = (v) => `${Math.round((v ?? 0) * 100)}%`;

export function DisruptionTab() {
  const [w, setW] = useState(defaultWindow());
  const [pct, setPct] = useState('80');
  const list = useList(`${D}?from=${w.from}&to=${w.to}&min_available_pct=${pct || 80}`);
  const d = list.data;
  return (
    <Card title="Cover planning for leave and exits">
      <div className="space-y-4 p-5 text-xs">
        <div className="flex flex-wrap items-end gap-4">
          <Input label="From" type="date" value={w.from} onChange={(e) => setW({ ...w, from: e.target.value })} />
          <Input label="To" type="date" value={w.to} onChange={(e) => setW({ ...w, to: e.target.value })} />
          <Input label="Flag days below (% available)" type="number" min="1" max="100" value={pct} onChange={(e) => setPct(e.target.value)} />
        </div>
        {list.loading ? (
          <Skeleton />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : (
          <>
            <h3 className="m-0 text-xs font-semibold">Availability by department</h3>
            <ul className="m-0 list-none space-y-2 p-0">
              {d.departments.map((x) => (
                <li key={x.department} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <strong>{x.department}</strong> · {x.headcount} people ·{' '}
                  {x.shortage_day_count ? (
                    <Badge tone="amber">
                      {x.shortage_day_count} day(s) below {d.min_available_pct}%
                    </Badge>
                  ) : (
                    <Badge tone="green">no shortage days</Badge>
                  )}
                  {x.worst_day && (
                    <span className="block text-slate-500">
                      Lowest: {x.worst_day.available_pct}% on {x.worst_day.date} ({x.worst_day.away} of {x.worst_day.of} away)
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <h3 className="m-0 text-xs font-semibold">Who is away and who could cover</h3>
            {d.absences.length ? (
              <ul className="m-0 list-none space-y-3 p-0">
                {d.absences.map((a) => (
                  <li key={`${a.employee.uuid}-${a.from}`} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                    <p className="m-0 mb-2 flex flex-wrap items-center gap-2">
                      <strong className="text-sm">{a.employee.name}</strong>
                      <Badge tone={a.kind === 'exit' ? 'amber' : 'purple'}>{a.kind === 'exit' ? 'leaving' : 'on approved leave'}</Badge>
                      <span>
                        {a.from} to {a.to} · {a.department}
                      </span>
                      {a.in_shortage_department && <Badge tone="amber">department below threshold</Badge>}
                    </p>
                    {a.delegate && <p className="m-0">Named delegate: <strong>{a.delegate.name}</strong></p>}
                    {a.continuity_backups.map((b) => (
                      <p key={b.responsibility} className="m-0">
                        Trained backup for "{b.responsibility}" ({b.criticality}): <strong>{b.backup.name}</strong>
                      </p>
                    ))}
                    {a.uncovered_responsibilities.map((b) => (
                      <p key={b.responsibility} className="m-0 text-amber-800 dark:text-amber-200">
                        No trained backup for "{b.responsibility}" ({b.criticality})
                      </p>
                    ))}
                    {a.candidates.length > 0 ? (
                      <ul className="m-0 mt-2 list-none space-y-1 p-0">
                        {a.candidates.map((c) => (
                          <li key={c.employee.uuid}>
                            {c.employee.name}: skill fit {fitPct(c.skill_fit)}
                            {c.covers.length ? ` (${c.covers.join(', ')})` : ''}
                            {c.free_hours !== null ? ` · ${c.free_hours} free h/week declared` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="m-0 mt-2 text-slate-500">No same-department colleague with matching skills is free for the whole absence.</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No approved leave or known exits in this window" description="Only approved leave and known exits are counted." />
            )}
            <p className="m-0 text-slate-500">{d.limitations}</p>
          </>
        )}
      </div>
    </Card>
  );
}
