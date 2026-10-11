import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import { PageHeader, Card, Tabs, Resource, EmptyState } from '../../components/ui';
import ProfileChangesList from '../../components/people/ProfileChangesList';

function MyRequests() {
  const resource = useResource('/v1/me/employee');
  return (
    <Resource resource={resource}>
      {(me) =>
        me?.employee_uuid ? (
          <ProfileChangesList mode="mine" employeeUuid={me.employee_uuid} />
        ) : (
          <EmptyState
            title="No employee profile"
            description="Your account is not linked to an employee record, so there are no requests to show."
          />
        )
      }
    </Resource>
  );
}

export default function ProfileChanges() {
  const { can } = useAuth(),
    approver = can('people.changes.approve'),
    [tab, setTab] = useState(approver ? 'queue' : 'mine');
  return (
    <>
      <PageHeader
        title="Profile changes"
        description="Track your requested changes and review requests from others."
      />
      <Card>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            ...(approver ? [{ value: 'queue', label: 'Approvals queue' }] : []),
            { value: 'mine', label: 'My requests' },
          ]}
        />
        {tab === 'queue' && approver ? <ProfileChangesList mode="queue" /> : <MyRequests />}
      </Card>
    </>
  );
}
