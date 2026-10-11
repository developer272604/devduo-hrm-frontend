import { Route } from 'react-router-dom';
import { ScrollText } from 'lucide-react';
import Access from '../components/Access';
import PayrollLayout, { PayrollHome } from '../pages/payroll/PayrollLayout';
import { CommandCenterPage, ReadinessPage } from '../pages/payroll/OverviewPages';
import { MyPayslipsPage, MyPayslipDetailPage, MyCompensationPage, MyBenefitsPage, MyLoansPage, MyTaxPage } from '../pages/payroll/SelfPages';
import { GroupsPage, PeriodsPage } from '../pages/payroll/SetupPages';
import CompensationPage from '../pages/payroll/CompensationPage';
import { ComponentsPage, StructuresPage } from '../pages/payroll/ComponentPages';
import CountryPacksPage from '../pages/payroll/CountryPacksPage';
import RunsPage from '../pages/payroll/RunsPage';
import RunDetailPage from '../pages/payroll/RunDetailPage';
import EmployeeResultPage from '../pages/payroll/EmployeeResultPage';
import { PaymentsPage, PaymentDetailPage } from '../pages/payroll/PaymentsPages';
import AccountingPage from '../pages/payroll/AccountingPage';
import ReportsPage from '../pages/payroll/ReportsPage';
import SettlementPage from '../pages/payroll/SettlementPage';
import BenefitsAdminPage from '../pages/payroll/BenefitsAdminPage';
import { PAYROLL_ACCESS } from '../lib/payrollApi';

export { PAYROLL_ACCESS };

/** Payroll routes (spread inside the authenticated layout route). Each page enforces its own permission. */
export const payrollRoutes = (
  <Route
    path="payroll"
    element={
      <Access permission={PAYROLL_ACCESS} module="payroll">
        <PayrollLayout />
      </Access>
    }
  >
    <Route index element={<PayrollHome />} />
    <Route path="overview" element={<CommandCenterPage />} />
    <Route path="readiness" element={<ReadinessPage />} />
    <Route path="my/payslips" element={<MyPayslipsPage />} />
    <Route path="my/payslips/:uuid" element={<MyPayslipDetailPage />} />
    <Route path="my/compensation" element={<MyCompensationPage />} />
    <Route path="my/loans" element={<MyLoansPage />} />
    <Route path="my/benefits" element={<MyBenefitsPage />} />
    <Route path="benefits" element={<BenefitsAdminPage />} />
    <Route path="my/tax" element={<MyTaxPage />} />
    <Route path="groups" element={<GroupsPage />} />
    <Route path="periods" element={<PeriodsPage />} />
    <Route path="compensation" element={<CompensationPage />} />
    <Route path="components" element={<ComponentsPage />} />
    <Route path="structures" element={<StructuresPage />} />
    <Route path="country-packs" element={<CountryPacksPage />} />
    <Route path="runs" element={<RunsPage />} />
    <Route path="runs/:uuid" element={<RunDetailPage />} />
    <Route path="runs/:uuid/employees/:employeeUuid" element={<EmployeeResultPage />} />
    <Route path="payments" element={<PaymentsPage />} />
    <Route path="payments/:uuid" element={<PaymentDetailPage />} />
    <Route path="accounting" element={<AccountingPage />} />
    <Route path="reports" element={<ReportsPage />} />
    <Route path="settlement" element={<SettlementPage />} />
  </Route>
);

/** Sidebar entry, permission gated like every other module. */
export const payrollNavItem = { to: '/payroll', label: 'Payroll', icon: ScrollText, permission: PAYROLL_ACCESS, module: 'payroll' };
