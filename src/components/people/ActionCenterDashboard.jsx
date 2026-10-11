import { Link } from 'react-router-dom';
import { CalendarClock, Cake, FileWarning, Hourglass, UserPlus, Award } from 'lucide-react';
import { useResource } from '../../lib/hooks';
import { Badge, Card, EmptyState, Resource, StatCard } from '../ui';

const WIDGETS = [
  { key: 'new_joiners', title: 'New joiners', icon: UserPlus, detail: 'Last 30 days', meta: (i) => i.joined_on || i.date },
  { key: 'upcoming_joinings', title: 'Upcoming joinings', icon: CalendarClock, detail: 'Next 30 days', meta: (i) => i.joined_on || i.date },
  { key: 'work_anniversaries', title: 'Work anniversaries', icon: Award, detail: 'This month', meta: (i) => (i.years ? `${i.years} year${i.years === 1 ? '' : 's'}` : i.date) },
  { key: 'probation_due', title: 'Probation due', icon: Hourglass, detail: 'Ending soon', meta: (i) => i.probation_end || i.date },
  { key: 'expiring_documents', title: 'Expiring documents', icon: FileWarning, detail: 'Needs renewal', meta: (i) => [i.label || i.kind, i.expiry_date].filter(Boolean).join(' · '), flag: (i) => i.expired },
  { key: 'birthdays', title: 'Birthdays', icon: Cake, detail: 'This month', meta: (i) => (i.day ? `${i.day}/${i.month}` : ''), hidden: (s) => s.visible === false },
];

const nameOf = (i) => i.name || i.employee_name || i.display_name || 'Employee';
const idOf = (i) => i.employee_uuid || i.uuid;

export function DashboardWidget({ widget, section }) {
  const items = section?.items || [];
  return (
    <Card title={widget.title} action={<Badge tone="purple">{section?.count ?? items.length}</Badge>}>
      {items.length ? (
        <ul className="m-0 list-none divide-y divide-slate-200 p-0 px-6 pb-3 dark:divide-slate-700">
          {items.map((item, index) => (
            <li key={`${idOf(item)}-${index}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              {idOf(item) ? (
                <Link className="min-w-0 truncate text-brand-700 dark:text-brand-300" to={`/people/${idOf(item)}`}>
                  {nameOf(item)}
                </Link>
              ) : (
                <span className="truncate">{nameOf(item)}</span>
              )}
              <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                {widget.flag?.(item) && <Badge tone="amber">Expired</Badge>}
                {widget.meta(item)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-6 pb-5 text-xs text-slate-500 dark:text-slate-400">Nothing to show for {widget.detail.toLowerCase()}.</p>
      )}
    </Card>
  );
}

export default function ActionCenterDashboard() {
  const resource = useResource('/v1/people/dashboard');
  return (
    <Resource resource={resource}>
      {(data) => {
        const widgets = WIDGETS.filter((w) => !w.hidden?.(data[w.key] || {}) && data[w.key]);
        if (!widgets.length && data.incomplete_profiles === undefined)
          return <EmptyState title="Dashboard unavailable" description="No people highlights are available for your scope." />;
        return (
          <div className="space-y-5 p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard label="Incomplete profiles" value={data.incomplete_profiles?.count} detail="Missing required information" />
              <StatCard label="Pending profile changes" value={data.pending_changes?.count} detail="Waiting for approval" />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              {widgets.map((w) => (
                <DashboardWidget key={w.key} widget={w} section={data[w.key]} />
              ))}
            </div>
          </div>
        );
      }}
    </Resource>
  );
}
