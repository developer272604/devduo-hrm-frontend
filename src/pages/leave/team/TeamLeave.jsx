import { useState } from 'react';
import { Link } from 'react-router-dom';
import { todayLocal } from '../../../lib/leaveApi';
import { Card, Modal, PageHeader, Tabs } from '../../../components/ui';
import Availability from '../../../components/leave/team/Availability';
import LeaveCalendar from '../../../components/leave/team/LeaveCalendar';
import RequestList from '../../../components/leave/shared/RequestList';
import RequestDetail from '../../../components/leave/shared/RequestDetail';

const TABS = [
  { value: 'away', label: 'Who is away' },
  { value: 'requests', label: 'Team requests' },
];

/** Manager view: availability for a chosen day, the team calendar and every team request (opens with full context). */
export default function TeamLeave() {
  const [tab, setTab] = useState('away');
  const [date, setDate] = useState(todayLocal());
  const [open, setOpen] = useState(null);
  return (
    <>
      <PageHeader
        title="Team leave"
        description="Who is away, how covered you are, and what your team has requested."
        action={
          <Link className="text-xs font-semibold text-brand-700 underline dark:text-brand-300" to="/leave/approvals">
            Go to approvals
          </Link>
        }
      />
      <Card>
        <Tabs items={TABS} value={tab} onChange={setTab} />
        <div role="tabpanel" aria-label={TABS.find((t) => t.value === tab).label}>
          {tab === 'away' && (
            <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <LeaveCalendar scope="team" selected={date} onSelect={setDate} />
              <Availability date={date} />
            </div>
          )}
          {tab === 'requests' && (
            <div className="p-2 sm:p-4">
              <RequestList
                scope="team"
                showEmployee
                onOpen={(r) => setOpen(r.uuid)}
                empty={{ title: 'No team requests', description: 'Leave requested by your team will appear here.' }}
              />
            </div>
          )}
        </div>
      </Card>
      <Modal open={!!open} onClose={() => setOpen(null)} title="Leave request">
        {open && <RequestDetail uuid={open} perspective="manager" />}
      </Modal>
    </>
  );
}
