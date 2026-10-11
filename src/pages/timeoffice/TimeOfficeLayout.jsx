import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { NAV } from '../../lib/timeOfficeApi';

const base = 'whitespace-nowrap px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-500';
const active = 'bg-brand-500 text-white lg:bg-transparent lg:text-brand-700 lg:shadow-[inset_0_-2px_0] lg:shadow-brand-700 dark:lg:text-brand-300 dark:lg:shadow-brand-300';
const idle = 'text-slate-600 hover:bg-brand-50 dark:text-slate-300 dark:hover:bg-brand-950';

/** Time Office shell: section navigation (only sections the user may open) + the active section. */
export default function TimeOfficeLayout() {
  const { can } = useAuth();
  const items = NAV.filter((n) => can(n.permission));
  return (
    <>
      <nav aria-label="Time office sections" className="mb-6 border-b-0 lg:border-b lg:border-slate-200 lg:dark:border-slate-700">
        <ul className="m-0 flex list-none gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900 lg:gap-2 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:dark:bg-transparent">
          {items.map((n) => (
            <li key={n.to} className="shrink-0">
              <NavLink to={n.to} end={n.end} className={({ isActive }) => `block rounded-lg lg:rounded-none ${base} ${isActive ? active : idle}`}>
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </>
  );
}
