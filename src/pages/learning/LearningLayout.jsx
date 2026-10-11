import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { NAV } from '../../routes/learningRoutes';

export default function LearningLayout() {
  const { can } = useAuth();
  const items = NAV.filter((n) => can(n.permission));
  return <>
    <nav aria-label="Learning sections" className="mb-6 border-b border-slate-200 dark:border-slate-700">
      <ul className="m-0 flex list-none gap-1 overflow-x-auto p-1">
        {items.map((n) => <li key={n.to}><NavLink className={({ isActive }) => `block rounded-lg px-3 py-2 text-xs font-medium ${isActive ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-brand-50 dark:text-slate-300'}`} to={n.to}>{n.label}</NavLink></li>)}
      </ul>
    </nav>
    <Outlet />
  </>;
}

export function LearningHome() {
  const { can } = useAuth();
  return <Navigate to={NAV.find((n) => can(n.permission))?.to ?? '/learning/catalog'} replace />;
}
