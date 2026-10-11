import { useResource } from '../../../lib/hooks';
import { query } from '../../../lib/api';
import { leavePaths, fmtDate, unwrap } from '../../../lib/leaveApi';
import { Badge, EmptyState, Resource } from '../../ui';

const KIND_TONE = { leave: 'purple', decision: 'green', ledger: 'neutral', comp_off: 'amber', lifecycle: 'neutral', lock: 'amber' };

/** Employee Time Story: one chronological list of leave, decisions, ledger posts and lifecycle events. No reasons are ever shown. */
export default function TimeStory({ employee, from, to }) {
  const resource = useResource(`${leavePaths.timeStory}?${query({ employee, from, to })}`);
  return (
    <Resource resource={resource}>
      {(res) => {
        const d = unwrap(res);
        const events = d?.events || [];
        if (!events.length)
          return <EmptyState title="Nothing in this period" description="Leave events, decisions and balance changes will appear here." />;
        return (
          <div>
            <ol className="m-0 list-none space-y-3 p-0" aria-label="Time story">
              {events.map((e, i) => (
                <li key={`${e.date}-${i}`} className="flex gap-3">
                  <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-brand-400" />
                  <div className="min-w-0 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-slate-800 dark:text-slate-100">{e.title}</strong>
                      <Badge tone={KIND_TONE[e.kind] || 'neutral'}>{String(e.kind).replaceAll('_', ' ')}</Badge>
                    </div>
                    <p className="m-0 text-slate-500 dark:text-slate-400">{fmtDate(e.date)}</p>
                    {e.detail && <p className="m-0 mt-0.5 text-slate-700 wrap-anywhere dark:text-slate-200">{e.detail}</p>}
                  </div>
                </li>
              ))}
            </ol>
            {d.truncated && (
              <p className="m-0 mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                Showing the most recent {events.length} of {d.total} events. Narrow the dates to see others.
              </p>
            )}
          </div>
        );
      }}
    </Resource>
  );
}
