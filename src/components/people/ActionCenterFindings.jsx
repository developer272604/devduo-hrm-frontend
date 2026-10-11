import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import { api, query } from '../../lib/api';
import {
  Badge,
  Button,
  FilterBar,
  FormError,
  Modal,
  Pagination,
  Resource,
  Select,
  Textarea,
  useToast,
} from '../ui';
import ResponsiveList from '../ResponsiveList';
import { SeverityBadge } from './ActionCenterInsights';

const statusTone = { open: 'amber', acknowledged: 'purple', resolved: 'green', dismissed: 'neutral' };
const SEVERITIES = ['', 'critical', 'action_required', 'warning', 'info'];
const STATUSES = ['open', 'acknowledged', 'resolved', 'dismissed', ''];

/** Which verbs a finding currently offers. */
export function findingActions(finding) {
  switch (finding.status) {
    case 'open':
      return ['acknowledge', 'resolve', 'dismiss', 'assign'];
    case 'acknowledged':
      return ['resolve', 'dismiss', 'assign'];
    default:
      return ['reopen'];
  }
}
const verbLabel = {
  acknowledge: 'Acknowledge',
  resolve: 'Resolve',
  dismiss: 'Dismiss',
  assign: 'Assign',
  reopen: 'Reopen',
};

const pastTense = {
  acknowledge: 'acknowledged',
  resolve: 'resolved',
  dismiss: 'dismissed',
  assign: 'assigned',
  reopen: 'reopened',
};

