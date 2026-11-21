import { useEffect, useState } from 'react';
import { ThemeToggle } from '../lib/theme';
import { TrialBanner } from './AccountStatus';
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
  CircleHelp,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { SectionIntro } from './Guide';
import { managerDestinations } from '../pages/ManagerDashboard';
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
import { Avatar, Badge, Button, Dropdown, Drawer, Breadcrumb, EmptyState, Modal, Search as SearchInput, useToast } from './ui';
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
export function Brand({ sidebar = false }) {
  const { session } = useAuth();
  const name = session?.tenant.settings?.brand_name?.trim();
  const customName = name && name.toLowerCase() !== 'devduo' ? name : null;
  return (
    <Link
      className="flex min-w-0 items-center gap-2.5"
      to="/"
      aria-label={customName || 'Devduo HRM'}
    >
      <img className="h-8 w-auto shrink-0 object-contain group-data-[collapsed=true]/shell:h-6" src="/devduo-logo.png" alt="" />
      <span className={`devduo-wordmark min-w-0 leading-tight ${sidebar ? 'truncate text-lg tracking-wider group-data-[collapsed=true]/shell:hidden' : 'wrap-anywhere text-xl'}`}>
        {customName || (sidebar ? 'DEVDUO' : (
          <>Devduo <span className="text-brand-700 dark:text-brand-300">HRM</span></>
        ))}
      </span>
    </Link>
  );
}
/** Sidebar sections, in order. Items are placed by their module so new modules never disappear (unknown modules fall into the last section). */
export const NAV_GROUPS = [
  { id: 'people', label: 'People', modules: ['people', 'lifecycle', 'recruitment', 'performance', 'learning', 'experience'] },
  { id: 'time', label: 'Time & pay', modules: ['attendance', 'leave', 'payroll'] },
  { id: 'operations', label: 'Operations', modules: ['assets', 'expenses', 'travel'] },
  { id: 'insight', label: 'Automation & insight', modules: ['workflows', 'analytics', 'intelligence'] },
  { id: 'platform', label: 'Platform', modules: ['integrations', 'security'] },
];
const PINNED_MODULES = [undefined, 'work', 'notifications'];
const STORAGE_KEY = 'devduo.nav.groups';

export function groupOf(item) {
  if (PINNED_MODULES.includes(item.module)) return null;
  return NAV_GROUPS.find((g) => g.modules.includes(item.module))?.id ?? NAV_GROUPS[NAV_GROUPS.length - 1].id;
}

/** The most specific nav item for a path (longest matching prefix), so '/leave/hr' beats '/leave'. */
export function activeItemFor(items, pathname) {
  return items
    .filter((x) => (x.to === '/' ? pathname === '/' : pathname === x.to || pathname.startsWith(`${x.to}/`)))
    .sort((a, b) => b.to.length - a.to.length)[0];
}

