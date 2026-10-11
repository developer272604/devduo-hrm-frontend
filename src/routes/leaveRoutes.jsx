import { Route } from 'react-router-dom';
import { CalendarDays, CalendarHeart, ClipboardCheck, UsersRound } from 'lucide-react';
import Access from '../components/Access';
import MyLeave from '../pages/leave/my/MyLeave';
import NewLeaveRequest from '../pages/leave/my/NewLeaveRequest';
import RequestDetailPage from '../pages/leave/my/RequestDetailPage';
import TeamLeave from '../pages/leave/team/TeamLeave';
import Approvals from '../pages/leave/team/Approvals';
import TeamCalendarPage from '../pages/leave/team/TeamCalendarPage';

const gate = (permission, element) => (
  <Access permission={permission} module="leave">
    {element}
  </Access>
);

/** Employee + manager leave routes (spread inside the authenticated layout route). HR operations live in leaveHrRoutes. */
export const leaveRoutes = (
  <>
    <Route path="leave" element={gate('leave.view', <MyLeave />)} />
    <Route path="leave/new" element={gate('leave.request', <NewLeaveRequest />)} />
    <Route path="leave/requests/:uuid" element={gate('leave.view|leave.team.view|leave.approve|leave.manage', <RequestDetailPage />)} />
    <Route path="leave/team" element={gate('leave.team.view', <TeamLeave />)} />
    <Route path="leave/approvals" element={gate('leave.approve|leave.manage', <Approvals />)} />
    <Route path="leave/calendar" element={gate('leave.view|leave.team.view', <TeamCalendarPage />)} />
  </>
);

/** Sidebar entries, permission gated like every other module. Spread into Layout's nav list. */
export const leaveNavItems = [
  { to: '/leave', label: 'My leave', icon: CalendarHeart, permission: 'leave.view', module: 'leave' },
  { to: '/leave/team', label: 'Team leave', icon: UsersRound, permission: 'leave.team.view', module: 'leave' },
  { to: '/leave/approvals', label: 'Leave approvals', icon: ClipboardCheck, permission: 'leave.approve|leave.manage', module: 'leave' },
  { to: '/leave/calendar', label: 'Leave calendar', icon: CalendarDays, permission: 'leave.view|leave.team.view', module: 'leave' },
];
