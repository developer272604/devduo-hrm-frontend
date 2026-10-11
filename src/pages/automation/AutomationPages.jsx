import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, ErrorState, PageHeader, Skeleton, Input, Select } from '../../components/ui';
import Access from '../../components/Access';
import { FormModal, StatusBadge, useDo } from '../../components/payroll/kit';
import { useList, send, today } from '../../lib/timeOfficeApi';
import { useAuth } from '../../lib/auth';
import { download, query } from '../../lib/api';
const W = '/v1/workflows';
const A = '/v1/analytics';
function Page({ module, title, description, action, children }) {
  return (
    <Access
      module={module}
      permission={
        module === 'workflows' ? 'workflows.manage|workflows.act|workflows.run' : 'analytics.view'
      }
    >
      <PageHeader title={title} description={description} action={action} />
      {children}
    </Access>
  );
}
function Result({ resource, children }) {
  return resource.loading ? (
    <Skeleton />
  ) : resource.error ? (
    <ErrorState error={resource.error} onRetry={resource.reload} />
  ) : (
    children
  );
}
function Pager({ resource, page, setPage }) {
  return (
    <div className="my-4 flex gap-3">
      <Button
        variant="secondary"
        disabled={page <= 1 || resource.loading}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </Button>
      <span>Page {page}</span>
      <Button
        variant="secondary"
        disabled={page >= (resource.data?.last_page || 1) || resource.loading}
        onClick={() => setPage(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
const newStep = () => ({
  title: '',
  action: 'approval',
  assignment: 'manager',
  assignees: [],
  mode: 'all',
  timeout_hours: 48,
  worker_type: '',
});
const opts = (values) => values.map((value) => ({ value, label: value.replaceAll('_', ' ') }));
function Designer({ values, set, users, employees = [], eventTypes = [] }) {
  const steps = values.spec?.steps || [];
  const trigger = values.spec?.trigger || { type: 'manual' };
  const changeTrigger = (key, value) =>
    set('spec', { ...values.spec, trigger: { ...trigger, [key]: value } });
  const change = (index, key, value) =>
    set('spec', {
      ...values.spec,
      steps: steps.map((step, i) => (i === index ? { ...step, [key]: value } : step)),
    });
  return (
    <div className="space-y-4">
      <Select
        label="Workflow trigger"
        value={trigger.type}
        options={opts(['manual', 'event', 'schedule'])}
        onChange={(e) =>
          set('spec', {
            ...values.spec,
            trigger:
              e.target.value === 'event'
                ? { type: 'event', event_type: 'EmployeeCreated' }
                : { type: e.target.value },
          })
        }
      />
      {trigger.type === 'event' && (
        <>
          <Select
            label="Source event"
            required
            value={trigger.event_type || 'EmployeeCreated'}
            options={eventTypes}
            onChange={(e) =>
              set('spec', {
                ...values.spec,
                trigger: {
                  ...trigger,
                  event_type: e.target.value,
                  status: e.target.value === 'EmploymentStatusChanged' ? 'active' : undefined,
                },
              })
            }
          />
          {trigger.event_type === 'EmploymentStatusChanged' && (
            <Select
              label="Start only when the new status is"
              required
              value={trigger.status || 'active'}
              options={opts([
                'preboarding',
                'active',
                'probation',
                'notice_period',
                'suspended',
                'long_leave',
                'inactive',
                'separated',
                'archived',
              ])}
              onChange={(e) => changeTrigger('status', e.target.value)}
            />
          )}
          <p className="text-sm">
            Starts for matching employee-linked events after publication. Runs with the publishing
            administrator's current permissions.
          </p>
        </>
      )}
      {trigger.type === 'schedule' && (
        <>
          <Select
            label="Scheduled employee"
            required
            value={trigger.employee_uuid || ''}
            options={employees}
            onChange={(e) => changeTrigger('employee_uuid', e.target.value)}
          />
          <Input
            label="First scheduled timestamp"
            required
            hint="Use an explicit offset, for example 2026-11-01T09:00:00+05:30"
            value={trigger.at || ''}
            onChange={(e) => changeTrigger('at', e.target.value)}
          />
          <Input
            label="Repeat interval in hours (0 means once)"
            type="number"
            min="0"
            max="8760"
            value={trigger.interval_hours || 0}
            onChange={(e) => changeTrigger('interval_hours', Number(e.target.value))}
          />
        </>
      )}
      {steps.map((step, i) => (
        <fieldset key={i} className="rounded border border-slate-200 p-3">
          <legend>Step {i + 1}</legend>
          <Input
            label={'Step title ' + (i + 1)}
            required
            value={step.title}
            onChange={(e) => change(i, 'title', e.target.value)}
          />
          <Select
            label={'Action ' + (i + 1)}
            value={step.action}
            options={opts(['approval', 'task', 'notify', 'wait'])}
            onChange={(e) => change(i, 'action', e.target.value)}
          />
          <Select
            label={'Assignment ' + (i + 1)}
            value={step.assignment}
            options={[
              { value: 'manager', label: 'Employee manager (selected users are fallback)' },
              { value: 'fixed', label: 'Selected users' },
            ]}
            onChange={(e) => change(i, 'assignment', e.target.value)}
          />
          {step.action !== 'wait' && (
            <div className="my-3">
              <p className="text-xs">Assignees / fallback</p>
              {users.map((u) => (
                <label key={u.id} className="mr-3 inline-flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={step.assignees.includes(u.id)}
                    onChange={(e) =>
                      change(
                        i,
                        'assignees',
                        e.target.checked
                          ? [...step.assignees, u.id]
                          : step.assignees.filter((id) => id !== u.id),
                      )
                    }
                  />
                  {u.name}
                </label>
              ))}
            </div>
          )}
          <Select
            label={'Completion rule ' + (i + 1)}
            value={step.mode}
            options={[
              { value: 'all', label: 'All assignees must approve / complete' },
              { value: 'any', label: 'Any one assignee may approve / complete' },
            ]}
            onChange={(e) => change(i, 'mode', e.target.value)}
          />
          {['approval', 'task'].includes(step.action) && (
            <div className="my-3 border-t pt-3">
              <p className="text-xs font-semibold">Deadline escalation (optional)</p>
              {users.map((u) => (
                <label
                  key={'escalate-' + u.id}
                  className="mr-3 inline-flex items-center gap-1 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={(step.escalation_assignees || []).includes(u.id)}
                    onChange={(e) =>
                      change(
                        i,
                        'escalation_assignees',
                        e.target.checked
                          ? [...(step.escalation_assignees || []), u.id]
                          : (step.escalation_assignees || []).filter((id) => id !== u.id),
                      )
                    }
                  />
                  {u.name}
                </label>
              ))}
              {(step.escalation_assignees || []).length > 0 && (
                <Input
                  label={'Escalation deadline hours ' + (i + 1)}
                  type="number"
                  min="1"
                  max="8760"
                  value={step.escalation_hours || 24}
                  onChange={(e) => change(i, 'escalation_hours', Number(e.target.value))}
                />
              )}
            </div>
          )}
          <Input
            label={'Deadline or wait hours ' + (i + 1)}
            type="number"
            required
            min="1"
            max="8760"
            value={step.timeout_hours}
            onChange={(e) => change(i, 'timeout_hours', Number(e.target.value))}
          />
          <Select
            label={'Worker type condition ' + (i + 1)}
            value={step.worker_type || ''}
            options={[
              { value: '', label: 'All worker types' },
              ...opts(['employee', 'contractor', 'intern', 'consultant']),
            ]}
            onChange={(e) => change(i, 'worker_type', e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={steps.length <= 1}
            onClick={() => set('spec', { ...values.spec, steps: steps.filter((_, n) => n !== i) })}
          >
            Remove step {i + 1}
          </Button>
        </fieldset>
      ))}
      <Button
        variant="secondary"
        disabled={steps.length >= 25}
        onClick={() => set('spec', { ...values.spec, steps: [...steps, newStep()] })}
      >
        Add step
      </Button>
    </div>
  );
}
export function WorkflowsPage() {
  const [delivery, setDelivery] = useState(null);
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [create, setCreate] = useState(false);
  const [status, setStatus] = useState('');
  const instances = useList(W + '/instances?' + query({ page, status }));
  const definitions = useList(can('workflows.manage') ? W + '/definitions?page=' + page : null);
  const options = useList(can('workflows.manage') ? W + '/options' : null);
  const deliveries = useList(can('workflows.manage') ? W + '/deliveries?page=' + page : null);
  return (
    <Page
      module="workflows"
      title="Workflows"
      description="Design approvals, track active work and recover failed steps."
      action={
        can('workflows.manage') && <Button onClick={() => setCreate(true)}>New workflow</Button>
      }
    >
      {can('workflows.manage') && (
        <Card title="Definitions">
          <Result resource={definitions}>
            {definitions.rows.map((d) => (
              <p key={d.uuid} className="my-2">
                <Link className="underline text-brand-700" to={'/workflows/definitions/' + d.uuid}>
                  {d.name}
                </Link>{' '}
                · Revision {d.revision} ·{' '}
                {d.published_version_id ? 'Published version available' : 'Unpublished'}
              </p>
            ))}
            {!definitions.rows.length && <p>No definitions yet.</p>}
            <Pager resource={definitions} page={page} setPage={setPage} />
          </Result>
        </Card>
      )}
      <Card title="Instances and recovery" className="mt-4">
        <Select
          label="Instance status"
          value={status}
          options={[
            { value: '', label: 'All statuses' },
            ...opts([
              'waiting',
              'failed',
              'dead_letter',
              'paused',
              'completed',
              'cancelled',
              'rejected',
            ]),
          ]}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        />
        <Result resource={instances}>
          <div className="space-y-3">
            {instances.rows.map((i) => (
              <div key={i.uuid} className="flex justify-between">
                <Link className="underline" to={'/workflows/instances/' + i.uuid}>
                  {i.name} · Version {i.version}
                </Link>
                <StatusBadge value={i.status} />
              </div>
            ))}
            {!instances.rows.length && <p>No instances match this view.</p>}
          </div>
          <Pager resource={instances} page={page} setPage={setPage} />
        </Result>
      </Card>
      {can('workflows.manage') && (
        <Card title="Automatic delivery recovery" className="mt-4">
          <Result resource={deliveries}>
            {deliveries.rows.map((d) => (
              <div key={d.id} className="my-3 flex justify-between">
                <p>
                  Delivery {d.id} · {d.status} · {d.attempts} attempts
                  {d.failure_code ? ' · Authorization or source needs attention' : ''}
                </p>
                {['retry', 'dead_letter'].includes(d.status) && (
                  <Button variant="secondary" onClick={() => setDelivery(d.id)}>
                    Retry delivery {d.id}
                  </Button>
                )}
              </div>
            ))}
            {!deliveries.rows.length && <p>No pending or failed deliveries.</p>}
            <Pager resource={deliveries} page={page} setPage={setPage} />
          </Result>
        </Card>
      )}
      <FormModal
        open={delivery !== null}
        onClose={() => setDelivery(null)}
        title="Retry automatic delivery"
        fields={[{ name: 'reason', label: 'Recovery reason', textarea: true }]}
        onSubmit={async (v) => {
          const r = await send('POST', W + '/deliveries/' + delivery + '/retry', v);
          deliveries.reload();
          return r;
        }}
        success="Delivery queued for retry"
      />
      <FormModal
        open={create}
        onClose={() => setCreate(false)}
        title="New workflow definition"
        initial={{ name: '', spec: { steps: [newStep()] } }}
        fields={[{ name: 'name', label: 'Workflow name' }]}
        intro="Steps run in order. Multiple assignees in one step work in parallel. Published versions require approval from a different administrator."
        extra={(v, set) => (
          <>
            <Result resource={options}>
              <Designer
                values={v}
                set={set}
                users={options.data?.users || []}
                eventTypes={options.data?.event_types || []}
                employees={(options.data?.employees || []).map((e) => ({
                  value: e.uuid,
                  label: e.employee_number,
                }))}
              />
            </Result>
          </>
        )}
        onSubmit={async (v) => {
          const r = await send('POST', W + '/definitions', v);
          definitions.reload();
          return r;
        }}
        success="Workflow draft created"
      />
    </Page>
  );
}
export function WorkflowDefinitionPage() {
  const { uuid } = useParams();
  const { can } = useAuth();
  const detail = useList(W + '/definitions/' + uuid);
  const options = useList(W + '/options');
  const d = detail.data?.definition;
  const [modal, setModal] = useState(null);
  const [preview, setPreview] = useState(null);
  const [startKey, setStartKey] = useState('');
  const work = useDo();
  const employees = (options.data?.employees || []).map((e) => ({
    value: e.uuid,
    label: e.employee_number,
  }));
  async function act(v) {
    if (modal === 'edit') {
      const r = await send('PUT', W + '/definitions/' + uuid, v);
      detail.reload();
      return r;
    }
    if (modal === 'simulate') {
      const r = await send('POST', W + '/simulate', {
        spec: d.draft,
        employee_uuid: v.employee_uuid,
      });
      setPreview(r);
      return r;
    }
    if (modal === 'publish') {
      const r = await send('POST', W + '/definitions/' + uuid + '/publish', {
        revision: d.revision,
      });
      detail.reload();
      return r;
    }
    return send('POST', W + '/instances', {
      definition_uuid: uuid,
      employee_uuid: v.employee_uuid,
      idempotency_key: startKey,
    });
  }
  return (
    <Page
      module="workflows"
      title={d?.name || 'Workflow definition'}
      description="Edit drafts, preview routing, publish a reviewed version and initiate work."
    >
      <Link to="/workflows" className="underline">
        All workflows
      </Link>
      <Result resource={detail}>
        {d && (
          <Card title={'Draft revision ' + d.revision}>
            <ol className="mb-4 list-inside list-decimal space-y-2">
              {d.draft.steps.map((s, i) => (
                <li key={i}>
                  {s.title} · {s.action} · {s.assignment} · {s.mode} · {s.timeout_hours} hours
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setModal('edit')}>Edit draft</Button>
              <Button variant="secondary" onClick={() => setModal('simulate')}>
                Simulate
              </Button>
              {can('workflows.publish') && (
                <Button variant="secondary" onClick={() => setModal('publish')}>
                  Publish version
                </Button>
              )}
              {can('workflows.run') && d.published_version_id && (
                <Button
                  onClick={() => {
                    setStartKey(crypto.randomUUID());
                    setModal('start');
                  }}
                >
                  Start workflow
                </Button>
              )}
            </div>
            <h2 className="mt-4 font-semibold">Published history</h2>
            {detail.data.versions?.map((v) => (
              <p key={v.id}>
                Version {v.number} · {new Date(v.created_at).toLocaleString()}
              </p>
            ))}
          </Card>
        )}
      </Result>
      {preview && (
        <Card title="Simulation — no work created" className="mt-4">
          {preview.steps.map((s) => (
            <p key={s.step}>
              {s.step}. {s.title}:{' '}
              {!s.matches
                ? 'Condition skipped'
                : s.blocked
                  ? 'Blocked: no eligible routing'
                  : 'Ready'}{' '}
              · {s.assignees.length} assignees
            </p>
          ))}
        </Card>
      )}
      <FormModal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={
          modal === 'publish'
            ? 'Publish reviewed version'
            : modal === 'edit'
              ? 'Edit workflow draft'
              : modal === 'start'
                ? 'Start published workflow'
                : 'Simulate workflow'
        }
        intro={
          modal === 'publish'
            ? 'Publication is allowed only for an administrator other than the last draft editor. Existing instances keep their original version.'
            : undefined
        }
        initial={modal === 'edit' && d ? { name: d.name, spec: d.draft, revision: d.revision } : {}}
        fields={
          modal === 'edit'
            ? [{ name: 'name', label: 'Workflow name' }]
            : modal === 'publish'
              ? []
              : [{ name: 'employee_uuid', label: 'Employee', options: employees }]
        }
        extra={(v, set) => (
          <Result resource={options}>
            {modal === 'edit' && (
              <Designer
                values={v}
                set={set}
                users={options.data?.users || []}
                employees={employees}
                eventTypes={options.data?.event_types || []}
              />
            )}
          </Result>
        )}
        onSubmit={act}
        success={
          modal === 'start'
            ? 'Workflow started. Open All workflows to follow it.'
            : modal === 'simulate'
              ? 'Simulation complete'
              : 'Workflow saved'
        }
      />
    </Page>
  );
}
export function WorkflowInstancePage() {
  const { uuid } = useParams();
  const { can } = useAuth();
  const detail = useList(W + '/instances/' + uuid);
  const i = detail.data;
  const [action, setAction] = useState(null);
  const [delegating, setDelegating] = useState(false);
  const delegates = useList(delegating ? W + '/instances/' + uuid + '/delegates' : null);
  return (
    <Page
      module="workflows"
      title={i?.name || 'Workflow instance'}
      description="Review assigned work and its execution history."
    >
      <Link className="underline" to="/workflows">
        All workflows
      </Link>
      <Result resource={detail}>
        {i && (
          <>
            <Card title={'Version ' + i.version} action={<StatusBadge value={i.status} />}>
              <p>{i.current_step?.title || 'No remaining step'}</p>
              <p className="text-sm">
                Step {Math.min(i.step, i.step_count)} of {i.step_count}
                {i.due_at ? ' · Due ' + new Date(i.due_at).toLocaleString() : ''}
              </p>
              {i.failure_code && (
                <p role="alert">
                  Recovery needed: {i.failure_code.replaceAll('_', ' ')}. Retry attempts:{' '}
                  {i.attempts}.
                </p>
              )}
              <div className="my-3 flex flex-wrap gap-2">
                {i.can_decide && (
                  <>
                    <Button onClick={() => setAction('approved')}>
                      {i.current_step?.action === 'task' ? 'Complete task' : 'Approve'}
                    </Button>
                    <Button variant="secondary" onClick={() => setAction('rejected')}>
                      Reject
                    </Button>
                    <Button variant="secondary" onClick={() => setDelegating(true)}>
                      Delegate
                    </Button>
                  </>
                )}
                {can('workflows.manage') && (
                  <>
                    {i.status === 'waiting' && (
                      <Button variant="secondary" onClick={() => setAction('pause')}>
                        Pause
                      </Button>
                    )}
                    {i.status === 'paused' && (
                      <Button onClick={() => setAction('resume')}>Resume</Button>
                    )}
                    {i.status === 'failed' && (
                      <Button onClick={() => setAction('retry')}>Retry step</Button>
                    )}
                    {['waiting', 'paused', 'failed', 'dead_letter'].includes(i.status) && (
                      <Button variant="secondary" onClick={() => setAction('cancel')}>
                        Cancel workflow
                      </Button>
                    )}
                  </>
                )}
              </div>
            </Card>
            <Card className="mt-4" title="Execution trace">
              <ol className="space-y-2">
                {i.trace?.map((t, n) => (
                  <li key={n} className="text-sm">
                    {new Date(t.created_at).toLocaleString()} · Step {t.step_index + 1}:{' '}
                    {t.event.replaceAll('_', ' ')}
                    {t.details?.reason ? ' · ' + t.details.reason : ''}
                  </li>
                ))}
              </ol>
            </Card>
          </>
        )}
      </Result>
      <FormModal
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title="Record workflow action"
        fields={[{ name: 'reason', label: 'Reason', textarea: true }]}
        onSubmit={async (v) => {
          const decision = ['approved', 'rejected'].includes(action);
          const r = await send(
            'POST',
            W + '/instances/' + uuid + (decision ? '/decide' : '/control'),
            { ...v, ...(decision ? { decision: action } : { action }) },
          );
          detail.reload();
          return r;
        }}
        success="Workflow updated"
      />
      <FormModal
        open={delegating}
        onClose={() => setDelegating(false)}
        title="Delegate workflow assignment"
        intro="Only an eligible workspace user who has not already participated in this step can receive the assignment."
        fields={[
          {
            name: 'to_user_id',
            label: 'New assignee',
            options: delegates.rows.map((u) => ({ value: u.id, label: u.name })),
          },
          { name: 'reason', label: 'Reason', textarea: true },
        ]}
        extra={() =>
          delegates.error ? <ErrorState error={delegates.error} onRetry={delegates.reload} /> : null
        }
        onSubmit={async (v) => {
          const r = await send('POST', W + '/instances/' + uuid + '/delegate', {
            ...v,
            from_user_id: i.my_assignment_user_id,
          });
          detail.reload();
          return r;
        }}
        success="Assignment delegated"
      />
    </Page>
  );
}
function ReportResult({ result }) {
  const display = (value) => {
    if (value && typeof value === 'object') {
      if ('gross' in value && 'net' in value)
        return (
          <span>
            {value.gross} gross · {value.net} net · Gross change{' '}
            {value.gross_change_percent ?? 'not available'}% · Net change{' '}
            {value.net_change_percent ?? 'not available'}%
          </span>
        );
      return JSON.stringify(value);
    }
    return value ?? 'Not available';
  };
  return (
    result && (
      <Card title={result.label} className="mt-4">
        <p className="text-sm">{result.definition}</p>
        <table className="my-4 w-full text-left text-sm">
          <thead>
            <tr>
              <th>Group</th>
              <th>Value ({result.unit})</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r, i) => (
              <tr key={i}>
                <td>{r.group}</td>
                <td>{r.suppressed ? 'Suppressed — small cohort' : display(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.quality?.blocked && <p role="alert">{result.quality.blocked}</p>}
        <p className="text-xs">
          Minimum cohort: {result.minimum_cohort}. Refreshed{' '}
          {new Date(result.refreshed_at).toLocaleString()} · {result.timezone}
        </p>
        <p className="text-xs">{result.scope}</p>
        <p className="text-xs">{result.limitations}</p>
        <details className="mt-3 text-xs">
          <summary>Metric explanation and source</summary>
          <p>
            Definition version {result.version} · {result.lineage}
          </p>
          {result.rows
            .filter((r) => !r.suppressed)
            .map((r, i) => (
              <p key={i}>
                {r.group}: numerator {r.numerator}, denominator {r.denominator ?? 'not applicable'}
              </p>
            ))}
        </details>
      </Card>
    )
  );
}
export function AnalyticsPage() {
  const { can } = useAuth();
  const metrics = useList(A + '/metrics');
  const [page, setPage] = useState(1);
  const reports = useList(A + '/reports?page=' + page);
  const work = useDo();
  const [spec, setSpec] = useState({
    metric: 'headcount',
    dimension: 'total',
    from: today().slice(0, 8) + '01',
    to: today(),
  });
  const [result, setResult] = useState(null);
  const [modal, setModal] = useState(null);
  const [scenario, setScenario] = useState(null);
  const metric = metrics.rows.find((m) => m.key === spec.metric);
  async function run(e) {
    e.preventDefault();
    setResult(null);
    const r = await work.run('query', () => send('POST', A + '/query', spec));
    if (r) setResult(r);
  }
  return (
    <Page
      module="analytics"
      title="Workforce analytics"
      description="Explainable metrics from authorized source records. Small cohorts are withheld."
    >
      <Card title="Report builder">
        <Result resource={metrics}>
          <form onSubmit={run} className="grid gap-3 md:grid-cols-2">
            <Select
              label="Metric"
              value={spec.metric}
              options={metrics.rows.map((m) => ({ value: m.key, label: m.label }))}
              onChange={(e) => setSpec({ ...spec, metric: e.target.value, dimension: 'total' })}
            />
            <Select
              label="Group by"
              value={spec.dimension}
              options={opts(metric?.dimensions || ['total'])}
              onChange={(e) => setSpec({ ...spec, dimension: e.target.value })}
            />
            <Input
              label="Period start"
              type="date"
              required
              value={spec.from}
              onChange={(e) => setSpec({ ...spec, from: e.target.value })}
            />
            <Input
              label="Period end"
              type="date"
              required
              value={spec.to}
              onChange={(e) => setSpec({ ...spec, to: e.target.value })}
            />
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button type="submit" disabled={Boolean(work.busy) || !metric}>
                Run report
              </Button>
              <Button variant="secondary" disabled={!metric} onClick={() => setModal('save')}>
                Save report
              </Button>
              {can('analytics.export') && (
                <Button
                  variant="secondary"
                  disabled={Boolean(work.busy) || !metric}
                  onClick={() =>
                    work.run('export', () =>
                      download(A + '/export?' + query(spec), 'workforce-report.csv'),
                    )
                  }
                >
                  Export CSV
                </Button>
              )}
              <Button variant="secondary" onClick={() => setModal('scenario')}>
                Workforce scenario
              </Button>
            </div>
          </form>
          {!metrics.rows.length && (
            <p>No metric source permissions are enabled for your account.</p>
          )}
        </Result>
      </Card>
      <ReportResult result={result} />
      {scenario && (
        <Card title="Workforce scenario" className="mt-4">
          <p>
            {scenario.baseline} baseline + {scenario.assumptions.hires} assumed hires −{' '}
            {scenario.assumptions.leavers} assumed leavers = {scenario.projected} projected
            employments.
          </p>
          <p className="text-sm">{scenario.limitations}</p>
        </Card>
      )}
      <Card title="My saved reports" className="mt-4">
        <Result resource={reports}>
          {reports.rows.map((r) => (
            <div key={r.uuid} className="my-3 flex items-center justify-between">
              <span>{r.name}</span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={Boolean(work.busy)}
                  onClick={async () => {
                    setResult(null);
                    const v = await work.run('saved', () =>
                      send('POST', A + '/reports/' + r.uuid + '/run', {}),
                    );
                    if (v) {
                      setSpec(r.spec);
                      setResult(v);
                    }
                  }}
                >
                  Run {r.name}
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await work.run('delete', async () => {
                      await send('DELETE', A + '/reports/' + r.uuid);
                      reports.reload();
                      return true;
                    });
                  }}
                >
                  Delete {r.name}
                </Button>
              </div>
            </div>
          ))}
          {!reports.rows.length && <p>No saved reports yet.</p>}
          <Pager resource={reports} page={page} setPage={setPage} />
        </Result>
      </Card>
      <FormModal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={modal === 'save' ? 'Save report' : 'Workforce scenario'}
        initial={modal === 'scenario' ? { hires: 0, leavers: 0 } : {}}
        fields={
          modal === 'save'
            ? [{ name: 'name', label: 'Report name' }]
            : [
                { name: 'hires', label: 'Assumed hires', type: 'number' },
                { name: 'leavers', label: 'Assumed leavers', type: 'number' },
              ]
        }
        intro={
          modal === 'scenario'
            ? 'Uses headcount at the selected period end. Enter assumptions; this does not change employee records.'
            : 'Each run rechecks your current source permissions and employee scope.'
        }
        onSubmit={async (v) => {
          if (modal === 'save') {
            const r = await send('POST', A + '/reports', { name: v.name, spec });
            reports.reload();
            return r;
          }
          const r = await send('POST', A + '/scenarios', { ...v, from: spec.from, to: spec.to });
          setScenario(r);
          return r;
        }}
        success={modal === 'save' ? 'Report saved' : 'Scenario calculated'}
      />
    </Page>
  );
}
