import { Navigate, Outlet } from 'react-router-dom';
import SectionNav from '../../components/SectionNav';
import { useAuth } from '../../lib/auth';
import { NAV } from '../../lib/performanceApi';

export default function PerformanceLayout() {
  const { can } = useAuth();
  const items = NAV.filter((item) => can(item.permission));
  return (
    <>
      <SectionNav label="Performance sections" items={items} />
      <Outlet />
    </>
  );
}

export function PerformanceHome() {
  const { can } = useAuth();
  const first = NAV.find((item) => can(item.permission));
  return first ? <Navigate to={first.to} replace /> : null;
}
