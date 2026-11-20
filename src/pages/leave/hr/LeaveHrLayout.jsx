import { Outlet } from 'react-router-dom';
import SectionNav from '../../../components/SectionNav';
import { useAuth } from '../../../lib/auth';
import { NAV } from '../../../lib/leaveHrApi';

/** Leave operations shell: section navigation (only sections the user may open) + the active section. */
export default function LeaveHrLayout() {
  const { can } = useAuth();
  const items = NAV.filter((n) => can(n.permission));
  return (
    <>
      <SectionNav label="Leave operations sections" items={items} />
      <Outlet />
    </>
  );
}
