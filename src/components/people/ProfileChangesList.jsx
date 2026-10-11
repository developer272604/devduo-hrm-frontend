import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useResource } from '../../lib/hooks';
import {
  approveRequest,
  cancelRequest,
  minePath,
  queuePath,
  rejectRequest,
} from '../../lib/changeRequestsApi';
import {
  Badge,
  Button,
  Drawer,
  FilterBar,
  FormError,
  Pagination,
  Resource,
  Select,
  Textarea,
  useToast,
} from '../ui';
import ResponsiveList from '../ResponsiveList';
import ProfileChangesDiff, { statusTone } from './ProfileChangesDiff';

const STATUS = ['pending', 'approved', 'rejected', 'cancelled', ''];
const when = (v) => (v ? new Date(v).toLocaleString() : '—');

/** Decision panel inside the drawer: reject needs a comment, approve may have one. */
function Decision({ request, mode, onDone }) {
  const toast = useToast(),
    [comment, setComment] = useState(''),
    [busy, setBusy] = useState(null),
    [error, setError] = useState(null),
    [commentError, setCommentError] = useState('');
  async function run(kind) {
    if (kind === 'reject' && !comment.trim()) {
      setCommentError('A comment is required when rejecting a change.');
      return;
    }
    setCommentError('');
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'approve') await approveRequest(request.uuid, comment.trim());
      else if (kind === 'reject') await rejectRequest(request.uuid, comment.trim());
      else await cancelRequest(request.uuid);
      toast(
        kind === 'approve' ? 'Change approved.' : kind === 'reject' ? 'Change rejected.' : 'Request cancelled.',
      );
      onDone();
    } catch (e) {
      setError(e);
      if (e.errors?.comment) setCommentError(e.errors.comment.join(' '));
    } finally {
      setBusy(null);
    }
  }
  if (request.status !== 'pending') return null;
  return (
    <div className="mt-6 space-y-3">
      <FormError error={error} />
      {mode === 'queue' ? (
        <>
          <Textarea
            label="Decision comment"
            value={comment}
            error={commentError}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex flex-wrap justify-end gap-2.5">
            <Button variant="danger" loading={busy === 'reject'} disabled={!!busy} onClick={() => run('reject')}>
              Reject
            </Button>
            <Button loading={busy === 'approve'} disabled={!!busy} onClick={() => run('approve')}>
              Approve
            </Button>
          </div>
        </>
      ) : (
        <Button variant="secondary" loading={busy === 'cancel'} onClick={() => run('cancel')}>
          Cancel request
        </Button>
      )}
    </div>
  );
}

function RequestDrawer({ request, mode, onClose, onDone }) {
  return (
    <Drawer open={!!request} onClose={onClose} title="Profile change request">
      {request && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <Badge tone={statusTone[request.status]}>{request.status}</Badge>
            {request.employee && (
              <Link className="text-brand-700 dark:text-brand-300" to={`/people/${request.employee.uuid}`}>
                {request.employee.name}
              </Link>
            )}
            <span className="text-slate-500 dark:text-slate-400">Submitted {when(request.submitted_at)}</span>
          </div>
          {request.reason && <p className="mb-4 text-sm">Reason: {request.reason}</p>}
          <ProfileChangesDiff changes={request.changes} />
          {request.decision_comment && (
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950">
              {request.decided_by?.name ? `${request.decided_by.name}: ` : ''}
              {request.decision_comment}
            </p>
          )}
          <Decision key={request.uuid} request={request} mode={mode} onDone={onDone} />
        </div>
      )}
    </Drawer>
  );
}

/** mode 'queue' = approvals queue; 'mine' = own requests for `employeeUuid`. */
export default function ProfileChangesList({ mode, employeeUuid }) {
  const [status, setStatus] = useState(mode === 'queue' ? 'pending' : ''),
    [page, setPage] = useState(1),
    [open, setOpen] = useState(null),
    path = mode === 'queue' ? queuePath({ status, page }) : minePath(employeeUuid, { status, page }),
    resource = useResource(path);
  const columns = [
    { key: 'summary', label: 'Change', priority: 'always', render: (r) => r.section || r.changes?.map((c) => c.label || c.field).join(', ') || 'Profile change' },
    ...(mode === 'queue' ? [{ key: 'employee', label: 'Employee', priority: 'always', render: (r) => r.employee?.name || '—' }] : []),
    { key: 'fields', label: 'Fields', priority: 'md', render: (r) => r.changes?.length ?? 0 },
    { key: 'submitted_at', label: 'Submitted', priority: 'md', render: (r) => when(r.submitted_at) },
    { key: 'status', label: 'Status', priority: 'always', render: (r) => <Badge tone={statusTone[r.status]}>{r.status}</Badge> },
  ];
  return (
    <>
      <FilterBar>
        <Select
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          options={STATUS.map((s) => ({ value: s, label: s || 'All statuses' }))}
        />
        <Button variant="secondary" onClick={resource.reload}>
          Refresh
        </Button>
      </FilterBar>
      <Resource resource={resource}>
        {(data) => (
          <>
            <ResponsiveList
              label={mode === 'queue' ? 'Approval queue' : 'My change requests'}
              rows={(data.data || []).map((r) => ({ ...r, id: r.uuid }))}
              columns={columns}
              onRowClick={setOpen}
              mobile={{
                title: (r) => (mode === 'queue' ? r.employee?.name : r.section) || 'Profile change',
                subtitle: (r) => r.changes?.map((c) => c.label || c.field).join(', '),
                badge: (r) => <Badge tone={statusTone[r.status]}>{r.status}</Badge>,
                facts: [{ label: 'Submitted', value: (r) => when(r.submitted_at) }],
              }}
              empty={{
                title: mode === 'queue' ? 'No requests waiting' : 'No change requests',
                description:
                  mode === 'queue'
                    ? 'Requests that need your approval will appear here.'
                    : 'When you request a profile change that needs approval, it will appear here.',
              }}
            />
            <Pagination data={data} onChange={setPage} />
          </>
        )}
      </Resource>
      <RequestDrawer
        request={open}
        mode={mode}
        onClose={() => setOpen(null)}
        onDone={() => {
          setOpen(null);
          resource.reload();
        }}
      />
    </>
  );
}
