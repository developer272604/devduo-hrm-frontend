import { Outlet } from 'react-router-dom';
import SectionNav from '../../components/SectionNav';
import { useAuth } from '../../lib/auth';
import { NAV } from '../../lib/timeOfficeApi';

/** Time Office shell: section navigation (only sections the user may open) + the active section. */
export default function TimeOfficeLayout() {
  const { can } = useAuth();
  const items = NAV.filter((n) => can(n.permission));
  return (
    <>
      <SectionNav label="Time office sections" items={items} />
      <Outlet />
    </>
  );
}
