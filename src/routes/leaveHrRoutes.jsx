import { Route } from 'react-router-dom';
import Access from '../components/Access';
import LeaveHrLayout from '../pages/leave/hr/LeaveHrLayout';
import CommandCenter from '../pages/leave/hr/CommandCenter';
import LeaveTypesPage from '../pages/leave/hr/LeaveTypesPage';
import PoliciesPage from '../pages/leave/hr/PoliciesPage';
import PolicyDetailPage from '../pages/leave/hr/PolicyDetailPage';
import CyclesPage from '../pages/leave/hr/CyclesPage';
import AccrualRunsPage from '../pages/leave/hr/AccrualRunsPage';
import AdjustmentsPage from '../pages/leave/hr/AdjustmentsPage';
import CarryForwardPage from '../pages/leave/hr/CarryForwardPage';
import CompOffPage from '../pages/leave/hr/CompOffPage';
import ImportsPage from '../pages/leave/hr/ImportsPage';
import LocksPage from '../pages/leave/hr/LocksPage';
import TransfersPage from '../pages/leave/hr/TransfersPage';
import PayrollPage from '../pages/leave/hr/PayrollPage';
import SimulationsPage from '../pages/leave/hr/SimulationsPage';
import ReportsPage from '../pages/leave/hr/ReportsPage';
import QualityPage from '../pages/leave/hr/QualityPage';
import SettingsPage from '../pages/leave/hr/SettingsPage';
import BulkActionsPage from '../pages/leave/hr/BulkActionsPage';
import { LEAVE_HR_ACCESS } from '../lib/leaveHrApi';

export { LEAVE_HR_ACCESS };

/** Leave HR operations centre routes (spread inside the authenticated layout route). Pages enforce their own permission. */
export const leaveHrRoutes = (
  <Route
    path="leave/hr"
    element={
      <Access permission={LEAVE_HR_ACCESS} module="leave">
        <LeaveHrLayout />
      </Access>
    }
  >
    <Route index element={<CommandCenter />} />
    <Route path="types" element={<LeaveTypesPage />} />
    <Route path="policies" element={<PoliciesPage />} />
    <Route path="policies/:uuid" element={<PolicyDetailPage />} />
    <Route path="cycles" element={<CyclesPage />} />
    <Route path="accruals" element={<AccrualRunsPage />} />
    <Route path="adjustments" element={<AdjustmentsPage />} />
    <Route path="carry-forward" element={<CarryForwardPage />} />
    <Route path="comp-off" element={<CompOffPage />} />
    <Route path="imports" element={<ImportsPage />} />
    <Route path="locks" element={<LocksPage />} />
    <Route path="transfers" element={<TransfersPage />} />
    <Route path="payroll" element={<PayrollPage />} />
    <Route path="simulations" element={<SimulationsPage />} />
    <Route path="reports" element={<ReportsPage />} />
    <Route path="quality" element={<QualityPage />} />
    <Route path="settings" element={<SettingsPage />} />
    <Route path="bulk-actions" element={<BulkActionsPage />} />
  </Route>
);
