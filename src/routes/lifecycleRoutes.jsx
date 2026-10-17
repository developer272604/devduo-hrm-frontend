import { Route } from 'react-router-dom';
import { UserCheck } from 'lucide-react';
import Access from '../components/Access';
import LifecycleLayout, { LifecycleHome } from '../pages/lifecycle/LifecycleLayout';
import { MyTasksPage, ExitInterviewPage } from '../pages/lifecycle/MyPages';
import { DashboardPage, PreboardersPage } from '../pages/lifecycle/DashboardPages';
import TemplatesPage from '../pages/lifecycle/TemplatesPage';
import { CasesPage, CaseDetailPage } from '../pages/lifecycle/CasePages';
import MovesPage from '../pages/lifecycle/MovesPage';
import AlumniPage from '../pages/lifecycle/AlumniPage';
import ResignationsPage from '../pages/lifecycle/ResignationsPage';
import ReturnsPage from '../pages/lifecycle/ReturnsPage';
import ContinuityPage from '../pages/lifecycle/ContinuityPage';
import { LIFECYCLE_ACCESS } from '../lib/lifecycleApi';

/** Lifecycle routes (spread inside the authenticated layout route). Each page enforces its own permission. */
export const lifecycleRoutes = (
  <Route
    path="lifecycle"
    element={
      <Access permission={LIFECYCLE_ACCESS} module="lifecycle">
        <LifecycleLayout />
      </Access>
    }
  >
    <Route index element={<LifecycleHome />} />
    <Route path="my" element={<MyTasksPage />} />
    <Route path="resignations" element={<ResignationsPage />} />
    <Route path="resignation-review" element={<ResignationsPage review />} />
    <Route path="returns" element={<ReturnsPage />} />
    <Route path="exit-interview" element={<ExitInterviewPage />} />
    <Route path="dashboard" element={<DashboardPage />} />
    <Route path="cases" element={<CasesPage />} />
    <Route path="cases/:uuid" element={<CaseDetailPage />} />
    <Route path="preboarders" element={<PreboardersPage />} />
    <Route path="templates" element={<TemplatesPage />} />
    <Route path="moves" element={<MovesPage />} />
    <Route path="alumni" element={<AlumniPage />} />
    <Route path="continuity" element={<ContinuityPage />} />
  </Route>
);

export const lifecycleNavItem = {
  to: '/lifecycle',
  label: 'Lifecycle',
  icon: UserCheck,
  permission: LIFECYCLE_ACCESS,
  module: 'lifecycle',
};
