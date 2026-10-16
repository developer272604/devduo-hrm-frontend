import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormError,
  Input,
  Modal,
  PageHeader,
  Skeleton,
  Tabs,
  Textarea,
} from '../../components/ui';
import { send, useAction, useList } from '../../lib/timeOfficeApi';
import { useAuth } from '../../lib/auth';
import { CostLeakageTab } from './CostLeakageTab';
import { WorkforcePlanPanel } from './WorkforcePlanPanel';

const API = '/v1/intelligence';
const tone = { critical: 'amber', action_required: 'amber', warning: 'purple', info: 'neutral' };
const STATUSES = ['active', 'open', 'acknowledged', 'snoozed', 'resolved', 'dismissed', 'all'];

function ExplainPanel({ uuid, onClose }) {
  const x = useList(`${API}/center/${uuid}/explain`);
  const e = x.data?.explain;
  return (
    <Modal open onClose={onClose} title="Why is this a finding?" drawer>
      {x.loading ? (
        <Skeleton rows={3} />
      ) : x.error ? (
        <ErrorState error={x.error} onRetry={x.reload} />
      ) : (
        <div className="space-y-4 p-5 text-xs">
          <p className="m-0 font-semibold">{x.data.title}</p>
          <dl className="space-y-3">
            <div>
              <dt className="font-semibold">Rule</dt>
              <dd className="m-0 text-slate-600 dark:text-slate-300">{e.rule}</dd>
            </div>
            <div>
              <dt className="font-semibold">Threshold</dt>
              <dd className="m-0 text-slate-600 dark:text-slate-300">{e.threshold}</dd>
            </div>
            <div>
              <dt className="font-semibold">Inputs</dt>
              <dd className="m-0 text-slate-600 dark:text-slate-300">
                {e.inputs.matching_records} matching records, {e.inputs.sample_shown} shown as a sample
              </dd>
            </div>
            <div>
              <dt className="font-semibold">As of</dt>
              <dd className="m-0 text-slate-600 dark:text-slate-300">
                {e.as_of.tenant_date} ({e.as_of.timezone})
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Data scope applied</dt>
              <dd className="m-0 text-slate-600 dark:text-slate-300">
                {e.scope.data_scopes.join(', ') || 'none'}. {e.scope.applied_by}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Withheld</dt>
              <dd className="m-0 text-slate-600 dark:text-slate-300">
                {e.suppressed.records_beyond_sample} record(s) beyond the sample. {e.suppressed.note}
              </dd>
            </div>
          </dl>
          <h3 className="m-0 text-xs font-semibold">History</h3>
          <ol className="m-0 space-y-2 pl-4">
            {x.data.history.map((h, i) => (
              <li key={i} className="text-slate-600 dark:text-slate-300">
                {h.at?.slice(0, 10)} · {h.type}
                {h.to ? ` → ${h.to}` : ''} · {h.actor}
                {h.reason ? ` · ${h.reason}` : ''}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Modal>
  );
}

function StatusDialog({ finding, mode, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState('');
  const act = useAction();
  async function submit(e) {
    e.preventDefault();
    const ok = await act.run(() =>
      send('POST', `${API}/center/${finding.uuid}/status`, {
        status: mode,
        reason,
        ...(mode === 'snoozed' ? { snoozed_until: new Date(until).toISOString() } : {}),
      }),
    );
    if (ok) onDone();
  }
  return (
    <Modal open onClose={onClose} title={`${mode[0].toUpperCase()}${mode.slice(1)} finding`}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormError error={act.error} />
        {mode === 'snoozed' && (
          <Input label="Snooze until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} required />
        )}
        <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
        <Button type="submit" loading={act.busy}>
          Save
        </Button>
      </form>
    </Modal>
  );
}

function FindingsTab({ canManage }) {
  const [status, setStatus] = useState('active');
  const list = useList(`${API}/center?status=${status}`);
  const [picked, setPicked] = useState([]);
  const [explain, setExplain] = useState(null);
  const [dialog, setDialog] = useState(null);
  const act = useAction();
  const items = list.data?.items || [];
  const refresh = async () => {
    setPicked([]);
    await list.reload();
  };
  const toggle = (uuid) => setPicked((p) => (p.includes(uuid) ? p.filter((x) => x !== uuid) : [...p, uuid]));
  return (
    <Card
      title="Findings"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {canManage && (
            <>
              <Button
                variant="secondary"
                loading={act.busy}
                onClick={async () => {
                  if (await act.run(() => send('POST', `${API}/center/scan`))) await refresh();
                }}
              >
                Scan now
              </Button>
              <Button
                variant="secondary"
                disabled={!picked.length}
                onClick={async () => {
                  if (await act.run(() => send('POST', `${API}/center/bulk-acknowledge`, { uuids: picked })))
                    await refresh();
                }}
              >
                Acknowledge selected ({picked.length})
              </Button>
            </>
          )}
        </div>
      }
    >
      <FormError error={act.error} />
      {list.loading ? (
        <Skeleton />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : items.length ? (
        <ul className="m-0 list-none space-y-3 p-5">
          {items.map((f) => (
            <li key={f.uuid} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {canManage && f.status === 'open' && (
                  <input
                    type="checkbox"
                    aria-label={`Select ${f.title}`}
                    checked={picked.includes(f.uuid)}
                    onChange={() => toggle(f.uuid)}
                    className="size-4 accent-brand-500"
                  />
                )}
                <strong className="text-sm">{f.title}</strong>
                <Badge tone={tone[f.severity]}>{f.severity.replace('_', ' ')}</Badge>
                <Badge>{f.domain}</Badge>
                <Badge tone="green">{f.status}</Badge>
              </div>
              <p className="m-0 mb-3 text-xs text-slate-600 dark:text-slate-300">
                {f.description} Owner: {f.owner?.name || 'unassigned'} · Due: {f.due_on || 'not set'} · Seen{' '}
                {f.occurrences}x
                {f.status_reason ? ` · Reason: ${f.status_reason}` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {f.evidence.actions.map((a, i) =>
                  a.kind === 'navigate' ? (
                    <Link
                      key={i}
                      to={a.href}
                      className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-brand-700 hover:bg-brand-50 dark:border-slate-700 dark:text-brand-300 dark:hover:bg-brand-950"
                    >
                      {a.label}
                    </Link>
                  ) : null,
                )}
                <Button variant="secondary" onClick={() => setExplain(f.uuid)}>
                  Explain this
                </Button>
                {canManage && (
                  <>
                    {f.status === 'open' && (
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          if (await act.run(() => send('POST', `${API}/center/${f.uuid}/status`, { status: 'acknowledged' })))
                            await refresh();
                        }}
                      >
                        Acknowledge
                      </Button>
                    )}
                    {!['resolved', 'dismissed'].includes(f.status) && (
                      <>
                        <Button variant="secondary" onClick={() => setDialog({ f, mode: 'snoozed' })}>
                          Snooze
                        </Button>
                        <Button variant="secondary" onClick={() => setDialog({ f, mode: 'resolved' })}>
                          Resolve
                        </Button>
                        <Button variant="secondary" onClick={() => setDialog({ f, mode: 'dismissed' })}>
                          Dismiss
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={f.has_task}
                          onClick={async () => {
                            if (await act.run(() => send('POST', `${API}/center/${f.uuid}/task`))) await refresh();
                          }}
                        >
                          {f.has_task ? 'Task created' : 'Create My Work task'}
                        </Button>
                      </>
                    )}
                    {['resolved', 'dismissed'].includes(f.status) && (
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          if (await act.run(() => send('POST', `${API}/center/${f.uuid}/status`, { status: 'open' })))
                            await refresh();
                        }}
                      >
                        Reopen
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No findings" description="Nothing needs attention in your scope for this filter." />
      )}
      <p className="m-0 px-5 pb-5 text-xs text-slate-500">{list.data?.limitations}</p>
      {explain && <ExplainPanel uuid={explain} onClose={() => setExplain(null)} />}
      {dialog && (
        <StatusDialog
          finding={dialog.f}
          mode={dialog.mode}
          onClose={() => setDialog(null)}
          onDone={async () => {
            setDialog(null);
            await refresh();
          }}
        />
      )}
    </Card>
  );
}

function ScenariosTab() {
  const kinds = useList(`${API}/scenarios`);
  const [months, setMonths] = useState('6');
  const [hires, setHires] = useState('0');
  const [exits, setExits] = useState('0');
  const [result, setResult] = useState(null);
  const act = useAction();
  async function run(e) {
    e.preventDefault();
    const r = await act.run(() =>
      send('POST', `${API}/scenarios`, {
        kind: 'headcount_plan',
        params: { months: Number(months), hires_per_month: Number(hires), exits_per_month: Number(exits) },
      }),
    );
    if (r && r !== true) {
      setResult(r);
      kinds.reload();
    }
  }
  return (
    <Card title="What-if scenarios">
      <form onSubmit={run} className="grid gap-4 p-5 sm:grid-cols-4">
        <Input label="Months" type="number" min="1" max="36" value={months} onChange={(e) => setMonths(e.target.value)} />
        <Input label="Hires per month" type="number" min="0" value={hires} onChange={(e) => setHires(e.target.value)} />
        <Input label="Exits per month" type="number" min="0" value={exits} onChange={(e) => setExits(e.target.value)} />
        <div className="flex items-end">
          <Button type="submit" loading={act.busy}>
            Run headcount plan
          </Button>
        </div>
      </form>
      <div className="px-5">
        <FormError error={act.error} />
      </div>
      {result && (
        <div className="space-y-2 p-5 text-xs" role="status">
          <p className="m-0 font-semibold">
            Current headcount {result.result.current_headcount}, projected {result.result.projected_headcount}
          </p>
          <p className="m-0 text-slate-600 dark:text-slate-300">
            {result.result.method} Read-only: nothing was changed in any module.
          </p>
        </div>
      )}
      <p className="m-0 px-5 pb-2 text-xs text-slate-500">
        Leave policy sandbox, leave forecast and payroll simulations run from the same endpoint when you hold their permissions.
        Stored runs: {kinds.data?.runs?.length ?? 0}.
      </p>
    </Card>
  );
}

function RiskTab({ canSettings }) {
  const risk = useList(`${API}/risk-signals`);
  const act = useAction();
  const d = risk.data;
  return (
    <Card
      title="Workforce indicators (human review only)"
      action={
        canSettings && d ? (
          <Button
            variant="secondary"
            loading={act.busy}
            onClick={async () => {
              if (
                await act.run(() =>
                  send('PUT', `${API}/settings`, { risk_signals_enabled: !d.enabled, min_cohort: d.min_cohort }),
                )
              )
                await risk.reload();
            }}
          >
            {d.enabled ? 'Disable risk signals' : 'Enable risk signals'}
          </Button>
        ) : null
      }
    >
      <FormError error={act.error} />
      {risk.loading ? (
        <Skeleton />
      ) : risk.error ? (
        <ErrorState error={risk.error} onRetry={risk.reload} />
      ) : (
        <div className="space-y-4 p-5 text-xs">
          <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {d.human_review_notice}
          </p>
          {!d.enabled ? (
            <EmptyState title="Risk signals are off" description={d.message} />
          ) : d.cohorts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="py-2 pr-4">Group</th>
                    <th className="py-2 pr-4">People</th>
                    {Object.entries(d.definitions).map(([k, v]) => (
                      <th key={k} className="py-2 pr-4" title={v.rule}>
                        {v.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.cohorts.map((c) => (
                    <tr key={c.cohort} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="py-2 pr-4">{c.cohort}</td>
                      <td className="py-2 pr-4">{c.size}</td>
                      {Object.keys(d.definitions).map((k) => (
                        <td key={k} className="py-2 pr-4">
                          {c.indicators[k]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Groups too small to show" description={d.privacy} />
          )}
          <p className="m-0 text-slate-500">{d.privacy}</p>
        </div>
      )}
    </Card>
  );
}

export function IntelligenceCenterPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState('findings');
  const items = [{ value: 'findings', label: 'Findings' }];
  if (can('intelligence.scenarios.run')) items.push({ value: 'scenarios', label: 'Scenarios' });
  if (can('intelligence.risk_signals.view')) items.push({ value: 'risk', label: 'Indicators' });
  if (can('intelligence.leakage.view')) items.push({ value: 'leakage', label: 'Cost leakage' });
  return (
    <>
      <PageHeader
        eyebrow="PHASE 16 · HRMS INTELLIGENCE"
        title="Intelligence Center"
        description="Deterministic, explainable findings limited to your permissions and data scope. No AI model is used."
      />
      <Tabs items={items} value={tab} onChange={setTab} />
      <div className="mt-5">
        {tab === 'findings' && <FindingsTab canManage={can('intelligence.manage')} />}
        {tab === 'scenarios' && (
          <>
            <ScenariosTab />
            <WorkforcePlanPanel />
          </>
        )}
        {tab === 'risk' && <RiskTab canSettings={can('intelligence.settings.manage')} />}
        {tab === 'leakage' && <CostLeakageTab canManage={can('intelligence.leakage.manage')} />}
      </div>
    </>
  );
}
