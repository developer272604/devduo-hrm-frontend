import { useResource } from '../../../lib/hooks';
import { query } from '../../../lib/api';
import { leavePaths, personName, typeName, unwrap } from '../../../lib/leaveApi';
import { Card, Resource, StatCard } from '../../ui';

/** Who is away and how many are available on one day, for the viewer's own scope. */
export default function Availability({ date }) {
  const resource = useResource(`${leavePaths.teamAvailability}?${query({ date })}`);
  return (
    <Card title={`Availability on ${date}`}>
      <div className="space-y-4 px-6 pb-6">
        <Resource resource={resource}>
          {(res) => {
            const d = unwrap(res);
            const away = d?.away_list || [];
            return (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label="Headcount" value={d?.headcount} />
                  <StatCard label="Away" value={d?.away} />
                  <StatCard label="Available" value={d?.available} />
                  <StatCard label="Available %" value={d?.available_percent != null ? `${Math.round(Number(d.available_percent))}%` : null} />
                </div>
                {(d?.holidays || []).length > 0 && (
                  <p className="m-0 text-xs text-slate-600 dark:text-slate-300">
                    Holiday: {d.holidays.map((h) => (typeof h === 'string' ? h : h.name)).join(', ')}
                  </p>
                )}
                {away.length === 0 ? (
                  <p className="m-0 text-xs text-slate-500 dark:text-slate-400">Everyone in your team is available.</p>
                ) : (
                  <ul className="m-0 list-none divide-y divide-slate-100 p-0 text-xs dark:divide-slate-800" aria-label="People away">
                    {away.map((a, i) => (
                      <li key={a.employee?.uuid ?? a.uuid ?? i} className="flex justify-between gap-2 py-2">
                        <span>{personName(a.employee ?? a)}</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {typeName(a.type)}
                          {a.status === 'pending' ? ' (pending)' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            );
          }}
        </Resource>
      </div>
    </Card>
  );
}
