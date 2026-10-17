import { Route } from 'react-router-dom';
import { Workflow, ChartNoAxesCombined, TrendingUp } from 'lucide-react';
import {
  WorkflowsPage,
  WorkflowDefinitionPage,
  WorkflowInstancePage,
  AnalyticsPage,
} from '../pages/automation/AutomationPages';
import { ImpactPage } from '../pages/automation/ImpactPage';
export const automationRoutes = (
  <>
    <Route path="workflows" element={<WorkflowsPage />} />
    <Route path="workflows/definitions/:uuid" element={<WorkflowDefinitionPage />} />
    <Route path="workflows/instances/:uuid" element={<WorkflowInstancePage />} />
    <Route path="analytics" element={<AnalyticsPage />} />
    <Route path="analytics/impact" element={<ImpactPage />} />
  </>
);
export const automationNavItems = [
  {
    to: '/workflows',
    label: 'Workflows',
    icon: Workflow,
    permission: 'workflows.manage|workflows.act|workflows.run',
    module: 'workflows',
  },
  {
    to: '/analytics',
    label: 'Analytics',
    icon: ChartNoAxesCombined,
    permission: 'analytics.view',
    module: 'analytics',
  },
  {
    to: '/analytics/impact',
    label: 'Business impact',
    icon: TrendingUp,
    permission: 'analytics.impact.view',
    module: 'analytics',
  },
];
