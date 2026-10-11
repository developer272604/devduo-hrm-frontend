import { useState } from 'react';
import { useResource } from '../../lib/hooks';
import { query } from '../../lib/api';
import { Card, EmptyState, Resource, Tabs } from '../ui';
import { paths } from '../../lib/timeOfficeApi';
import StatusBadge from './StatusBadge';

const iso = (d) => d.toLocaleDateString('en-CA');
function range(view, today) {
  const t = new Date(`${today}T00:00:00`);
  if (view === 'month') {
    return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(new Date(t.getFullYear(), t.getMonth() + 1, 0))];
  }
  const start = new Date(t);
  start.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + (view === 'upcoming' ? 13 : 6));
  return [view === 'upcoming' ? today : iso(start), iso(end)];
}
const kindStatus = { working: 'present', weekly_off: 'weekly_off', holiday: 'holiday', leave: 'leave', not_scheduled: 'not_scheduled' };
const shiftName = (r) => r.shift?.name || r.shift?.code;
const holidayName = (h) => (h && typeof h === 'object' ? h.name : h);
const time = (v) => (v ? (/T(\d\d:\d\d)/.exec(String(v))?.[1] ?? (/^\d\d:\d\d/.test(v) ? String(v).slice(0, 5) : null)) : null);

/** Today / upcoming / week / month shift schedule with holidays and weekly offs. */
export default function ScheduleSection({ today }) {
  const [view, setView] = useState('week');
  const [from, to] = range(view, today);
  const resource = useResource(`${paths.mySchedule}?${query({ from, to })}`);
  return (
    <Card title="Shift schedule">
      <Tabs
        value={view}
        onChange={setView}
        items={[
          { value: 'week', label: 'This week' },
          { value: 'upcoming', label: 'Next 14 days' },
          { value: 'month', label: 'This month' },
        ]}
      />
        <Resource resource={resource}>
          {(data) => {
            const rows = data.data?.days || [];
            return rows.length === 0 ? (
              <EmptyState title="Nothing scheduled" description="No shifts are published for this period." />
            ) : (
              <ul aria-label="Schedule" className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800">
                {rows.map((r) => {
                  const date = String(r.date).slice(0, 10);
                  const label = new Date(`${date}T00:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                  const kind = r.kind || 'working';
                  return (
                    <li key={date} className={`flex items-center justify-between gap-3 px-5 py-3 ${date === today ? 'bg-brand-50/60 dark:bg-brand-950/40' : ''}`}>
                      <div className="min-w-0">
                        <p className="m-0 text-sm font-medium">
                          {label}
                          {date === today && <span className="ml-2 text-[11px] text-brand-700 dark:text-brand-300">Today</span>}
                        </p>
                        <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
                          {kind === 'working'
                            ? [shiftName(r), time(r.shift?.start_local ?? r.shift?.start) && `${time(r.shift?.start_local ?? r.shift?.start)} – ${time(r.shift?.end_local ?? r.shift?.end)}`, r.changed && 'Changed']
                              .filter(Boolean)
                              .join(' · ')
                            : holidayName(r.holiday) || ''}
                        </p>
                      </div>
                      <StatusBadge status={kindStatus[kind] || kind} label={kind === 'working' ? 'Working' : undefined} />
                    </li>
                  );
                })}
              </ul>
            );
          }}
        </Resource>
    </Card>
  );
}