function readOpenMap() {
  try {
    const v = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export default function Layout() {
  const { session, can, enabled, logout } = useAuth(),
    [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [org, setOrg] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [query, setQuery] = useState(''),
    [openMap, setOpenMap] = useState(readOpenMap),
    [guideOpen, setGuideOpen] = useState(false);
  const location = useLocation(),
    navigate = useNavigate(),
    toast = useToast();
  const nav = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    ...(managerDestinations(can, enabled).length ? [{ to: '/manager', label: 'Manager dashboard', icon: UsersRound }] : []),
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
    { to: '/attendance/open-shifts', label: 'Open shifts', icon: CalendarCheck, permission: 'attendance.view', module: 'attendance' },
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
    { to: '/owner', label: 'Owner panel', icon: ShieldCheck, ownerOnly: true },
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
  const isOwner = Boolean(session.account?.is_owner);
  const isVisible = (item) => (!item.ownerOnly || isOwner) && can(item.permission) && enabled(item.module);
  const visible = [...nav, ...admin].filter(isVisible);
  const pinned = nav.filter((x) => groupOf(x) === null);
  const groups = nav.reduce((acc, x) => {
    const id = groupOf(x);
    if (id) (acc[id] ||= []).push(x);
    return acc;
  }, {});
  const activeItem = activeItemFor(visible, location.pathname);
  const activeGroupId = location.pathname.startsWith('/organization') ? 'people' : activeItem ? groupOf(activeItem) : null;
  const isOpen = (id) => (id in openMap ? Boolean(openMap[id]) : id === activeGroupId);
  const toggleGroup = (id) => {
    const next = { ...openMap, [id]: !isOpen(id) };
    setOpenMap(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage can be blocked; the menu still works for this visit */
    }
  };
  // Navigating into a section (from a link elsewhere) reveals it without losing the user's other choices.
  useEffect(() => {
    if (activeGroupId && openMap[activeGroupId] === false) setOpenMap((m) => ({ ...m, [activeGroupId]: true }));
  }, [activeGroupId]); // eslint-disable-line react-hooks/exhaustive-deps
  const isOrganizationPage = location.pathname.startsWith('/organization/');
  useEffect(() => {
    if (isOrganizationPage) setOrg(true);
  }, [isOrganizationPage]);
  const destinations = [
    ...visible,
    ...(can('organization.view')
      ? Object.entries(organizationTypes).map(([key, label]) => ({ to: `/organization/${key}`, label, icon: Building2 }))
      : []),
    // Module subpages and everyday names, so "payslip" or "salary" finds Payroll self-service.
    ...(visible.some((x) => x.to === '/payroll')
      ? [
          { to: '/payroll/my/payslips', label: 'My payslips', keywords: 'payslip pay slip salary wage payment' },
          { to: '/payroll/my/compensation', label: 'My compensation', keywords: 'salary pay ctc wage' },
          { to: '/payroll/my/benefits', label: 'My benefits' },
          { to: '/payroll/my/loans', label: 'My loans', keywords: 'advance' },
          { to: '/payroll/my/tax', label: 'My tax', keywords: 'tds declaration' },
        ].map((x) => ({ ...x, icon: payrollNavItem.icon }))
      : []),
    ...(enabled('notifications') ? [{ to: '/notifications', label: 'Notifications', icon: Bell }] : []),
    { to: '/security', label: 'Password & security', icon: LockKeyhole },
    { to: '/guide', label: 'Guide to your workspace', icon: CircleHelp, keywords: 'help tour how to what is' },
  ];
  const terms = query.trim().toLowerCase().split(/\s+/);
  const matches = destinations.filter((item) => {
    const searchable = `${item.label} ${item.keywords || ''} ${item.to.replaceAll(/[-/]/g, ' ')}`.toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
  };

  const item = (x) =>
    isVisible(x) && (
      <Link
        key={x.to}
        to={x.to}
        aria-current={activeItem?.to === x.to ? 'page' : undefined}
        aria-label={x.label}
        className={activeItem?.to === x.to ? 'active' : undefined}
        title={collapsed ? x.label : undefined}
        onClick={() => setMobile(false)}
      >
        <x.icon size={19} />
        <span className="workspace-nav-label">{x.label}</span>
      </Link>
    );
  const orgBlock = (
    <>
      <button
        type="button"
        className="my-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs text-slate-500 dark:text-slate-400 hover:bg-brand-50 dark:hover:bg-brand-950 [&>svg:last-child]:ml-auto group-data-[collapsed=true]/shell:[&>span]:hidden group-data-[collapsed=true]/shell:[&>svg:last-child]:hidden"
        onClick={() => {
          if (collapsed && !mobile) {
            setCollapsed(false);
            setOrg(true);
          } else setOrg(!org);
        }}
        aria-expanded={org}
      >
        <Building2 size={19} />
        <span>Organization</span>
        <ChevronDown size={14} />
      </button>
      {org && (!collapsed || mobile) && (
        <div className="mb-3 ml-5 mt-1 border-l border-slate-200 dark:border-slate-700 pl-4 [&>a]:block [&>a]:rounded [&>a]:px-2 [&>a]:py-1.5 [&>a]:text-[11px] [&>a]:text-slate-500 dark:[&>a]:text-slate-400 [&>a.active]:bg-brand-50 dark:[&>a.active]:bg-brand-950 [&>a.active]:font-semibold [&>a.active]:text-brand-700 dark:[&>a.active]:text-brand-300">
          {Object.entries(organizationTypes).map(([key, label]) => (
            <NavLink key={key} to={`/organization/${key}`} onClick={() => setMobile(false)}>
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </>
  );
  const navigation = (isMobile = false) => (
    <>
      <div className="mb-5 flex items-center gap-2.5 border-y border-slate-100 dark:border-slate-800 px-2 py-3 [&>div]:min-w-0 [&>div]:flex-1 [&_strong]:block [&_strong]:truncate [&_strong]:text-xs [&_small]:mt-1 [&_small]:block [&_small]:text-[10px] [&>svg]:text-slate-400 dark:[&>svg]:text-slate-400 group-data-[collapsed=true]/shell:hidden">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-brand-100 dark:border-brand-900 bg-brand-50 dark:bg-brand-950 text-sm font-semibold text-brand-600 dark:text-brand-300">
          {session.tenant.name.slice(0, 1)}
        </span>
        <div>
          <strong>{session.tenant.name}</strong>
          <small>Your workspace</small>
        </div>
      </div>
      <div className="mb-3 mt-1 px-3 text-[9px] font-semibold tracking-widest text-slate-400 dark:text-slate-400 group-data-[collapsed=true]/shell:hidden">
        WORKSPACE
      </div>
      <nav aria-label="Main navigation">{pinned.map(item)}</nav>
      {NAV_GROUPS.map((g) => {
        const items = (groups[g.id] || []).filter((x) => can(x.permission) && enabled(x.module));
        const showOrg = g.id === 'people' && can('organization.view');
        if (!items.length && !showOrg) return null;
        const open = (!isMobile && collapsed) || isOpen(g.id);
        const holdsActive = activeGroupId === g.id;
        return (
          <div key={g.id} className="mt-1 group-data-[collapsed=true]/shell:mt-2 group-data-[collapsed=true]/shell:border-t group-data-[collapsed=true]/shell:border-slate-100 group-data-[collapsed=true]/shell:pt-2 dark:group-data-[collapsed=true]/shell:border-slate-800">
            <button
              type="button"
              className={`mb-1 mt-2 flex w-full items-center justify-between rounded px-3 py-1.5 text-left text-[9px] font-semibold tracking-widest hover:bg-brand-50 dark:hover:bg-brand-950 group-data-[collapsed=true]/shell:hidden ${holdsActive ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400 dark:text-slate-400'}`}
              aria-expanded={open}
              aria-controls={`nav-group-${isMobile ? 'mobile' : 'desktop'}-${g.id}`}
              onClick={() => toggleGroup(g.id)}
            >
              <span className="workspace-group-label">{g.label.toUpperCase()}</span>
              <ChevronDown size={13} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
            </button>
            {open && (
              <nav id={`nav-group-${isMobile ? 'mobile' : 'desktop'}-${g.id}`} aria-label={g.label}>
                {items.map(item)}
                {showOrg && orgBlock}
              </nav>
            )}
          </div>
        );
      })}
      {admin.some(isVisible) && (
        <>
          <div className="mb-3 mt-1 px-3 text-[9px] font-semibold tracking-widest text-slate-400 dark:text-slate-400 group-data-[collapsed=true]/shell:hidden">
            ADMINISTRATION
          </div>
          <nav aria-label="Administration">{admin.map(item)}</nav>
        </>
      )}
    </>
  );
  const route = location.pathname.split('/').filter(Boolean);
  const crumb = route.map(
    (x) => organizationTypes[x] || x.replaceAll('-', ' ').replace(/^./, (c) => c.toUpperCase()),
  );
  return (
    <div className="group/shell flex min-h-screen" data-collapsed={collapsed}>
      <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 dark:focus:bg-slate-900">Skip to content</a>
      <aside aria-label="Workspace sidebar" className="workspace-sidebar fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 pb-4 min-[769px]:flex group-data-[collapsed=true]/shell:w-20 group-data-[collapsed=true]/shell:px-2 [&_nav>a]:my-0.5 [&_nav>a]:flex [&_nav>a]:items-center [&_nav>a]:gap-3 [&_nav>a]:rounded-lg [&_nav>a]:px-3 [&_nav>a]:py-3 [&_nav>a]:text-xs [&_nav>a]:text-slate-500 dark:[&_nav>a]:text-slate-400 [&_nav>a]:hover:bg-brand-50 dark:[&_nav>a]:hover:bg-brand-950 [&_nav>a.active]:bg-brand-100 dark:[&_nav>a.active]:bg-brand-900 [&_nav>a.active]:font-semibold [&_nav>a.active]:text-brand-700 dark:[&_nav>a.active]:text-brand-300 group-data-[collapsed=true]/shell:[&_nav>a>span]:hidden group-data-[collapsed=true]/shell:[&_nav>a]:justify-center">
        <div className="flex shrink-0 items-center justify-between gap-1 pb-4 pt-5 group-data-[collapsed=true]/shell:flex-col group-data-[collapsed=true]/shell:gap-2">
          <Brand sidebar />
          <Button
            variant="ghost"
            className="size-10 shrink-0 p-0!"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeftOpen size={19} aria-hidden="true" /> : <PanelLeftClose size={19} aria-hidden="true" />}
          </Button>
        </div>
        <div className="workspace-sidebar-scroll min-h-0 flex-1 overflow-y-auto pb-3">
          {navigation()}
        </div>
      </aside>
      <Drawer open={mobile} onClose={() => setMobile(false)} title="Your workspace">
        <div className="workspace-mobile-nav flex flex-col [&_nav>a]:my-0.5 [&_nav>a]:flex [&_nav>a]:items-center [&_nav>a]:gap-3 [&_nav>a]:rounded-lg [&_nav>a]:px-3 [&_nav>a]:py-3 [&_nav>a]:text-xs [&_nav>a]:text-slate-500 dark:[&_nav>a]:text-slate-400 [&_nav>a.active]:bg-brand-100 dark:[&_nav>a.active]:bg-brand-900 [&_nav>a.active]:text-brand-700 dark:[&_nav>a.active]:text-brand-300">
          {navigation(true)}
        </div>
      </Drawer>
      <div className="flex min-h-screen w-full min-w-0 flex-col min-[769px]:ml-60 min-[769px]:w-[calc(100%_-_15rem)] group-data-[collapsed=true]/shell:min-[769px]:ml-20 group-data-[collapsed=true]/shell:min-[769px]:w-[calc(100%_-_5rem)]">
        <TrialBanner />
        <header className="workspace-header sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-9 max-[769px]:h-16 max-[769px]:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Button
              variant="ghost"
              className="min-[769px]:hidden!"
              aria-label="Open navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </Button>
            <Breadcrumb items={crumb.length ? crumb : ['Overview']} />
          </div>
          <div className="flex shrink-0 items-center gap-3 max-sm:gap-1">
            <Button variant="ghost" className="px-2!" aria-label="Find a page" onClick={() => setSearchOpen(true)}>
              <Search size={18} aria-hidden="true" />
              <span className="hidden xl:inline">Find a page</span>
            </Button>
            <Button variant="ghost" className="px-2!" aria-label="About this page" title="About this page" onClick={() => setGuideOpen((v) => !v)}>
              <CircleHelp size={18} aria-hidden="true" />
              <span className="hidden xl:inline">About this page</span>
            </Button>
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
              label={session.user.name + " account menu"}
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
          id="workspace-content"
          tabIndex={-1}
          className="workspace-content mx-auto w-full min-w-0 max-w-[1530px] flex-1 px-8 pb-8 pt-6 max-xl:px-6 max-sm:px-4"
          key={location.pathname}
        >
          {location.pathname !== '/guide' && (
            <SectionIntro key={`${location.pathname}-${guideOpen}`} pathname={location.pathname} forceOpen={guideOpen} onClose={() => setGuideOpen(false)} />
          )}
          <Outlet />
        </main>
        <Modal open={searchOpen} onClose={closeSearch} title="Find a page">
          <SearchInput
            data-initial-focus
            placeholder="Search workspace pages"
            value={query}
            onChange={setQuery}
          />
          {matches.length ? (
            <ul className="mt-3 max-h-[46dvh] overflow-y-auto p-1">
              {matches.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <Link
                    to={to}
                    onClick={closeSearch}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-brand-50 dark:hover:bg-brand-950"
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                    <ArrowUpRight size={15} aria-hidden="true" className="ml-auto text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <EmptyState tour={false} title="No matching pages" description="Try a module or page name." />}
        </Modal>
      </div>
    </div>
  );
}
