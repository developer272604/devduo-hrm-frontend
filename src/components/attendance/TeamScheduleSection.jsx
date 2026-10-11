import { useState } from 'react';
import { useResource } from '../../lib/hooks';
import { query } from '../../lib/api';
import { addDays, pageOf, paths } from '../../lib/timeOfficeApi';
import { Button, Card, EmptyState, ErrorState, Pagination, Skeleton } from '../ui';

const short = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric' });

function Grid({ from, to }) {
  const [page, setPage] = useState(1);
  const resource = useResource(`${paths.teamSchedule}?${query({ from, to, page })}`);
  if (resource.loading) return <Skeleton rows={3} />;
  if (resource.error) return <ErrorState error={resource.error} onRetry={resource.reload} />;
  const rows = resource.data?.data ?? [];
  if (rows.length === 0) return <EmptyState title="No team members" description="There are no people in your data scope for these dates." />;
  const dates = Object.keys(rows[0].days ?? {});
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" aria-label="Team schedule">
          <thead>
            <tr>
              <th scope="col" className="px-4 py-2 text-left font-medium text-slate-500 dark:text-slate-400">Employee</th>
              {dates.map((d) => (
                <th key={d} scope="col" className="px-2 py-2 text-center font-medium text-slate-500 dark:text-slate-400">{short(d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employee} className="border-t border-slate-100 dark:border-slate-800">
                <th scope="row" className="px-4 py-2 text-left font-medium">{r.employee}</th>
                {dates.map((d) => (
                  <td key={d} className="px-2 py-2 text-center">{r.days[d]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 px-5 py-2 text-[11px] text-slate-500 dark:text-slate-400">OFF is a weekly off, HOL a holiday, a dash means nothing is scheduled.</p>
      <Pagination data={pageOf(resource.data)} onChange={setPage} />
    </>
  );
}

/** Compact team roster for the next week. Loads only when opened, so the page stays light. */
export default function TeamScheduleSection({ today }) {
  const [open, setOpen] = useState(false);
  return (
    <Card title="Team schedule" action={<Button variant="secondary" onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Show next 7 days'}</Button>}>
      {open ? <Grid from={today} to={addDays(today, 6)} /> : <p className="m-0 px-6 pb-5 text-xs text-slate-500 dark:text-slate-400">Who works which shift over the coming week.</p>}
    </Card>
  );
}
