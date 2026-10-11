import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useResource } from '../../../lib/hooks';
import { query } from '../../../lib/api';
import { leavePaths, personName, typeName, todayLocal, unwrap } from '../../../lib/leaveApi';
import { Button, Card, Checkbox, EmptyState, Resource } from '../../ui';

const pad = (n) => String(n).padStart(2, '0');
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** All dates of "YYYY-MM" plus leading blanks so weeks start on Monday. */
export function monthCells(month) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: last }, (_, i) => `${month}-${pad(i + 1)}`),
  ];
}
export const shiftMonth = (month, delta) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
const expand = (from, to) => {
  const out = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`) && out.length < 62; d.setUTCDate(d.getUTCDate() + 1))
    out.push(d.toISOString().slice(0, 10));
  return out;
};

/** Normalises team entries and own entries into { date -> [{ label, pending, key }] } plus holidays by date. */
export function indexEntries(data, own) {
  const d = unwrap(data);
  const entries = Array.isArray(d) ? d : (d?.entries ?? d?.leave ?? d?.leave_days ?? d?.days ?? d?.data ?? []);
  const byDate = {};
  entries.forEach((e, i) => {
    const dates = e.dates ?? (e.date ? [e.date] : e.start_date ? expand(e.start_date, e.end_date || e.start_date) : []);
    const label = own ? typeName(e.type) : `${personName(e.employee)} - ${typeName(e.type)}`;
    dates.forEach((date) => {
      (byDate[date] ||= []).push({ key: `${e.request?.uuid ?? e.request ?? e.uuid ?? i}-${date}`, label, pending: e.status === 'pending', portion: e.portion });
    });
  });
  const holidays = {};
  (d?.holidays || []).forEach((h) => (holidays[h.date] = h.name || h.title || 'Holiday'));
  return { byDate, holidays };
}

const chip = (e) =>
  `block truncate rounded px-1.5 py-0.5 text-[11px] ${e.pending ? 'border border-dashed border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : 'bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200'}`;
const text = (e) => `${e.label}${e.pending ? ' (pending)' : ''}${e.portion && e.portion !== 'full_day' ? ` (${e.portion.replaceAll('_', ' ')})` : ''}`;

/** Month view of who is away. Grid from md, agenda list on phones. scope "team" needs leave.team.view; "mine" shows only you. */
export default function LeaveCalendar({ scope = 'team', selected, onSelect }) {
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const [pending, setPending] = useState(true);
  const cells = useMemo(() => monthCells(month), [month]);
  const days = cells.filter(Boolean);
  const path =
    scope === 'team'
      ? `${leavePaths.teamCalendar}?${query({ from: days[0], to: days[days.length - 1], include_pending: pending ? 1 : 0 })}`
      : `${leavePaths.myCalendar}?${query({ from: days[0], to: days[days.length - 1] })}`;
  const resource = useResource(path);
  const title = new Date(`${month}-01T00:00:00Z`).toLocaleDateString([], { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    <Card
      title={scope === 'team' ? 'Team calendar' : 'My calendar'}
      action={
        <div className="flex items-center gap-2">
          <Button variant="secondary" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft size={16} />
          </Button>
          <strong className="min-w-32 text-center text-sm" aria-live="polite">
            {title}
          </strong>
          <Button variant="secondary" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronRight size={16} />
          </Button>
        </div>
      }
    >
      <div className="px-4 pb-5 sm:px-6">
        {scope === 'team' && (
          <div className="mb-3">
            <Checkbox label="Include requests still waiting for approval" checked={pending} onChange={(e) => setPending(e.target.checked)} />
          </div>
        )}
        <Resource resource={resource}>
          {(res) => {
            const { byDate, holidays } = indexEntries(res, scope !== 'team');
            const busyDays = days.filter((d) => byDate[d]?.length || holidays[d]);
            return (
              <>
                <div className="hidden md:block" role="group" aria-label={`Leave in ${title}`}>
                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500 dark:text-slate-400" aria-hidden="true">
                    {WEEKDAYS.map((w) => (
                      <span key={w}>{w}</span>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1">
                    {cells.map((d, i) =>
                      d ? (
                        <button
                          type="button"
                          key={d}
                          aria-pressed={selected === d}
                          aria-label={`${d}, ${byDate[d]?.length || 0} away${holidays[d] ? `, ${holidays[d]}` : ''}`}
                          onClick={() => onSelect?.(d)}
                          className={`min-h-24 rounded-lg border p-1.5 text-left align-top ${selected === d ? 'border-brand-500' : 'border-slate-200 dark:border-slate-700'} ${holidays[d] ? 'bg-slate-50 dark:bg-slate-950' : ''}`}
                        >
                          <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">{Number(d.slice(8))}</span>
                          {holidays[d] && <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">{holidays[d]}</span>}
                          <span className="mt-1 block space-y-0.5">
                            {(byDate[d] || []).slice(0, 3).map((e) => (
                              <span key={e.key} className={chip(e)}>
                                {text(e)}
                              </span>
                            ))}
                            {(byDate[d] || []).length > 3 && (
                              <span className="block text-[10px] text-slate-500 dark:text-slate-400">+{byDate[d].length - 3} more</span>
                            )}
                          </span>
                        </button>
                      ) : (
                        <span key={`b${i}`} aria-hidden="true" />
                      ),
                    )}
                  </div>
                </div>
                <div className="md:hidden">
                  {busyDays.length === 0 ? (
                    <EmptyState title="Nobody is away this month" description="Approved and pending leave will appear here." />
                  ) : (
                    <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800" aria-label={`Leave in ${title}`}>
                      {busyDays.map((d) => (
                        <li key={d} className="py-2 text-xs">
                          <button type="button" className="p-0 font-semibold text-slate-800 dark:text-slate-100" onClick={() => onSelect?.(d)}>
                            {d}
                          </button>
                          {holidays[d] && <span className="ml-2 text-slate-500 dark:text-slate-400">{holidays[d]}</span>}
                          <ul className="m-0 mt-1 list-none space-y-1 p-0">
                            {(byDate[d] || []).map((e) => (
                              <li key={e.key} className={chip(e)}>
                                {text(e)}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {busyDays.length === 0 && <p className="m-0 mt-3 hidden text-xs text-slate-500 md:block dark:text-slate-400">Nobody is away this month.</p>}
              </>
            );
          }}
        </Resource>
      </div>
    </Card>
  );
}
