import { useState } from 'react';
import { api, download, query } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Resource,
  Select,
  Tabs,
  useToast,
} from '../../components/ui';
import { FormModal } from '../../components/payroll/kit';

const requestPath = '/v1/security/privacy-requests';
const reviewPath = '/v1/security/privacy-review';
const labels = {
  access: 'Access to my data',
  correction: 'Correct my data',
  deletion: 'Delete my data',
};
const statuses = {
  submitted: 'Submitted',
  in_review: 'In review',
  completed: 'Completed',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};
const choices = (mapping) => Object.entries(mapping).map(([value, label]) => ({ value, label }));
const isOpen = (row) => ['submitted', 'in_review'].includes(row.status);

function RequestList({ reviewing }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [dialog, setDialog] = useState(null);
  const path = reviewing ? reviewPath : requestPath;
  const resource = useResource(path + '?' + query({ page, status }));
  const finish = () => {
    setPage(1);
    resource.reload();
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {reviewing ? (
          <Select
            label="Filter by status"
            value={status}
            options={[{ value: '', label: 'All statuses' }, ...choices(statuses)]}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
          />
        ) : (
          <Button onClick={() => setDialog({ type: 'create', key: crypto.randomUUID() })}>
            New privacy request
          </Button>
        )}
      </div>
      <Resource resource={resource}>
        {(data) => (
          <>
            {data.data.length === 0 && (
              <Card>
                <EmptyState
                  title="No privacy requests"
                  description="Requests and their status appear here."
                />
              </Card>
            )}
            {data.data.map((row) => (
              <Card
                key={row.uuid}
                title={labels[row.kind]}
                action={<Badge>{statuses[row.status]}</Badge>}
              >
                <div className="space-y-3 px-4 pb-4">
                  <small>
                    {row.requester ? row.requester + ' � ' : ''}
                    {row.created_at.slice(0, 10)}
                  </small>
                  <p className="whitespace-pre-wrap wrap-anywhere text-sm">{row.details}</p>
                  {row.outcome && (
                    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                      <h3>Outcome</h3>
                      <p className="whitespace-pre-wrap wrap-anywhere text-sm">{row.outcome}</p>
                    </div>
                  )}
                  {!reviewing && row.has_file && (
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await download(
                            requestPath + '/' + row.uuid + '/file',
                            'privacy-response',
                          );
                        } catch (error) {
                          toast(error.message, 'error');
                        }
                      }}
                    >
                      Download response file
                    </Button>
                  )}
                  {isOpen(row) && (
                    <Button
                      variant="secondary"
                      onClick={() => setDialog({ type: reviewing ? 'review' : 'withdraw', row })}
                    >
                      {reviewing ? 'Review request' : 'Withdraw request'}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
            <Pagination data={data} onChange={setPage} />
          </>
        )}
      </Resource>
      {dialog?.type === 'create' && (
        <FormModal
          open
          title="New privacy request"
          submitLabel="Submit request"
          onClose={() => setDialog(null)}
          intro="Describe the record and the action you are requesting. Share only the details needed to review it."
          fields={[
            { name: 'kind', label: 'Request type', options: choices(labels) },
            { name: 'details', label: 'Request details', textarea: true },
          ]}
          success="Privacy request submitted."
          onSubmit={async (body) => {
            const result = await api(requestPath, {
              method: 'POST',
              body: { ...body, request_key: dialog.key },
            });
            finish();
            return result;
          }}
        />
      )}
      {dialog?.type === 'withdraw' && (
        <FormModal
          open
          title="Withdraw privacy request"
          submitLabel="Confirm withdrawal"
          onClose={() => setDialog(null)}
          intro="Withdraw this request from the privacy review queue."
          success="Privacy request withdrawn."
          onSubmit={async () => {
            const result = await api(requestPath + '/' + dialog.row.uuid + '/withdraw', {
              method: 'POST',
            });
            finish();
            return result;
          }}
        />
      )}
      {dialog?.type === 'review' && (
        <FormModal
          open
          title="Review privacy request"
          submitLabel="Save decision"
          onClose={() => setDialog(null)}
          intro="Record the decision and how the request was handled."
          fields={[
            {
              name: 'status',
              label: 'Decision',
              options: choices(
                dialog.row.status === 'submitted'
                  ? { in_review: 'Mark in review', completed: 'Complete', declined: 'Decline' }
                  : { completed: 'Complete', declined: 'Decline' },
              ),
            },
            { name: 'outcome', label: 'Message to requester', textarea: true, required: false },
          ]}
          extra={(values, set) =>
            dialog.row.kind === 'access' && (
              <Input
                label="Response file"
                type="file"
                accept=".pdf,.txt,.csv,.json"
                disabled={values.status !== 'completed'}
                hint="Optional for completed access requests. Up to 2 MB."
                onChange={(event) => set('response_file', event.target.files?.[0] ?? null)}
              />
            )
          }
          success="Privacy request updated."
          onSubmit={async ({ response_file, ...values }) => {
            let body = { ...values, version: dialog.row.version };
            if (response_file && values.status === 'completed') {
              const upload = new FormData();
              for (const [key, value] of Object.entries(body)) upload.append(key, value);
              upload.append('response_file', response_file);
              body = upload;
            }
            const result = await api(reviewPath + '/' + dialog.row.uuid, {
              method: 'POST',
              body,
            });
            finish();
            return result;
          }}
        />
      )}
    </div>
  );
}

export default function PrivacyRequestsPage() {
  const { session } = useAuth();
  const canReview = session.privacy_management === true;
  const [tab, setTab] = useState('own');

  return (
    <>
      <PageHeader
        title="Privacy requests"
        description="Ask to access, correct or delete your personal data and track the response."
      />
      {canReview && (
        <Card className="mb-4">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: 'own', label: 'My requests' },
              { value: 'review', label: 'Review queue' },
            ]}
          />
        </Card>
      )}
      <RequestList key={tab} reviewing={tab === 'review' && canReview} />
    </>
  );
}
