import { Route } from 'react-router-dom';
import { Activity } from 'lucide-react';
import Access from '../components/Access';
import PerformanceLayout, { PerformanceHome } from '../pages/performance/PerformanceLayout';
import { GoalsPage, PerformanceDashboardPage, ReviewDetailPage, ReviewsPage } from '../pages/performance/PerformancePages';
import { ConfigurationPage, CyclesPage } from '../pages/performance/ConfigPages';
import { CalibrationPage } from '../pages/performance/CalibrationPage';
import { DevelopmentPage, FeedbackPage, OneOnOnesPage } from '../pages/performance/CollabPages';
import { PipDetailPage, PipsPage } from '../pages/performance/PipPages';
import { PERFORMANCE_ACCESS } from '../lib/performanceApi';

export const performanceRoutes = (
  <Route path="performance" element={<Access permission={PERFORMANCE_ACCESS} module="performance"><PerformanceLayout /></Access>}>
    <Route index element={<PerformanceHome />} />
    <Route path="goals" element={<GoalsPage />} />
    <Route path="reviews" element={<ReviewsPage />} />
    <Route path="reviews/:uuid" element={<ReviewDetailPage />} />
    <Route path="feedback" element={<FeedbackPage />} />
    <Route path="one-on-ones" element={<OneOnOnesPage />} />
    <Route path="development" element={<DevelopmentPage />} />
    <Route path="calibration" element={<CalibrationPage />} />
    <Route path="cycles" element={<CyclesPage />} />
    <Route path="configuration" element={<ConfigurationPage />} />
    <Route path="pips" element={<PipsPage />} />
    <Route path="pips/:uuid" element={<PipDetailPage />} />
    <Route path="dashboard" element={<PerformanceDashboardPage />} />
  </Route>
);

export const performanceNavItem = {
  to: '/performance', label: 'Performance', icon: Activity, permission: PERFORMANCE_ACCESS, module: 'performance',
};
