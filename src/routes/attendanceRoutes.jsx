import { Navigate, Route } from 'react-router-dom';
import Access from '../components/Access';
import MyAttendance from '../pages/attendance/MyAttendance';
import PunchPage from '../pages/attendance/PunchPage';
import TeamAttendance from '../pages/attendance/TeamAttendance';
import TimeOfficeLayout from '../pages/timeoffice/TimeOfficeLayout';
import CommandCenter from '../pages/timeoffice/CommandCenter';
import DailyAttendance from '../pages/timeoffice/DailyAttendance';
import Exceptions from '../pages/timeoffice/Exceptions';
import Approvals from '../pages/timeoffice/Approvals';
import RosterPage from '../pages/timeoffice/RosterPage';
import ShiftsPage from '../pages/timeoffice/ShiftsPage';
import CalendarsPage from '../pages/timeoffice/CalendarsPage';
import PoliciesPage from '../pages/timeoffice/PoliciesPage';
import DevicesPage from '../pages/timeoffice/DevicesPage';
import AttendanceImports from '../pages/timeoffice/AttendanceImports';
import ProcessingPage from '../pages/timeoffice/ProcessingPage';
import LocksPage from '../pages/timeoffice/LocksPage';
import ReportsPage from '../pages/timeoffice/ReportsPage';
import AttendanceSettings from '../pages/timeoffice/AttendanceSettings';

/** Any of these permissions opens the Time Office; individual pages enforce their own permission server-side. */
export const TIME_OFFICE_ACCESS =
  'attendance.manage|attendance.process|attendance.policy.manage|attendance.roster.manage|attendance.devices.manage|attendance.lock|attendance.reports.view|attendance.adjust';

const gate = (permission, element) => (
  <Access permission={permission} module="attendance">
    {element}
  </Access>
);

/** Attendance + Time Office routes (spread inside the authenticated layout route). One page component per file. */
export const attendanceRoutes = (
  <>
    <Route path="attendance" element={gate('attendance.view', <MyAttendance />)} />
    <Route path="attendance/punch" element={gate('attendance.view', <PunchPage />)} />
    <Route path="attendance/team" element={gate('attendance.team.view', <TeamAttendance />)} />
    <Route path="time-settings" element={<Navigate to="/time-office" replace />} />
    <Route path="time-office" element={gate(TIME_OFFICE_ACCESS, <TimeOfficeLayout />)}>
      <Route index element={<CommandCenter />} />
      <Route path="daily" element={<DailyAttendance />} />
      <Route path="exceptions" element={<Exceptions />} />
      <Route path="approvals" element={<Approvals />} />
      <Route path="roster" element={<RosterPage />} />
      <Route path="shifts" element={<ShiftsPage />} />
      <Route path="calendars" element={<CalendarsPage />} />
      <Route path="policies" element={<PoliciesPage />} />
      <Route path="devices" element={<DevicesPage />} />
      <Route path="imports" element={<AttendanceImports />} />
      <Route path="processing" element={<ProcessingPage />} />
      <Route path="locks" element={<LocksPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="settings" element={<AttendanceSettings />} />
    </Route>
  </>
);
