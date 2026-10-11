import { useState } from 'react';
import { useAuth } from '../../../lib/auth';
import { todayLocal } from '../../../lib/leaveApi';
import { PageHeader } from '../../../components/ui';
import LeaveCalendar from '../../../components/leave/team/LeaveCalendar';
import Availability from '../../../components/leave/team/Availability';

/** /leave/calendar: the team calendar with availability for managers, otherwise just your own leave and holidays. */
export default function TeamCalendarPage() {
  const { can } = useAuth();
  const team = can('leave.team.view');
  const [date, setDate] = useState(todayLocal());
  return (
    <>
      <PageHeader
        title="Leave calendar"
        description={team ? 'Approved and pending leave across your team.' : 'Your leave and holidays.'}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <LeaveCalendar scope={team ? 'team' : 'mine'} selected={date} onSelect={setDate} />
        {team && <Availability date={date} />}
      </div>
    </>
  );
}
