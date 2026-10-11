import { Link, useParams } from 'react-router-dom';
import { Card, PageHeader } from '../../../components/ui';
import RequestDetail from '../../../components/leave/shared/RequestDetail';
import { useAuth } from '../../../lib/auth';

/** /leave/requests/:uuid. Managers who open an employee's request get the decision area and Time Story. */
export default function RequestDetailPage() {
  const { uuid } = useParams();
  const { can } = useAuth();
  return (
    <>
      <PageHeader
        title="Leave request"
        description="Status, charge, approvals and full history."
        action={
          <Link className="text-xs font-semibold text-brand-700 underline dark:text-brand-300" to="/leave">
            Back to my leave
          </Link>
        }
      />
      <Card>
        <div className="p-4 sm:p-6">
          <RequestDetail key={uuid} uuid={uuid} perspective={can('leave.approve|leave.team.view') ? 'manager' : 'employee'} />
        </div>
      </Card>
    </>
  );
}
