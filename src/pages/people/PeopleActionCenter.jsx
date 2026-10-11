import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { PageHeader, Card, Tabs } from '../../components/ui';
import ActionCenterInsights from '../../components/people/ActionCenterInsights';
import ActionCenterFindings from '../../components/people/ActionCenterFindings';
import ActionCenterDashboard from '../../components/people/ActionCenterDashboard';

export default function PeopleActionCenter() {
  const { can } = useAuth(),
    [tab, setTab] = useState('insights');
  const items = [
    { value: 'insights', label: 'Insights' },
    { value: 'findings', label: 'Data quality' },
    ...(can('people.view') ? [{ value: 'dashboard', label: 'People dashboard' }] : []),
  ];
  return (
    <>
      <PageHeader
        eyebrow="PEOPLE OPERATIONS"
        title="People action center"
        description="Understand what needs attention and take the next action."
      />
      <Card>
        <Tabs value={tab} onChange={setTab} items={items} />
        {tab === 'insights' ? (
          <ActionCenterInsights />
        ) : tab === 'findings' ? (
          <ActionCenterFindings />
        ) : (
          <ActionCenterDashboard />
        )}
      </Card>
    </>
  );
}
