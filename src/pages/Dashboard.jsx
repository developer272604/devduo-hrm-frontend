import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Plus,
  CheckSquare,
  Users,
  Clock3,
  Bell,
  CalendarDays,
  Sun,
  ShieldCheck,
  Building2,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/hooks';
import { Card, PageHeader, Resource, StatCard, Badge, EmptyState, Avatar } from '../components/ui';
export default function Dashboard() {
  const { session, can, enabled } = useAuth(),
    resource = useResource('/dashboard');
  const day = new Intl.DateTimeFormat('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: session.tenant.settings?.timezone || 'Asia/Kolkata',
  }).format(new Date());
  return (
    <>
      <PageHeader
        eyebrow={day}
        title={`Hello, ${session.user.name.split(' ')[0]}.`}
        description="A little clarity for the day ahead."
        action={
          can('work.manage') && enabled('work') ? (
            <Link
              to="/my-work?new=1"
              className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-4 py-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-brand-500 text-white shadow-sm hover:bg-brand-600"
            >
              <Plus size={17} />
              Create task
            </Link>
          ) : null
        }
      />
      <Resource resource={resource}>
        {(data) => (
          <>
            {data.alerts.map((a, i) => (
              <div
                className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-brand-100 dark:border-brand-900 bg-brand-50 dark:bg-brand-950 p-5 [&_strong]:text-xs [&_strong]:text-brand-800 dark:[&_strong]:text-brand-200 [&_p]:mb-0 [&_p]:mt-1 [&_p]:text-xs [&>a]:ml-auto [&>a]:flex [&>a]:items-center [&>a]:gap-2 [&>a]:whitespace-nowrap [&>a]:text-xs [&>a]:font-semibold [&>a]:text-brand-700 dark:[&>a]:text-brand-300 max-sm:p-4 max-sm:[&>div:nth-child(2)]:flex-1"
                key={i}
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-brand-200 dark:border-brand-800 bg-white dark:bg-slate-900 text-brand-400">
                  <Building2 size={24} />
                </div>
                <div>
                  <strong>{a.title}</strong>
                  <p>{a.body}</p>
                </div>
                {a.action && (
                  <Link to={a.action}>
                    Continue setup <ArrowRight size={17} />
                  </Link>
                )}
              </div>
            ))}
            <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4 max-sm:gap-2">
              {data.open_tasks !== null && (
                <StatCard
                  label="Your open tasks"
                  value={data.open_tasks}
                  detail="A clear view of what’s next"
                  icon={CheckSquare}
                />
              )}
              {data.overdue_tasks !== null && (
                <StatCard
                  label="Needs your attention"
                  value={data.overdue_tasks}
                  detail="Tasks past their due date"
                  icon={Clock3}
                />
              )}
              {data.people !== null && (
                <StatCard
                  label="People in your workspace"
                  value={data.people}
                  detail="Active workspace accounts"
                  icon={Users}
                />
              )}
              {enabled('notifications') && (
                <StatCard
                  label="Unread updates"
                  value={data.unread}
                  detail="Stay in the loop"
                  icon={Bell}
                />
              )}
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_292px]">
              <div className="flex min-w-0 flex-col gap-6">
                {can('work.view') && enabled('work') && (
                  <Card
                    title="My Work"
                    action={
                      <Link
                        className="inline-flex items-center gap-2 p-0 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline"
                        to="/my-work"
                      >
                        View all <ArrowRight size={15} />
                      </Link>
                    }
                  >
                    <div className="px-6 pb-3 text-xs text-slate-500 dark:text-slate-400">
                      Your next steps, in one place.
                    </div>
                    {data.my_work.length ? (
                      <div className="px-6 pb-2">
                        {data.my_work.map((t) => (
                          <Link
                            to="/my-work"
                            className="flex items-center gap-3 border-t border-slate-100 dark:border-slate-800 py-5 [&>div]:min-w-0 [&>div]:flex-1 [&_strong]:block [&_strong]:text-xs [&_strong]:font-medium [&_small]:mt-1 [&_small]:block [&_small]:text-[11px]"
                            key={t.id}
                          >
                            <span className="size-4 shrink-0 rounded border border-brand-200 dark:border-brand-800" />
                            <div>
                              <strong>{t.title}</strong>
                              <small>
                                {t.source_module} {t.due_date && `· Due ${t.due_date}`}
                              </small>
                            </div>
                            <Badge
                              tone={
                                t.priority === 'high' || t.priority === 'urgent'
                                  ? 'amber'
                                  : 'neutral'
                              }
                            >
                              {t.priority}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="You’re all caught up"
                        description="Your assigned work will appear here."
                      />
                    )}
                  </Card>
                )}
                <Card title="Announcements" action={<Badge>Company updates</Badge>}>
                  {data.announcements.length ? (
                    data.announcements.map((a) => (
                      <article
                        className="flex gap-4 px-6 pb-6 pt-2 [&_h3]:mb-2 [&_h3]:text-sm [&_p]:mb-3 [&_p]:text-xs [&_p]:leading-7 [&_small]:text-[11px]"
                        key={a.id}
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-400">
                          <Bell size={18} />
                        </div>
                        <div>
                          <span className="mb-2.5 block text-[10px] font-semibold tracking-widest text-slate-500 dark:text-slate-400">
                            FROM YOUR WORKSPACE
                          </span>
                          <h3>{a.title}</h3>
                          <p>{a.body}</p>
                          <small>{new Date(a.created_at).toLocaleDateString()}</small>
                        </div>
                      </article>
                    ))
                  ) : (
                    <EmptyState
                      title="No announcements yet"
                      description="Company news will appear here."
                    />
                  )}
                </Card>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Card title="People away">
                    <EmptyState
                      title="No absence data yet"
                      description="This space will connect to the leave module."
                    />
                  </Card>
                  <Card title="Upcoming events">
                    <EmptyState
                      title="A quiet calendar"
                      description="Future modules can publish team events here."
                    />
                  </Card>
                </div>
              </div>
              <div className="grid grid-cols-1 content-start gap-6 sm:grid-cols-2 xl:flex xl:flex-col">
                <Card title="Quick actions">
                  <div className="px-5 pb-3 [&>a]:flex [&>a]:items-center [&>a]:gap-3 [&>a]:border-b [&>a]:border-slate-100 dark:[&>a]:border-slate-800 [&>a]:py-3 [&>a]:text-xs [&>a]:text-slate-600 dark:[&>a]:text-slate-300 [&>a]:hover:text-brand-700 dark:[&>a]:hover:text-brand-300 [&>a:last-child]:border-0 [&_svg]:text-brand-400 [&_svg:last-child]:ml-auto">
                    {can('settings.manage') && (
                      <Link to={session.tenant.setup_completed_at ? '/settings' : '/setup'}>
                        <Building2 size={18} />
                        <span>Company setup</span>
                        <ArrowUpRight size={16} />
                      </Link>
                    )}
                    {can('users.manage') && (
                      <Link to="/users?new=1">
                        <Users size={18} />
                        <span>Add a team member</span>
                        <ArrowUpRight size={16} />
                      </Link>
                    )}
                    {can('roles.manage') && (
                      <Link to="/roles">
                        <ShieldCheck size={18} />
                        <span>Manage access</span>
                        <ArrowUpRight size={16} />
                      </Link>
                    )}
                    <Link to="/security">
                      <ShieldCheck size={18} />
                      <span>Account security</span>
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                </Card>
                <Card title="Today’s attendance">
                  <div className="px-6 pb-6 pt-2 text-center [&>h3]:mb-2 [&>h3]:text-xs [&>p]:mb-4 [&>p]:text-xs">
                    <span className="mb-4 mt-1 inline-flex size-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600">
                      <Sun size={26} />
                    </span>
                    <h3>A place for your workday.</h3>
                    <p>Attendance will be connected in a later phase.</p>
                    <Badge>Not enabled</Badge>
                  </div>
                </Card>
                <Card title="Pending approvals">
                  <div className="flex items-center gap-2 px-6 pb-5 text-brand-300 [&>p]:m-0 [&>p]:text-xs">
                    <CheckSquare size={20} />
                    <p>No approval workflows connected yet.</p>
                  </div>
                </Card>
                <div className="relative overflow-hidden px-4 py-3 text-slate-400 dark:text-slate-400 [&>span]:text-[8px] [&>span]:tracking-widest [&>p]:my-3 [&>p]:text-base [&>p]:leading-7">
                  <span>MAKE ROOM FOR WHAT MATTERS</span>
                  <p>
                    Great teams are built
                    <br />
                    one good day at a time.
                  </p>
                  <div className="absolute -bottom-5 -right-3 size-25 rounded-full border border-brand-100 dark:border-brand-900 before:absolute before:inset-3 before:rounded-full before:border before:border-brand-100 dark:before:border-brand-900 before:content-[''] after:absolute after:inset-6 after:rounded-full after:border after:border-brand-100 dark:after:border-brand-900 after:content-['']" />
                </div>
              </div>
            </div>
          </>
        )}
      </Resource>
    </>
  );
}
