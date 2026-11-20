import { Navigate, Outlet } from 'react-router-dom';
import SectionNav from '../../components/SectionNav';
import { useAuth } from '../../lib/auth';
import { NAV } from '../../lib/lifecycleApi';

/** Lifecycle shell: only sections the user may open. */
export default function LifecycleLayout() {
  const { can } = useAuth();
  const items = NAV.filter((n) => can(n.permission));
  return (
    <>
      <SectionNav label="Lifecycle sections" items={items} />
      <Outlet />
    </>
  );
}

export function LifecycleHome() {
  const { can } = useAuth();
  const first = NAV.find((n) => can(n.permission));
  return first ? <Navigate to={first.to} replace /> : null;
}
