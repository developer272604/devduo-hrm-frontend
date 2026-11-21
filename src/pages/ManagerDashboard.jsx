import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  CalendarCheck,
  ClipboardCheck,
  GraduationCap,
  Plane,
  Receipt,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/hooks';
import { leavePaths } from '../lib/leaveApi';
import { paths as performancePaths } from '../lib/performanceApi';
import { Card, ErrorState, PageHeader, Resource, StatCard } from '../components/ui';

const destinations = [
  {
    label: 'Team attendance',
    summary: 'Daily attendance and team schedules',
    to: '/attendance/team',
    module: 'attendance',
    permission: 'attendance.team.view',
    icon: CalendarCheck,
  },
  {
    label: 'Team leave',
    summary: 'Team availability and leave requests',
    to: '/leave/team',
    module: 'leave',
    permission: 'leave.team.view',
    icon: UsersRound,
  },
  {
    label: 'Leave approvals',
    summary: 'Review requests assigned to you',
    to: '/leave/approvals',
    module: 'leave',
    permission: 'leave.approve|leave.manage',
    icon: ClipboardCheck,
  },
  {
    label: 'Performance dashboard',
    summary: 'Review cycles and team progress',
    to: '/performance/dashboard',
    module: 'performance',
    permission: 'performance.reports.view',
    icon: Activity,
  },
  {
    label: 'Expense claims',
    summary: 'Review expense claims in your scope',
    to: '/expenses',
    module: 'expenses',
    permission: 'expenses.approve',
    icon: Receipt,
  },
  {
    label: 'Travel requests',
    summary: 'Review travel requests in your scope',
    to: '/travel',
    module: 'travel',
    permission: 'travel.approve',
    icon: Plane,
  },
  {
    label: 'Team learning',
    summary: 'Manage enrollments and training approvals',
    to: '/learning/team',
    module: 'learning',
    permission: 'learning.enrol.manage|learning.enrol.approve',
    icon: GraduationCap,
  },
];

export const managerDestinations = (can, enabled) =>
  destinations.filter(({ module, permission }) => enabled(module) && can(permission));

function OverviewBlock({ title, path, to, children }) {
  const resource = useResource(path);
  return (
    <Card
      title={title}
      action={
        <Link
          className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
          to={to}
          aria-label={'Open ' + title}
        >
          Open module
        </Link>
      }
    >
      <Resource resource={resource}>
        {(data) => (
          <div className="grid grid-cols-1 gap-2 px-4 pb-4 min-[370px]:grid-cols-2">
            {children(data)}
          </div>
        )}
      </Resource>
    </Card>
  );
}

export default function ManagerDashboard() {
  const { can, enabled } = useAuth();
  const links = managerDestinations(can, enabled);
  const has = (url) => links.some(({ to }) => to === url);

  if (!links.length) {
    return (
      <ErrorState
        error={{
          status: 403,
          message: 'Your role has no team workflows available in this workspace.',
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Manager dashboard"
        description="Team activity, approvals and team workflows in one place."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        {has('/attendance/team') && (
          <OverviewBlock
            title="Attendance today"
            path="/v1/attendance/team/today"
            to="/attendance/team"
          >
            {(data) => (
              <>
                <StatCard label="People in scope" value={data.team_size} icon={UsersRound} />
                <StatCard label="Checked in" value={data.groups?.in?.count} icon={CalendarCheck} />
                <StatCard
                  label="On leave"
                  value={data.groups?.on_leave?.count}
                  icon={CalendarCheck}
                />
                {can('attendance.approve|attendance.manage') && (
                  <StatCard
                    label="Pending corrections"
                    value={data.groups?.pending_regularizations?.count}
                    icon={ClipboardCheck}
                  />
                )}
              </>
            )}
          </OverviewBlock>
        )}
        {has('/leave/approvals') && (
          <OverviewBlock title="Leave approvals" path={leavePaths.approvals} to="/leave/approvals">
            {(data) => (
              <StatCard
                label="In your approval inbox"
                value={data.meta?.total}
                icon={ClipboardCheck}
              />
            )}
          </OverviewBlock>
        )}
        {has('/performance/dashboard') && (
          <OverviewBlock
            title="Performance"
            path={performancePaths.dashboard}
            to="/performance/dashboard"
          >
            {(response) => {
              const data = response.data ?? response;
              return (
                <>
                  <StatCard label="Reviews" value={data.reviews?.total} icon={Activity} />
                  <StatCard
                    label="Late responses"
                    value={data.late_responses}
                    icon={ClipboardCheck}
                  />
                </>
              );
            }}
          </OverviewBlock>
        )}
      </div>
      <section className="mt-5" aria-labelledby="manager-workflows">
        <h2 id="manager-workflows" className="mb-3">
          Team workflows
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {links.map(({ to, label, summary, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex h-full min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-brand-950"
              >
                <span className="ui-stat-icon">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm">{label}</strong>
                  <small className="block">{summary}</small>
                </span>
                <ArrowUpRight size={16} className="text-slate-400" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
