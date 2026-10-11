import { Route } from 'react-router-dom';
import { UsersRound } from 'lucide-react';
import Access from '../components/Access';
import RecruitmentLayout, { RecruitmentHome } from '../pages/recruitment/RecruitmentLayout';
import { RequisitionsPage, PostingsPage } from '../pages/recruitment/HiringPages';
import { CandidatesPage, CandidateProfilePage } from '../pages/recruitment/CandidatePages';
import CandidateImportPage from '../pages/recruitment/CandidateImportPage';
import { PipelineIndexPage, PipelinePage } from '../pages/recruitment/PipelinePages';
import PipelineAdminPage from '../pages/recruitment/PipelineAdminPage';
import InterviewsPage from '../pages/recruitment/InterviewsPage';
import OffersPage from '../pages/recruitment/OffersPage';
import OfferTemplatesPage from '../pages/recruitment/OfferTemplatesPage';
import AnalyticsPage from '../pages/recruitment/AnalyticsPage';
import { RECRUITMENT_ACCESS } from '../lib/recruitmentApi';

/** Recruitment routes (spread inside the authenticated layout route). Each page enforces its own permission. */
export const recruitmentRoutes = (
  <Route
    path="recruitment"
    element={
      <Access permission={RECRUITMENT_ACCESS} module="recruitment">
        <RecruitmentLayout />
      </Access>
    }
  >
    <Route index element={<RecruitmentHome />} />
    <Route path="analytics" element={<AnalyticsPage />} />
    <Route path="requisitions" element={<RequisitionsPage />} />
    <Route path="postings" element={<PostingsPage />} />
    <Route path="candidates" element={<CandidatesPage />} />
    <Route path="candidates/import" element={<CandidateImportPage />} />
    <Route path="candidates/:uuid" element={<CandidateProfilePage />} />
    <Route path="pipeline" element={<PipelineIndexPage />} />
    <Route path="pipeline/:uuid" element={<PipelinePage />} />
    <Route path="pipelines" element={<PipelineAdminPage />} />
    <Route path="interviews" element={<InterviewsPage />} />
    <Route path="offers" element={<OffersPage />} />
    <Route path="offer-templates" element={<OfferTemplatesPage />} />
  </Route>
);

/** Sidebar entry, permission gated like every other module. */
export const recruitmentNavItem = { to: '/recruitment', label: 'Recruitment', icon: UsersRound, permission: RECRUITMENT_ACCESS, module: 'recruitment' };
