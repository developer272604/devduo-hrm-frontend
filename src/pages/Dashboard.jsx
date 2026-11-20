import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  Clock3,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/hooks';
import { Card, PageHeader, Resource, StatCard, Badge, EmptyState } from '../components/ui';

const actionStyle =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600';

export default function Dashboard() {
  const { session, can, enabled } = useAuth();
  const resource = useResource('/dashboard');
  const date = new Intl.DateTimeFormat('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: session.tenant.settings?.timezone || 'Asia/Kolkata',
  }).format(new Date());
  const showWork = can('work.view') && enabled('work');
  const showNotifications = enabled('notifications');
  const shortcuts = [
    [
      enabled('attendance') && can('attendance.view'),
      '/attendance',
      'My attendance',
      CalendarCheck,
    ],
    [enabled('leave') && can('leave.request'), '/leave/new', 'Request leave', CalendarDays],
    [
      enabled('leave') && can('leave.approve|leave.manage'),
      '/leave/approvals',
      'Leave approvals',
      CheckSquare,
    ],
    [
      can('settings.manage'),
      session.tenant.setup_completed_at ? '/settings' : '/setup',
      'Company setup',
      Building2,
    ],
    [can('users.manage'), '/users?new=1', 'Add a team member', Users],
    [can('roles.manage'), '/roles', 'Manage access', ShieldCheck],
    [true, '/security', 'Account security', ShieldCheck],
  ];

  return (
    <>
      <div className="dashboard-intro">
        <PageHeader
          eyebrow={date}
          title={`Hello, ${session.user.name.split(' ')[0]}.`}
          description={session.tenant.name}
          action={
            can('work.manage') &&
            enabled('work') && (
              <Link to="/my-work?new=1" className={actionStyle}>
                <Plus size={17} />
                Create task
              </Link>
            )
          }
        />
      </div>
      <Resource resource={resource}>
        {(data) => {
          const stats = [
            [
              data.open_tasks !== null,
              'Open tasks',
              data.open_tasks,
              'Assigned to you',
              CheckSquare,
            ],
            [
              data.overdue_tasks !== null,
              'Overdue tasks',
              data.overdue_tasks,
              'Past their due date',
              Clock3,
            ],
            [data.people !== null, 'Workspace members', data.people, 'Active accounts', Users],
            [showNotifications, 'Unread updates', data.unread, 'Workspace notifications', Bell],
          ].filter(([visible]) => visible);
          return (
            <div className="grid gap-5">
              {data.alerts.map((alert, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-xl border border-brand-100 sm:grid-cols-[auto_minmax(0,1fr)_auto] bg-brand-50 p-4 dark:border-brand-900 dark:bg-brand-950"
                >
                  <span className="ui-stat-icon">
                    <Building2 size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="text-sm">{alert.title}</strong>
                    <p className="text-xs">{alert.body}</p>
                  </div>
                  {alert.action && (
                    <Link
                      className="col-start-2 inline-flex items-center gap-2 text-xs font-semibold text-brand-700 hover:underline sm:col-start-auto dark:text-brand-300"
                      to={alert.action}
                    >
                      Continue setup <ArrowRight size={16} />
                    </Link>
                  )}
                </div>
              ))}
              {stats.length > 0 && (
                <section aria-label="Workspace summary" className="dashboard-metrics">
                  {stats.map(([, label, value, detail, icon]) => (
                    <StatCard key={label} label={label} value={value} detail={detail} icon={icon} />
                  ))}
                </section>
              )}
              <div className="dashboard-columns">
                <div className="grid min-w-0 content-start gap-5">
                  {showWork && (
                    <Card
                      title="My Work"
                      action={
                        <Link
                          className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                          to="/my-work"
                        >
                          View all <ArrowRight size={15} />
                        </Link>
                      }
                    >
                      {data.my_work.length ? (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                          {data.my_work.map((task) => (
                            <li key={task.id}>
                              <Link
                                to="/my-work"
                                className="flex items-center gap-3 px-4 py-3 hover:bg-brand-50 dark:hover:bg-brand-950"
                              >
                                <span className="ui-stat-icon">
                                  <CheckSquare size={17} />
                                </span>
                                <span className="min-w-0 flex-1 wrap-anywhere">
                                  <strong className="block text-xs">{task.title}</strong>
                                  <small>
                                    {task.source_module}
                                    {task.due_date && ` · Due ${task.due_date}`}
                                  </small>
                                </span>
                                <Badge
                                  tone={
                                    ['high', 'urgent'].includes(task.priority) ? 'amber' : 'neutral'
                                  }
                                >
                                  {task.priority}
                                </Badge>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <EmptyState
                          title="You’re all caught up"
                          description="Your assigned work will appear here."
                        />
                      )}
                    </Card>
                  )}
                  <Card title="Announcements">
                    {data.announcements.length ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.announcements.map((announcement) => (
                          <article key={announcement.id} className="flex gap-3 px-4 py-3">
                            <span className="ui-stat-icon">
                              <Bell size={17} />
                            </span>
                            <div className="min-w-0 wrap-anywhere">
                              <h3>{announcement.title}</h3>
                              <p className="my-1 whitespace-pre-wrap text-xs">
                                {announcement.body}
                              </p>
                              <small>
                                {new Date(announcement.created_at).toLocaleDateString()}
                              </small>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="No announcements yet"
                        description="Company news will appear here."
                      />
                    )}
                  </Card>
                </div>
                <Card title="Quick actions">
                  <ul className="px-3 pb-3">
                    {shortcuts
                      .filter(([visible]) => visible)
                      .map(([, to, label, Icon]) => (
                        <li key={to}>
                          <Link
                            to={to}
                            className="flex items-center gap-3 rounded-lg px-2 py-2 text-xs font-medium hover:bg-brand-50 dark:hover:bg-brand-950"
                          >
                            <span className="ui-stat-icon">
                              <Icon size={17} aria-hidden="true" />
                            </span>
                            <span>{label}</span>
                            <ArrowUpRight
                              size={15}
                              aria-hidden="true"
                              className="ml-auto text-slate-400"
                            />
                          </Link>
                        </li>
                      ))}
                  </ul>
                </Card>
              </div>
            </div>
          );
        }}
      </Resource>
    </>
  );
}
