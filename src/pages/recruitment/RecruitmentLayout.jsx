import { Navigate, Outlet } from 'react-router-dom';
import SectionNav from '../../components/SectionNav';
import { useAuth } from '../../lib/auth';
import { NAV } from '../../lib/recruitmentApi';

/** Recruitment shell: section navigation (only sections the user may open) + the active section. */
export default function RecruitmentLayout() {
  const { can } = useAuth();
  const items = NAV.filter((n) => can(n.permission));
  return (
    <>
      <SectionNav label="Recruitment sections" items={items} />
      <Outlet />
    </>
  );
}

/** /recruitment lands on the first section the user may open. */
export function RecruitmentHome() {
  const { can } = useAuth();
  const first = NAV.find((n) => can(n.permission));
  return first ? <Navigate to={first.to} replace /> : null;
}
