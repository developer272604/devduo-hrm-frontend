import { Route } from 'react-router-dom';
import { Activity } from 'lucide-react';
import Access from '../components/Access';
import PerformanceLayout, { PerformanceHome } from '../pages/performance/PerformanceLayout';
import { CyclesPage, GoalsPage, PerformanceDashboardPage, ReviewDetailPage, ReviewsPage } from '../pages/performance/PerformancePages';
import { PERFORMANCE_ACCESS } from '../lib/performanceApi';

export const performanceRoutes = (
  <Route path="performance" element={<Access permission={PERFORMANCE_ACCESS} module="performance"><PerformanceLayout /></Access>}>
    <Route index element={<PerformanceHome />} />
    <Route path="goals" element={<GoalsPage />} />
    <Route path="reviews" element={<ReviewsPage />} />
    <Route path="reviews/:uuid" element={<ReviewDetailPage />} />
    <Route path="cycles" element={<CyclesPage />} />
    <Route path="dashboard" element={<PerformanceDashboardPage />} />
  </Route>
);

export const performanceNavItem = {
  to: '/performance', label: 'Performance', icon: Activity, permission: PERFORMANCE_ACCESS, module: 'performance',
};
