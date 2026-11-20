import { Navigate, Outlet } from 'react-router-dom';
import SectionNav from '../../components/SectionNav';
import { useAuth } from '../../lib/auth';
import { NAV } from '../../routes/learningRoutes';

export default function LearningLayout() {
  const { can } = useAuth();
  const items = NAV.filter((n) => can(n.permission));
  return <>
    <SectionNav label="Learning sections" items={items} />
    <Outlet />
  </>;
}

export function LearningHome() {
  const { can } = useAuth();
  return <Navigate to={NAV.find((n) => can(n.permission))?.to ?? '/learning/catalog'} replace />;
}
