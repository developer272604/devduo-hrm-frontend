import { Navigate, Outlet } from 'react-router-dom';
import SectionNav from '../../components/SectionNav';
import { useAuth } from '../../lib/auth';
import { NAV } from '../../lib/payrollApi';

/** Payroll shell: section navigation (only sections the user may open) + the active section. */
export default function PayrollLayout() {
  const { can } = useAuth();
  const items = NAV.filter((n) => can(n.permission));
  return (
    <>
      <SectionNav label="Payroll sections" items={items} />
      <Outlet />
    </>
  );
}

/** /payroll lands on the first section the user may open. */
export function PayrollHome() {
  const { can } = useAuth();
  const first = NAV.find((n) => can(n.permission));
  return first ? <Navigate to={first.to} replace /> : null;
}
