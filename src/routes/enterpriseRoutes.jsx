import { Route } from 'react-router-dom';
import { ArrowRightLeft, FileSearch, Gavel, Plug, Settings2, ShieldCheck, Sparkles } from 'lucide-react';
import {
  AccessReviewsPage,
  IntegrationsPage,
} from '../pages/enterprise/EnterprisePages';
import { IntelligenceCenterPage } from '../pages/intelligence/IntelligenceCenterPage';
import { MigrationStudioPage } from '../pages/enterprise/MigrationStudioPage';
import { AuditReviewPage, LegalHoldPage, SecuritySettingsPage } from '../pages/security/SecurityAdminPages';
import {
  ApiClientsPage,
  ImportProfilesPage,
  IntegrationHealthPage,
  WebhooksPage,
} from '../pages/enterprise/PlatformPages';

export const enterpriseRoutes = (
  <>
    <Route path="integrations" element={<IntegrationsPage />} />
    <Route path="integrations/health" element={<IntegrationHealthPage />} />
    <Route path="integrations/api-clients" element={<ApiClientsPage />} />
    <Route path="integrations/webhooks" element={<WebhooksPage />} />
    <Route path="integrations/imports" element={<ImportProfilesPage />} />
    <Route path="integrations/migration" element={<MigrationStudioPage />} />
    <Route path="security/access-reviews" element={<AccessReviewsPage />} />
    <Route path="security/settings" element={<SecuritySettingsPage />} />
    <Route path="security/audit" element={<AuditReviewPage />} />
    <Route path="security/legal-holds" element={<LegalHoldPage />} />
    <Route path="intelligence" element={<IntelligenceCenterPage />} />
  </>
);

export const enterpriseNavItems = [
  {
    to: '/integrations/health',
    label: 'Integrations',
    icon: Plug,
    permission: 'integrations.view|integrations.manage',
    module: 'integrations',
  },
  {
    to: '/integrations/migration',
    label: 'Migration Studio',
    icon: ArrowRightLeft,
    permission: 'integrations.migration.view',
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
    to: '/security/settings',
    label: 'Security settings',
    icon: Settings2,
    permission: 'security.settings.manage',
    module: 'security',
  },
  {
    to: '/security/audit',
    label: 'Audit review',
    icon: FileSearch,
    permission: 'security.audit.view',
    module: 'security',
  },
  {
    to: '/security/legal-holds',
    label: 'Legal holds',
    icon: Gavel,
    permission: 'security.legal_hold.manage|security.retention.manage',
    module: 'security',
  },
  {
    to: '/intelligence',
    label: 'Intelligence Center',
    icon: Sparkles,
    permission: 'intelligence.view',
    module: 'intelligence',
  },
];
