import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { NAV } from '../../lib/performanceApi';

const link = 'block rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-500';
const active = 'bg-brand-500 text-white lg:bg-transparent lg:text-brand-700 lg:shadow-[inset_0_-2px_0] lg:shadow-brand-700 dark:lg:text-brand-300 dark:lg:shadow-brand-300';
const idle = 'text-slate-600 hover:bg-brand-50 dark:text-slate-300 dark:hover:bg-brand-950';

export default function PerformanceLayout() {
  const { can } = useAuth();
  const items = NAV.filter((item) => can(item.permission));
  return (
    <>
      <nav aria-label="Performance sections" className="mb-6 lg:border-b lg:border-slate-200 lg:dark:border-slate-700">
        <ul className="m-0 flex list-none gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:dark:bg-transparent">
          {items.map((item) => (
            <li key={item.to} className="shrink-0">
              <NavLink to={item.to} className={({ isActive }) => `${link} ${isActive ? active : idle}`}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </>
  );
}

export function PerformanceHome() {
  const { can } = useAuth();
  const first = NAV.find((item) => can(item.permission));
  return first ? <Navigate to={first.to} replace /> : null;
}
