import { Route } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import Access from '../components/Access';
import LearningLayout, { LearningHome } from '../pages/learning/LearningLayout';
import { CatalogPage, MyLearningPage, MySkillsPage, PathsPage } from '../pages/learning/LearningPages';
import { AssessmentPage, CertificatesPage, CompliancePage, DashboardPage, SkillsAdminPage, TeamLearningPage, TeamSkillsPage } from '../pages/learning/LearningManagePages';
import { LEARNING_ACCESS } from '../lib/learningApi';

export const learningRoutes = <Route path="learning" element={<Access permission={LEARNING_ACCESS} module="learning"><LearningLayout /></Access>}>
  <Route index element={<LearningHome />} />
  <Route path="catalog" element={<CatalogPage />} />
  <Route path="my" element={<MyLearningPage />} />
  <Route path="paths" element={<PathsPage />} />
  <Route path="skills" element={<MySkillsPage />} />
  <Route path="team" element={<TeamLearningPage />} />
  <Route path="compliance" element={<CompliancePage />} />
  <Route path="certificates" element={<CertificatesPage />} />
  <Route path="assessment/:courseUuid" element={<AssessmentPage />} />
  <Route path="team-skills" element={<TeamSkillsPage />} />
  <Route path="skills-admin" element={<SkillsAdminPage />} />
  <Route path="dashboard" element={<DashboardPage />} />
</Route>;

export const learningNavItem = { to: '/learning', label: 'Learning', icon: BookOpen, permission: LEARNING_ACCESS, module: 'learning' };
export const NAV = [
  { to: '/learning/catalog', label: 'Course catalog', permission: 'learning.self|learning.view|learning.catalog.manage' },
  { to: '/learning/my', label: 'My learning', permission: 'learning.self' },
  { to: '/learning/paths', label: 'Learning paths', permission: 'learning.self|learning.view|learning.catalog.manage' },
  { to: '/learning/skills', label: 'My skills', permission: 'learning.self' },
  { to: '/learning/certificates', label: 'Certificates', permission: 'learning.self|learning.view|learning.catalog.manage' },
  { to: '/learning/team', label: 'Team learning', permission: 'learning.enrol.manage|learning.enrol.approve|learning.view' },
  { to: '/learning/compliance', label: 'Compliance', permission: 'learning.assign.manage|learning.view' },
  { to: '/learning/team-skills', label: 'Team skills', permission: 'learning.view|learning.skills.validate' },
  { to: '/learning/skills-admin', label: 'Skills admin', permission: 'learning.skills.manage' },
  { to: '/learning/dashboard', label: 'Dashboard', permission: 'learning.reports.view|learning.view' },
];
