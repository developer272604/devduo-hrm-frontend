import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import { api, query } from '../../lib/api';
import {
  PageHeader,
  Card,
  Resource,
  Select,
  DataTable,
  Pagination,
  Button,
  Badge,
  Modal,
  Textarea,
  FormError,
  useToast,
} from '../../components/ui';

export default function DataQuality() {
  const { can } = useAuth(),
    [params] = useSearchParams(),
    toast = useToast();
  const [status, setStatus] = useState(params.get('status') || 'open'),
    [severity, setSeverity] = useState(params.get('severity') || ''),
    [page, setPage] = useState(1),
    [action, setAction] = useState(null),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const resource = useResource(`/v1/people/quality/findings?${query({ status, severity, page })}`);
  async function scan() {
    setBusy(true);
    try {
      await api('/v1/people/quality/scan', { method: 'POST' });
      toast('Quality scan queued. Refresh after processing.');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function resolve(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/people/quality/findings/${action.id}/${action.kind}`, {
        method: 'POST',
        body: { resolution: new FormData(event.target).get('resolution') },
      });
      setAction(null);
      resource.reload();
      toast('Finding updated.');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="People data quality"
        description="Resolve missing or inconsistent records with a traceable explanation."
        action={
          can('people.quality.resolve') && (
            <Button onClick={scan} disabled={busy}>
              Run quality scan
            </Button>
          )
        }
      />
      <FormError error={!action ? error : null} />
      <Card>
        <div className="flex flex-wrap items-end gap-4 p-5">
          <Select
            label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={[{ value: '', label: 'All' }, 'open', 'acknowledged', 'resolved', 'dismissed']}
          />
          <Select
            label="Severity"
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All' },
              { value: 'critical,action_required', label: 'Needs action' },
              'critical',
              'action_required',
              'warning',
              'info',
            ]}
          />
          <Button variant="secondary" onClick={resource.reload}>
            Refresh
          </Button>
        </div>
        <Resource resource={resource}>
          {(data) => (
            <>
              <DataTable
                rows={data.data}
                columns={[
                  { key: 'title', label: 'Issue' },
                  { key: 'detail', label: 'Explanation' },
                  {
                    key: 'severity',
                    label: 'Severity',
                    render: (r) => <Badge>{r.severity}</Badge>,
                  },
                  { key: 'status', label: 'Status' },
                  {
                    key: 'action',
                    label: 'Next step',
                    render: (r) => (
                      <div className="flex flex-wrap gap-2">
                        {r.employee?.uuid && (
                          <Link
                            className="text-brand-600 dark:text-brand-300"
                            to={`/people/${r.employee.uuid}`}
                          >
                            Open employee
                          </Link>
                        )}
                        {can('people.quality.resolve') &&
                          ['open', 'acknowledged'].includes(r.status) && (
                            <>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setError(null);
                                  setAction({ ...r, kind: 'resolve' });
                                }}
                              >
                                Resolve
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setError(null);
                                  setAction({ ...r, kind: 'dismiss' });
                                }}
                              >
                                Dismiss
                              </Button>
                            </>
                          )}
                      </div>
                    ),
                  },
                ]}
              />
              <Pagination data={data} onChange={setPage} />
            </>
          )}
        </Resource>
      </Card>
      <Modal
        open={!!action}
        onClose={() => setAction(null)}
        title={action?.title || 'Review finding'}
      >
        <form onSubmit={resolve} className="space-y-4">
          <FormError error={error} />
          <Textarea label="Resolution or dismissal reason" name="resolution" required />
          <Button type="submit" disabled={busy}>
            Confirm {action?.kind}
          </Button>
        </form>
      </Modal>
    </>
  );
}
