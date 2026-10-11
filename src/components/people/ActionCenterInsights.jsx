import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useResource } from '../../lib/hooks';
import { api, download, localAction } from '../../lib/api';
import {
  Resource,
  Button,
  EmptyState,
  Modal,
  FormError,
  Select,
  useToast,
  Card,
} from '../ui';

const severityStyle = {
  critical:
    'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200',
  action_required:
    'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  info: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300',
};

/** Text label plus colour, so severity never relies on colour alone. */
export function SeverityBadge({ severity = 'info' }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize ${severityStyle[severity] || severityStyle.info}`}
    >
      {String(severity).replaceAll('_', ' ')}
    </span>
  );
}

const linkClass =
  'inline-flex min-h-10 items-center rounded-lg border border-brand-200 px-3 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950';

/** Only same-origin API paths under /api/v1/people/ may be called from server-provided actions. */
export function actionPath(action) {
  const endpoint = action?.endpoint;
  if (typeof endpoint !== 'string' || !endpoint.startsWith('/api/v1/people/') || endpoint.includes('..'))
    return null;
  return endpoint.slice(4);
}

export function describeAction(action, insight) {
  const path = actionPath(action) || '';
  if (path.endsWith('/remind'))
    return {
      kind: 'remind',
      confirm: 'Send reminders',
      text: `This sends a reminder to the ${insight.count ?? 'affected'} employee(s) behind "${insight.title}". Each employee is reminded at most once every 24 hours.`,
    };
  if (path.endsWith('/tasks'))
    return {
      kind: 'task',
      confirm: 'Create task',
      text: `This creates one task in My Work for "${insight.title}". Choose an assignee or leave it for yourself.`,
    };
  return { kind: 'other', confirm: 'Confirm', text: `Run "${action.label}" for "${insight.title}"?` };
}

function resultMessage(kind, result) {
  if (kind === 'remind' && result)
    return `Reminders sent: ${result.sent ?? 0}${result.skipped?.length ? `, skipped: ${result.skipped.length}` : ''}.`;
  if (kind === 'task') return 'Task created in My Work.';
  return 'Action completed.';
}

function AssigneePicker({ value, onChange }) {
  // Optional: the users list needs users.view; without it the task stays with the current user.
  const users = useResource('/users?per_page=100');
  if (!users.data?.data?.length) return null;
  return (
    <Select
      label="Assignee"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={[
        { value: '', label: 'Me' },
        ...users.data.data.map((u) => ({ value: String(u.id), label: u.name })),
      ]}
    />
  );
}

export default function ActionCenterInsights() {
  const resource = useResource('/v1/people/action-center?domain=people'),
    toast = useToast(),
    [pending, setPending] = useState(null),
    [assignee, setAssignee] = useState(''),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);

  async function perform(action, insight) {
    setBusy(true);
    setError(null);
    try {
      const path = actionPath(action);
      if (!path) throw new Error('This action is unavailable.');
      const info = describeAction(action, insight);
      let result = null;
      if ((action.method || 'POST') === 'GET') await download(path, 'people.csv');
      else {
        const body = { ...action.body };
        if (info.kind === 'task' && assignee) body.assignee_id = Number(assignee);
        result = await api(path, { method: 'POST', body });
      }
      setPending(null);
      setAssignee('');
      resource.reload();
      toast(resultMessage(info.kind, result));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const close = () => {
    setPending(null);
    setError(null);
  };
  const info = pending ? describeAction(pending.action, pending.insight) : null;
  return (
    <>
      <FormError error={!pending ? error : null} />
      <Resource resource={resource}>
        {(data) =>
          data.data.length ? (
            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-2">
              {data.data.map((item) => (
                <Card key={item.key}>
                  <div className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold">{item.title}</h2>
                        <p className="mt-1 text-2xl font-bold text-brand-700 dark:text-brand-300">
                          {item.count}
                          <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                            employees affected
                          </span>
                        </p>
                      </div>
                      <SeverityBadge severity={item.severity} />
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
                    {item.sample?.length > 0 && (
                      <ul className="flex list-none flex-wrap gap-2 p-0" aria-label="Sample">
                        {item.sample.map((employee) => (
                          <li key={employee.employee_uuid}>
                            <Link
                              to={`/people/${employee.employee_uuid}`}
                              className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                            >
                              {employee.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-wrap gap-3">
                      {(item.actions || []).map((action) =>
                        action.kind === 'navigate' && localAction(action.href) ? (
                          <Link key={action.label} className={linkClass} to={action.href}>
                            {action.label}
                          </Link>
                        ) : action.kind === 'api' && actionPath(action) ? (
                          <Button
                            key={action.label}
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              action.requires_confirmation
                                ? setPending({ action, insight: item })
                                : perform(action, item)
                            }
                          >
                            {action.label}
                          </Button>
                        ) : null,
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No outstanding actions"
              description="No actionable people issues were found in your permitted scope."
            />
          )
        }
      </Resource>
      <Modal open={!!pending} onClose={close} title={pending?.action.label || 'Confirm action'}>
        <FormError error={error} />
        {info && (
          <>
            <p className="mb-5 text-sm">{info.text}</p>
            {info.kind === 'task' && <AssigneePicker value={assignee} onChange={setAssignee} />}
            <div className="flex justify-end gap-2.5">
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button loading={busy} onClick={() => perform(pending.action, pending.insight)}>
                {info.confirm}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
