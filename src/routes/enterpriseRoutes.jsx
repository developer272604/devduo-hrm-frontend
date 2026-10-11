import { Route } from 'react-router-dom';
import { Plug, ShieldCheck, Sparkles } from 'lucide-react';
import {
  AccessReviewsPage,
  FindingsPage,
  IntegrationsPage,
} from '../pages/enterprise/EnterprisePages';

export const enterpriseRoutes = (
  <>
    <Route path="integrations" element={<IntegrationsPage />} />
    <Route path="security/access-reviews" element={<AccessReviewsPage />} />
    <Route path="intelligence" element={<FindingsPage />} />
  </>
);

export const enterpriseNavItems = [
  {
    to: '/integrations',
    label: 'Integrations',
    icon: Plug,
    permission: 'integrations.view|integrations.manage',
    module: 'integrations',
  },
  {
    to: '/security/access-reviews',
    label: 'Access reviews',
    icon: ShieldCheck,
    permission: 'security.access_reviews.view|security.access_reviews.manage',
    module: 'security',
  },
  {
    to: '/intelligence',
    label: 'HRMS findings',
    icon: Sparkles,
    permission: 'intelligence.view',
    module: 'intelligence',
  },
];
