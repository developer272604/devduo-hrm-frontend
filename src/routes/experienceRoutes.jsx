import { NavLink, Outlet, Route } from 'react-router-dom';
import { Headset } from 'lucide-react';
import Access from '../components/Access';
import { EXPERIENCE_ACCESS } from '../lib/experienceApi';
import { AnnouncementMetricsPage, AnnouncementsPage, CommunicationPreferencesPage, KnowledgeArticlePage, KnowledgePage, RecognitionPage, SurveyResultsPage, SurveysPage, TicketDetailPage, TicketListPage } from '../pages/experience/ExperiencePages';

function ExperienceLayout() { return <Access permission={EXPERIENCE_ACCESS} module="experience"><nav aria-label="Experience sections" className="mb-5 flex gap-4 border-b border-slate-200 pb-2 text-sm dark:border-slate-700"><NavLink to="/experience">HR requests</NavLink><NavLink to="/experience/knowledge">Knowledge base</NavLink><NavLink to="/experience/announcements">Announcements</NavLink><NavLink to="/experience/surveys">Surveys</NavLink><NavLink to="/experience/recognition">Recognition</NavLink><NavLink to="/experience/preferences">Preferences</NavLink></nav><Outlet /></Access>; }

export const experienceRoutes = <Route path="experience" element={<ExperienceLayout />}>
  <Route index element={<TicketListPage />} />
  <Route path="knowledge" element={<KnowledgePage />} />
  <Route path="knowledge/:uuid" element={<KnowledgeArticlePage />} />
  <Route path="announcements" element={<AnnouncementsPage />} />
  <Route path="announcements/:uuid/metrics" element={<AnnouncementMetricsPage />} />
  <Route path="surveys" element={<SurveysPage />} />
  <Route path="surveys/:uuid/results" element={<SurveyResultsPage />} />
  <Route path="recognition" element={<RecognitionPage />} />
  <Route path="preferences" element={<CommunicationPreferencesPage />} />
  <Route path="tickets/:uuid" element={<TicketDetailPage />} />
</Route>;
export const experienceNavItem = { to: '/experience', label: 'HR Service Desk', icon: Headset, permission: EXPERIENCE_ACCESS, module: 'experience' };
