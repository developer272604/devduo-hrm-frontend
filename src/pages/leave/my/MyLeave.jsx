import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useResource } from '../../../lib/hooks';
import { useAuth } from '../../../lib/auth';
import { leavePaths, listOf, todayLocal } from '../../../lib/leaveApi';
import { Button, Card, PageHeader, Resource, Tabs } from '../../../components/ui';
import BalanceCards from '../../../components/leave/shared/BalanceCards';
import LedgerDrawer from '../../../components/leave/shared/LedgerDrawer';
import ExplainerPanel from '../../../components/leave/shared/ExplainerPanel';
import ForecastPanel from '../../../components/leave/shared/ForecastPanel';
import RequestList from '../../../components/leave/shared/RequestList';
import TimeStory from '../../../components/leave/shared/TimeStory';
import CompOffSection from '../../../components/leave/my/CompOffSection';
import LeaveCalendar from '../../../components/leave/team/LeaveCalendar';

const TABS = [
  { value: 'balances', label: 'Balances' },
  { value: 'requests', label: 'My requests' },
  { value: 'compoff', label: 'Comp-off' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'story', label: 'Time story' },
];

function Balances() {
  const asOf = todayLocal();
  const resource = useResource(`${leavePaths.balances}?as_of=${asOf}`);
  const { can } = useAuth();
  const [ledger, setLedger] = useState(null);
  const [explain, setExplain] = useState(null);
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Resource resource={resource}>
        {(res) => (
          <BalanceCards items={listOf(res)} canRequest={can('leave.request')} onLedger={setLedger} onExplain={setExplain} />
        )}
      </Resource>
      <ForecastPanel />
      <LedgerDrawer item={ledger} asOf={asOf} onClose={() => setLedger(null)} />
      <ExplainerPanel item={explain} asOf={asOf} onClose={() => setExplain(null)} />
    </div>
  );
}

function Story() {
  const to = todayLocal();
  const year = `${to.slice(0, 4)}-01-01`;
  return (
    <div className="p-4 sm:p-6">
      <Card title={`Your time story since ${year}`}>
        <div className="px-6 pb-6">
          <TimeStory from={year} to={to} />
        </div>
      </Card>
    </div>
  );
}

/** Employee home for leave: balances (with ledger and explanation), requests, comp-off, calendar, time story. */
export default function MyLeave() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'balances';
  const setTab = (value) => {
    const next = new URLSearchParams(params);
    next.set('tab', value);
    setParams(next, { replace: true });
  };
  return (
    <>
      <PageHeader
        title="My leave"
        description="Your balances, requests and the reasoning behind every number."
        action={
          can('leave.request') && (
            <Link to="/leave/new">
              <Button>Request leave</Button>
            </Link>
          )
        }
      />
      <Card>
        <Tabs items={TABS} value={tab} onChange={setTab} />
        <div role="tabpanel" aria-label={TABS.find((t) => t.value === tab).label}>
          {tab === 'balances' && <Balances />}
          {tab === 'requests' && (
            <div className="p-2 sm:p-4">
              <RequestList
                scope="mine"
                onOpen={(r) => navigate(`/leave/requests/${r.uuid}`)}
                empty={{ title: 'No leave requests yet', description: 'When you request leave, it will be tracked here.' }}
              />
            </div>
          )}
          {tab === 'compoff' && (
            <div className="p-4 sm:p-6">
              <CompOffSection />
            </div>
          )}
          {tab === 'calendar' && (
            <div className="p-4 sm:p-6">
              <LeaveCalendar scope="mine" />
            </div>
          )}
          {tab === 'story' && <Story />}
        </div>
      </Card>
    </>
  );
}
