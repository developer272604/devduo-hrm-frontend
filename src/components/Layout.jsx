import { useState } from 'react';
import { ThemeToggle } from '../lib/theme';
import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Building2,
  Users,
  ShieldCheck,
  ScrollText,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Bell,
  Search,
  ChevronDown,
  Plus,
  LogOut,
  LockKeyhole,
  ArrowUpRight,
  UserRound,
  Network,
  ListChecks,
  FilePen,
  CalendarCheck,
  UsersRound,
  Clock,
  SlidersHorizontal,
  CalendarClock,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { TIME_OFFICE_ACCESS } from '../routes/attendanceRoutes';
import { leaveNavItems } from '../routes/leaveRoutes';
import { LEAVE_HR_ACCESS } from '../routes/leaveHrRoutes';
import { payrollNavItem } from '../routes/payrollRoutes';
import { recruitmentNavItem } from '../routes/recruitmentRoutes';
import { lifecycleNavItem } from '../routes/lifecycleRoutes';
import { performanceNavItem } from '../routes/performanceRoutes';
import { learningNavItem } from '../routes/learningRoutes';
import { experienceNavItem } from '../routes/experienceRoutes';
import { operationsNavItems } from '../routes/operationsRoutes';
import { automationNavItems } from '../routes/automationRoutes';
import { enterpriseNavItems } from '../routes/enterpriseRoutes';
import { Avatar, Badge, Button, Dropdown, Drawer, Breadcrumb, useToast } from './ui';
export const organizationTypes = {
  'legal-entities': 'Legal entities',
  locations: 'Locations',
  'business-units': 'Business units',
  departments: 'Departments',
  teams: 'Teams',
  'cost-centers': 'Cost centers',
  designations: 'Designations',
  positions: 'Positions',
  grades: 'Grades',
  levels: 'Levels',
  'employee-types': 'Employee types',
};
export function Brand() {
  const { session } = useAuth();
  return (
    <Link
      className="flex items-center gap-2.5 [&>img]:h-9 [&>img]:w-auto [&>img]:rounded-xl [&>img]:bg-slate-900 [&>img]:p-1.5 [&>span]:text-2xl [&>span]:font-extrabold [&>span]:leading-none [&>span]:tracking-tight [&_small]:mt-1.5 [&_small]:block [&_small]:text-[7px] [&_small]:font-semibold [&_small]:tracking-[1.6px] [&_small]:text-slate-400 dark:[&_small]:text-slate-400"
      to="/"
      aria-label="Devduo home"
    >
      <img src="/devduo-logo.png" alt="" />
      <span>
        {session?.tenant.settings?.brand_name || 'devduo'}
        <span className="text-brand-700 dark:text-brand-300">.</span>
        <small>PEOPLE WORKSPACE</small>
      </span>
    </Link>
  );
}
export default function Layout() {
  const { session, can, enabled, logout } = useAuth(),
    [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [org, setOrg] = useState(true);
  const location = useLocation(),
    navigate = useNavigate(),
    toast = useToast();
  const nav = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    {
      to: '/my-work',
      label: 'My Work',
      icon: CheckSquare,
      permission: 'work.view',
      module: 'work',
    },
    {
      to: '/my-profile',
      label: 'My profile',
      icon: UserRound,
      permission: 'people.view|people.directory',
      module: 'people',
    },
    {
      to: '/directory',
      label: 'People directory',
      icon: Users,
      permission: 'people.directory',
      module: 'people',
    },
    { to: '/people', label: 'Employees', icon: Users, permission: 'people.view', module: 'people' },
    {
      to: '/people/org-chart',
      label: 'Org chart',
      icon: Network,
      permission: 'people.view|people.directory',
      module: 'people',
    },
    {
      to: '/people/action-center',
      label: 'People actions',
      icon: ListChecks,
      permission: 'people.quality.view',
      module: 'people',
    },
    {
      to: '/people/changes',
      label: 'Profile changes',
      icon: FilePen,
      permission: 'people.changes.approve',
      module: 'people',
    },
    {
      to: '/attendance',
      label: 'My attendance',
      icon: CalendarCheck,
      permission: 'attendance.view',
      module: 'attendance',
    },
    {
      to: '/attendance/team',
      label: 'Team attendance',
      icon: UsersRound,
      permission: 'attendance.team.view',
      module: 'attendance',
    },
    {
      to: '/time-office',
      label: 'Time office',
      icon: Clock,
      permission: TIME_OFFICE_ACCESS,
      module: 'attendance',
    },
    ...leaveNavItems,
    {
      to: '/leave/hr',
      label: 'Leave operations',
      icon: CalendarClock,
      permission: LEAVE_HR_ACCESS,
      module: 'leave',
    },
    payrollNavItem,
    recruitmentNavItem,
    lifecycleNavItem,
    performanceNavItem,
    learningNavItem,
    experienceNavItem,
    ...operationsNavItems,
    ...automationNavItems,
    ...enterpriseNavItems,
  ];
  const admin = [
    { to: '/users', label: 'People & access', icon: Users, permission: 'users.view' },
    { to: '/roles', label: 'Roles & permissions', icon: ShieldCheck, permission: 'roles.manage' },
    {
      to: '/people/settings',
      label: 'People settings',
      icon: SlidersHorizontal,
      permission: 'people.settings',
      module: 'people',
    },
    { to: '/audit', label: 'Audit log', icon: ScrollText, permission: 'audit.view' },
    { to: '/settings', label: 'Settings', icon: Settings, permission: 'settings.manage' },
  ];
  const item = (x) =>
    can(x.permission) &&
    enabled(x.module) && (
      <NavLink
        key={x.to}
        to={x.to}
        end={x.to === '/'}
        title={collapsed ? x.label : undefined}
        onClick={() => setMobile(false)}
      >
        <x.icon size={19} />
        <span>{x.label}</span>
      </NavLink>
    );
  const navigation = (
    <>
      <div className="mb-5 flex items-center gap-2.5 border-y border-slate-100 dark:border-slate-800 px-2 py-3 [&>div]:min-w-0 [&>div]:flex-1 [&_strong]:block [&_strong]:truncate [&_strong]:text-xs [&_small]:mt-1 [&_small]:block [&_small]:text-[10px] [&>svg]:text-slate-400 dark:[&>svg]:text-slate-400 group-data-[collapsed=true]/shell:hidden">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-brand-100 dark:border-brand-900 bg-brand-50 dark:bg-brand-950 text-sm font-semibold text-brand-600 dark:text-brand-300">
          {session.tenant.name.slice(0, 1)}
        </span>
        <div>
          <strong>{session.tenant.name}</strong>
          <small>Your workspace</small>
        </div>
        <ChevronDown size={15} />
      </div>
      <div className="mb-3 mt-1 px-3 text-[9px] font-semibold tracking-widest text-slate-400 dark:text-slate-400 group-data-[collapsed=true]/shell:hidden">
        WORKSPACE
      </div>
      <nav aria-label="Main navigation">
        {nav.map(item)}
        {can('organization.view') && (
          <>
            <button
              className="my-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs text-slate-500 dark:text-slate-400 hover:bg-brand-50 dark:hover:bg-brand-950 [&>svg:last-child]:ml-auto group-data-[collapsed=true]/shell:[&>span]:hidden group-data-[collapsed=true]/shell:[&>svg:last-child]:hidden"
              onClick={() => {
                if (collapsed) setCollapsed(false);
                setOrg(!org);
              }}
              aria-expanded={org}
            >
              <Building2 size={19} />
              <span>Organization</span>
              <ChevronDown size={14} />
            </button>
            {org && !collapsed && (
              <div className="mb-5 ml-5 mt-1 border-l border-slate-200 dark:border-slate-700 pl-4 [&>a]:block [&>a]:rounded [&>a]:px-2 [&>a]:py-1.5 [&>a]:text-[11px] [&>a]:text-slate-500 dark:[&>a]:text-slate-400 [&>a.active]:bg-brand-50 dark:[&>a.active]:bg-brand-950 [&>a.active]:font-semibold [&>a.active]:text-brand-700 dark:[&>a.active]:text-brand-300">
                {Object.entries(organizationTypes).map(([key, label]) => (
                  <NavLink key={key} to={`/organization/${key}`} onClick={() => setMobile(false)}>
                    {label}
                  </NavLink>
                ))}
              </div>
            )}
          </>
        )}
      </nav>
      {admin.some((x) => can(x.permission)) && (
        <>
          <div className="mb-3 mt-1 px-3 text-[9px] font-semibold tracking-widest text-slate-400 dark:text-slate-400 group-data-[collapsed=true]/shell:hidden">
            ADMINISTRATION
          </div>
          <nav aria-label="Administration">{admin.map(item)}</nav>
        </>
      )}
      <div className="mt-auto px-2.5 pt-7 [&>small]:text-[10px] group-data-[collapsed=true]/shell:hidden">
        <div className="mb-2 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          <span>Foundation workspace</span>
        </div>
        <small>Thoughtfully built for your people.</small>
      </div>
    </>
  );
  const route = location.pathname.split('/').filter(Boolean);
  const crumb = route.map(
    (x) => organizationTypes[x] || x.replaceAll('-', ' ').replace(/^./, (c) => c.toUpperCase()),
  );
  return (
    <div className="group/shell flex min-h-screen" data-collapsed={collapsed}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-y-auto border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 pb-4 min-[769px]:flex group-data-[collapsed=true]/shell:w-20 group-data-[collapsed=true]/shell:px-2 [&_nav>a]:my-0.5 [&_nav>a]:flex [&_nav>a]:items-center [&_nav>a]:gap-3 [&_nav>a]:rounded-lg [&_nav>a]:px-3 [&_nav>a]:py-3 [&_nav>a]:text-xs [&_nav>a]:text-slate-500 dark:[&_nav>a]:text-slate-400 [&_nav>a]:hover:bg-brand-50 dark:[&_nav>a]:hover:bg-brand-950 [&_nav>a.active]:bg-brand-100 dark:[&_nav>a.active]:bg-brand-900 [&_nav>a.active]:font-semibold [&_nav>a.active]:text-brand-700 dark:[&_nav>a.active]:text-brand-300 group-data-[collapsed=true]/shell:[&_nav>a>span]:hidden group-data-[collapsed=true]/shell:[&_nav>a]:justify-center">
        <div className="px-2.5 pb-7 pt-7 group-data-[collapsed=true]/shell:[&>a>span]:hidden">
          <Brand />
        </div>
        {navigation}
        <Button
          variant="ghost"
          className="mt-4 justify-start! pl-2.5! text-[10px] group-data-[collapsed=true]/shell:mt-auto"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <PanelLeftOpen size={19} />
          ) : (
            <>
              <PanelLeftClose size={19} />
              <span>Collapse sidebar</span>
            </>
          )}
        </Button>
      </aside>
      <Drawer open={mobile} onClose={() => setMobile(false)} title="Your workspace">
        <div className="flex flex-col [&_nav>a]:my-0.5 [&_nav>a]:flex [&_nav>a]:items-center [&_nav>a]:gap-3 [&_nav>a]:rounded-lg [&_nav>a]:px-3 [&_nav>a]:py-3 [&_nav>a]:text-xs [&_nav>a]:text-slate-500 dark:[&_nav>a]:text-slate-400 [&_nav>a.active]:bg-brand-100 dark:[&_nav>a.active]:bg-brand-900 [&_nav>a.active]:text-brand-700 dark:[&_nav>a.active]:text-brand-300">
          {navigation}
        </div>
      </Drawer>
      <div className="flex min-h-screen w-full min-w-0 flex-col min-[769px]:ml-60 min-[769px]:w-[calc(100%_-_15rem)] group-data-[collapsed=true]/shell:min-[769px]:ml-20 group-data-[collapsed=true]/shell:min-[769px]:w-[calc(100%_-_5rem)]">
        <header className="flex h-20 shrink-0 items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-9 max-[769px]:h-16 max-[769px]:px-4">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              className="min-[769px]:hidden!"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </Button>
            <Breadcrumb items={crumb.length ? crumb : ['Overview']} />
          </div>
          <div className="flex items-center gap-4 max-sm:gap-2">
            <span
              className="mr-2 hidden items-center gap-2.5 text-xs text-slate-400 dark:text-slate-400 xl:flex [&>kbd]:rounded [&>kbd]:border [&>kbd]:border-slate-200 dark:[&>kbd]:border-slate-700 [&>kbd]:px-1 [&>kbd]:py-0.5 [&>kbd]:text-[9px]"
              title="Global search will be available as more modules are added"
            >
              <Search size={16} />
              <span>Search workspace</span>
              <kbd>soon</kbd>
            </span>
            <ThemeToggle />
            {enabled('notifications') && (
              <Link
                to="/notifications"
                className="flex h-9 w-8 items-center justify-center text-slate-500 dark:text-slate-400"
                aria-label="Notifications"
              >
                <Bell size={19} />
              </Link>
            )}
            <span className="h-6 w-px bg-slate-200 dark:bg-slate-700 max-sm:hidden" />
            <Dropdown
              trigger={
                <>
                  <Avatar name={session.user.name} />
                  <span className="text-xs text-slate-600 dark:text-slate-300 max-[769px]:hidden">
                    {session.user.name.split(' ')[0]}
                  </span>
                  <ChevronDown size={14} />
                </>
              }
            >
              <div className="mb-1 border-b border-slate-200 dark:border-slate-700 p-3 [&>strong]:mb-2 [&>strong]:block [&>strong]:text-sm [&>small]:mb-2 [&>small]:block">
                <strong>{session.user.name}</strong>
                <small>{session.user.email}</small>
                <Badge tone="purple">{session.roles[0]?.name || 'Member'}</Badge>
              </div>
              <Link to="/security">
                <LockKeyhole size={16} />
                Password & security
              </Link>
              <button
                onClick={async () => {
                  try {
                    await logout();
                    navigate('/login');
                  } catch (e) {
                    toast(e.message, 'error');
                  }
                }}
              >
                <LogOut size={16} />
                Sign out
              </button>
            </Dropdown>
          </div>
        </header>
        <main
          className="mx-auto w-full max-w-[1530px] flex-1 px-9 pb-11 pt-8 max-lg:px-6 max-[769px]:px-5 max-sm:px-4"
          key={location.pathname}
        >
          <Outlet />
        </main>
        <footer className="flex justify-between gap-5 px-9 pb-6 text-[10px] text-slate-400 dark:text-slate-400 max-[769px]:px-5 max-sm:[&>span:last-child]:max-w-44 max-sm:[&>span:last-child]:text-right">
          <span>devduo HRM</span>
          <span>A little less admin. More room for people.</span>
        </footer>
      </div>
    </div>
  );
}