function FindingDialog({ action, onClose, onDone }) {
  const { finding, verb } = action ?? {},
    toast = useToast(),
    [text, setText] = useState(''),
    [assignee, setAssignee] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [fieldErrors, setFieldErrors] = useState({}),
    users = useResource(verb === 'assign' ? '/users?per_page=100' : '/users?per_page=1'),
    needsText = (verb === 'resolve' || verb === 'dismiss') && finding?.requires_resolution_text;

  async function submit(event) {
    event.preventDefault();
    const errors = {};
    if (needsText && !text.trim()) errors.resolution = 'Please explain the decision.';
    if (verb === 'assign' && !assignee) errors.assignee_id = 'Choose who should own this finding.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setBusy(true);
    setError(null);
    try {
      const body = {};
      if (text.trim()) body.resolution = text.trim();
      if (verb === 'assign') body.assignee_id = Number(assignee);
      await api(`/v1/people/quality/findings/${finding.id}/${verb}`, { method: 'POST', body });
      toast(`Finding ${pastTense[verb]}.`);
      onDone();
    } catch (e) {
      setError(e);
      setFieldErrors(
        Object.fromEntries(Object.entries(e.errors || {}).map(([k, v]) => [k, v.join(' ')])),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={!!action} onClose={onClose} title={`${verbLabel[verb] || ''}: ${finding?.title || ''}`}>
      <form onSubmit={submit} noValidate>
        <FormError error={error} />
        {verb === 'assign' ? (
          <Select
            label="Assign to"
            value={assignee}
            error={fieldErrors.assignee_id}
            onChange={(e) => setAssignee(e.target.value)}
            options={[
              { value: '', label: 'Choose a user' },
              ...(users.data?.data || []).map((u) => ({ value: String(u.id), label: u.name })),
            ]}
          />
        ) : verb === 'resolve' || verb === 'dismiss' ? (
          <Textarea
            label={needsText ? 'Resolution (required)' : 'Note (optional)'}
            value={text}
            error={fieldErrors.resolution}
            onChange={(e) => setText(e.target.value)}
          />
        ) : (
          <p className="mb-5 text-sm">{verbLabel[verb]} this finding?</p>
        )}
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {verbLabel[verb]}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ActionCenterFindings() {
  const { can } = useAuth(),
    toast = useToast(),
    [status, setStatus] = useState('open'),
    [severity, setSeverity] = useState(''),
    [page, setPage] = useState(1),
    [action, setAction] = useState(null),
    [scanError, setScanError] = useState(null),
    [scanning, setScanning] = useState(false),
    resolver = can('people.quality.resolve'),
    resource = useResource(`/v1/people/quality/findings?${query({ status, severity, page })}`),
    summary = useResource('/v1/people/quality/summary');

  async function scan() {
    setScanning(true);
    setScanError(null);
    try {
      await api('/v1/people/quality/scan', { method: 'POST' });
      toast('Quality scan queued. Refresh after it finishes.');
    } catch (e) {
      setScanError(e);
    } finally {
      setScanning(false);
    }
  }
  const columns = [
    { key: 'title', label: 'Finding', priority: 'always', render: (f) => <strong>{f.title}</strong> },
    { key: 'severity', label: 'Severity', priority: 'always', render: (f) => <SeverityBadge severity={f.severity} /> },
    { key: 'employee', label: 'Employee', priority: 'md', render: (f) => f.employee ? <Link className="text-brand-700 dark:text-brand-300" to={`/people/${f.employee.uuid}`}>{f.employee.name}</Link> : '—' },
    { key: 'status', label: 'Status', priority: 'md', render: (f) => <Badge tone={statusTone[f.status]}>{f.status}</Badge> },
    { key: 'assignee', label: 'Assignee', priority: 'lg', render: (f) => f.assignee?.name || '—' },
    { key: 'actions', label: 'Actions', priority: 'always', render: (f) => resolver ? <div className="flex flex-wrap gap-2">{findingActions(f).map((verb) => <Button key={verb} variant="secondary" aria-label={`${verbLabel[verb]} ${f.title}`} onClick={() => setAction({ finding: f, verb })}>{verbLabel[verb]}</Button>)}</div> : null },
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
          options={STATUSES.map((s) => ({ value: s, label: s || 'All statuses' }))}
        />
        <Select
          label="Severity"
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value);
            setPage(1);
          }}
          options={SEVERITIES.map((s) => ({ value: s, label: s ? s.replaceAll('_', ' ') : 'All severities' }))}
        />
        {summary.data && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {summary.data.open} open
            {summary.data.last_scan_at ? ` · last scan ${new Date(summary.data.last_scan_at).toLocaleString()}` : ''}
          </p>
        )}
        {resolver && (
          <Button variant="secondary" loading={scanning} onClick={scan}>
            Run scan
          </Button>
        )}
      </FilterBar>
      <div className="px-4 pt-4 sm:px-5">
        <FormError error={scanError} />
      </div>
      <Resource resource={resource}>
        {(data) => (
          <>
            <ResponsiveList
              label="Data quality findings"
              rows={data.data}
              columns={columns}
              rowKey={(f) => f.id}
              mobile={{
                title: 'title',
                subtitle: (f) => f.employee?.name || f.detail,
                badge: (f) => <SeverityBadge severity={f.severity} />,
                facts: [
                  { label: 'Status', value: 'status' },
                  { label: 'Assignee', value: (f) => f.assignee?.name || '—' },
                ],
              }}
              card={(f) => (
                <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="flex items-start justify-between gap-3">
                    <strong className="text-sm">{f.title}</strong>
                    <SeverityBadge severity={f.severity} />
                  </div>
                  {f.detail && <p className="text-xs text-slate-500 dark:text-slate-400">{f.detail}</p>}
                  <p className="text-xs">
                    {f.employee ? <Link className="text-brand-700 dark:text-brand-300" to={`/people/${f.employee.uuid}`}>{f.employee.name}</Link> : 'No employee'} · <Badge tone={statusTone[f.status]}>{f.status}</Badge>
                  </p>
                  {resolver && (
                    <div className="flex flex-wrap gap-2">
                      {findingActions(f).map((verb) => (
                        <Button key={verb} variant="secondary" aria-label={`${verbLabel[verb]} ${f.title}`} onClick={() => setAction({ finding: f, verb })}>
                          {verbLabel[verb]}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              empty={{
                title: 'No findings',
                description: 'Nothing matches these filters. Run a scan to check for new issues.',
              }}
            />
            <Pagination data={data} onChange={setPage} />
          </>
        )}
      </Resource>
      {action && (
        <FindingDialog
          key={`${action.finding.id}-${action.verb}`}
          action={action}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            resource.reload();
            summary.reload();
          }}
        />
      )}
    </>
  );
}
