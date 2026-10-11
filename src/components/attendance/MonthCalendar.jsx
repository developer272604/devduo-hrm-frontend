import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui';
import { STATUS, statusMeta } from '../../lib/attendanceApi';
import { dotClasses, toneClasses } from './StatusBadge';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n) => String(n).padStart(2, '0');

/**
 * Month grid. `month` is 'YYYY-MM'; `days` are attendance_days rows. Days with a record are buttons
 * (click opens the explanation drawer); days without one are plain cells. Colour is secondary to the label.
 */
export default function MonthCalendar({ month, days = [], onSelect, onMonthChange, today }) {
  const [y, m] = month.split('-').map(Number);
  const byDate = new Map(days.map((d) => [d.attendance_date?.slice(0, 10), d]));
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const count = new Date(y, m, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const shift = (delta) => {
    const d = new Date(y, m - 1 + delta, 1);
    onMonthChange?.(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };
  const title = new Date(y, m - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
  const used = [...new Set(days.map((d) => d.status))];
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant="ghost" aria-label="Previous month" onClick={() => shift(-1)}>
          <ChevronLeft size={18} />
        </Button>
        <h3 className="m-0 text-sm font-semibold" aria-live="polite">
          {title}
        </h3>
        <Button variant="ghost" aria-label="Next month" onClick={() => shift(1)}>
          <ChevronRight size={18} />
        </Button>
      </div>
      <div role="grid" aria-label={`Attendance for ${title}`} className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            role="columnheader"
            className="py-1 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400"
          >
            {w}
          </div>
        ))}
        {cells.map((n, i) => {
          if (!n) return <div key={`b${i}`} role="gridcell" aria-hidden="true" />;
          const date = `${month}-${pad(n)}`;
          const day = byDate.get(date);
          const meta = day && statusMeta(day.status);
          const base =
            'flex min-h-14 flex-col items-start justify-between rounded-lg border p-1.5 text-left sm:min-h-20';
          const ring = date === today ? ' ring-2 ring-brand-500' : '';
          return day ? (
            <button
              key={date}
              role="gridcell"
              type="button"
              onClick={() => onSelect?.(day)}
              aria-label={`${new Date(y, m - 1, n).toLocaleDateString([], { month: 'long', day: 'numeric' })}, ${meta.label}`}
              className={`${base}${ring} ${toneClasses[meta.tone]} hover:brightness-95 focus-visible:outline-2 focus-visible:outline-brand-500`}
            >
              <span className="text-xs font-semibold">{n}</span>
              <span className="hidden max-w-full truncate text-[10px] sm:block">{meta.label}</span>
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full sm:hidden ${dotClasses[meta.tone]}`}
              />
            </button>
          ) : (
            <div
              key={date}
              role="gridcell"
              className={`${base}${ring} border-slate-100 text-slate-400 dark:border-slate-800 dark:text-slate-500`}
            >
              <span className="text-xs">{n}</span>
            </div>
          );
        })}
      </div>
      {used.length > 0 && (
        <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[11px] text-slate-600 dark:text-slate-300">
          {used.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${dotClasses[(STATUS[s] || {}).tone || 'slate']}`}
              />
              {statusMeta(s).label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
