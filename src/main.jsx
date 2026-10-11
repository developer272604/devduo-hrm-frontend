import React from 'react';
import { ThemeProvider } from './lib/theme';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  Link,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider, Skeleton, ErrorState, EmptyState, Button } from './components/ui';
import Layout from './components/Layout';
import { AuthPage, SecurityPage } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Organization from './pages/Organization';
import { UsersPage, RolesPage } from './pages/Access';
import WorkPage from './pages/Work';
import { NotificationsPage, AuditPage } from './pages/Feeds';
import { SettingsPage, SetupPage } from './pages/Settings';
import './tailwind.css';
import { peopleRoutes } from './routes/peopleRoutes';
import { attendanceRoutes } from './routes/attendanceRoutes';
import { leaveRoutes } from './routes/leaveRoutes';
import { leaveHrRoutes } from './routes/leaveHrRoutes';
import { payrollRoutes } from './routes/payrollRoutes';
import { recruitmentRoutes } from './routes/recruitmentRoutes';
import CareersPage from './pages/recruitment/CareersPage';
import CandidatePortalPage from './pages/recruitment/CandidatePortalPage';
import { lifecycleRoutes } from './routes/lifecycleRoutes';
import { performanceRoutes } from './routes/performanceRoutes';
import { learningRoutes } from './routes/learningRoutes';
import { experienceRoutes } from './routes/experienceRoutes';
import { operationsRoutes } from './routes/operationsRoutes';
import { automationRoutes } from './routes/automationRoutes';
import { enterpriseRoutes } from './routes/enterpriseRoutes';
function Protected() {
  const { session, loading, error, refresh } = useAuth(),
    location = useLocation();
  if (loading)
    return (
      <div className="mx-auto mt-[15vh] max-w-175">
        <Skeleton rows={3} />
      </div>
    );
  if (error) return <ErrorState error={error} onRetry={refresh} />;
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <Outlet />;
}
function Access({ permission, module, children }) {
  const { can, enabled } = useAuth();
  if (!can(permission) || !enabled(module))
    return (
      <ErrorState
        error={{
          status: 403,
          message:
            'Your role or workspace settings do not allow access to this page. Contact your administrator.',
        }}
      />
    );
  return children;
}
class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <ErrorState
        error={{ message: 'The page encountered an unexpected problem. Reload to try again.' }}
        onRetry={() => window.location.reload()}
      />
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <Routes>
                <Route path="/careers/:workspace" element={<CareersPage />} />
                <Route path="/careers/:workspace/portal" element={<CandidatePortalPage />} />
                <Route path="/login" element={<AuthPage />} />
                <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
                <Route path="/reset-password" element={<AuthPage mode="reset" />} />
                <Route
                  path="/unauthorized"
                  element={
                    <EmptyState
                      title="Sign in to continue"
                      description="This page requires a workspace account."
                      action={
                        <Link
                          to="/login"
                          className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-4 py-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-brand-500 text-white shadow-sm hover:bg-brand-600"
                        >
                          Sign in
                        </Link>
                      }
                    />
                  }
                />
                <Route element={<Protected />}>
                  <Route element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    {peopleRoutes}
                    {attendanceRoutes}
                    {leaveRoutes}
                    {leaveHrRoutes}
                    {payrollRoutes}
                    {recruitmentRoutes}
                    {lifecycleRoutes}
                    {performanceRoutes}
                    {learningRoutes}
                    {experienceRoutes}
                    {operationsRoutes}
                    {automationRoutes}
                    {enterpriseRoutes}
                    <Route
                      path="my-work"
                      element={
                        <Access permission="work.view" module="work">
                          <WorkPage />
                        </Access>
                      }
                    />
                    <Route
                      path="organization/:type"
                      element={
                        <Access permission="organization.view">
                          <Organization />
                        </Access>
                      }
                    />
                    <Route
                      path="users"
                      element={
                        <Access permission="users.view">
                          <UsersPage />
                        </Access>
                      }
                    />
                    <Route
                      path="roles"
                      element={
                        <Access permission="roles.manage">
                          <RolesPage />
                        </Access>
                      }
                    />
                    <Route path="permissions" element={<Navigate to="/roles" replace />} />
                    <Route
                      path="notifications"
                      element={
                        <Access module="notifications">
                          <NotificationsPage />
                        </Access>
                      }
                    />
                    <Route
                      path="audit"
                      element={
                        <Access permission="audit.view">
                          <AuditPage />
                        </Access>
                      }
                    />
                    <Route
                      path="settings"
                      element={
                        <Access permission="settings.manage">
                          <SettingsPage />
                        </Access>
                      }
                    />
                    <Route
                      path="setup"
                      element={
                        <Access permission="settings.manage">
                          <SetupPage />
                        </Access>
                      }
                    />
                    <Route path="security" element={<SecurityPage />} />
                    <Route
                      path="forbidden"
                      element={
                        <ErrorState
                          error={{
                            status: 403,
                            message: 'Contact your workspace administrator for access.',
                          }}
                        />
                      }
                    />
                    <Route
                      path="*"
                      element={
                        <EmptyState
                          title="This page isn’t here"
                          description="The page may have moved or the address may be incorrect."
                          action={
                            <Link
                              to="/"
                              className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-4 py-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-brand-500 text-white shadow-sm hover:bg-brand-600"
                            >
                              Back to overview
                            </Link>
                          }
                        />
                      }
                    />
                  </Route>
                </Route>
              </Routes>
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
