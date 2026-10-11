import { useState } from 'react';
import { Button, Card, ErrorState, Select, Skeleton } from '../../components/ui';
import { Banner, ConfirmDialog, ConfirmPreview, FormModal, ListCard, StatusBadge, Tiles, useDo } from '../../components/payroll/kit';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { changeGate, finalizeBlockers, invalid, paths, send, titleCase, useList } from '../../lib/performanceApi';
import { Page } from './parts';

function Distribution({ buckets }) {
  const entries = Object.entries(buckets ?? {});
  if (!entries.length) return <p className="m-0 text-sm text-slate-500 dark:text-slate-400">No scored reviews yet.</p>;
  const max = Math.max(...entries.map(([, n]) => n));
  return (
    <ul className="m-0 list-none space-y-1 p-0" aria-label="Rating distribution">
      {entries.map(([score, n]) => (
        <li key={score} className="flex items-center gap-3 text-xs">
          <span className="w-16 shrink-0">Rating {score}</span>
          <span className="flex flex-wrap gap-0.5" aria-hidden="true">
            {Array.from({ length: Math.min(n, 40) }, (_, i) => <span key={i} className="size-3 rounded-sm bg-brand-500" />)}
          </span>
          <span>{n} {n === max && entries.length > 1 ? '(most common)' : ''}</span>
        </li>
      ))}
    </ul>
  );
}

export function CalibrationPage() {
  const { can } = useAuth();
  const cycles = useList('/v1/performance/cycles?per_page=50');
  const [cycleId, setCycleId] = useState('');
  const options = cycles.rows.filter((c) => ['open', 'calibration', 'closed'].includes(c.status));
  const cycle = options.find((c) => c.uuid === cycleId) ?? options.find((c) => c.status === 'calibration') ?? options[0];
  return (
    <Page permission="performance.calibrate|performance.calibrate.approve" title="Calibration" description="Review the rating distribution, propose changes with a reason, and have an independent approver decide. Nothing changes pay or employment automatically.">
      {cycles.loading ? <Skeleton /> : cycles.error ? <ErrorState error={cycles.error} onRetry={cycles.reload} /> : !cycle ? (
        <Card><p className="m-0 text-sm text-slate-500 dark:text-slate-400">No cycle is open for calibration yet.</p></Card>
      ) : (
        <>
          <div className="mb-4 max-w-sm">
            <Select label="Cycle" value={cycle.uuid} options={options.map((c) => ({ value: c.uuid, label: `${c.name} (${titleCase(c.status)})` }))} onChange={(e) => setCycleId(e.target.value)} />
          </div>
          <Workspace key={cycle.uuid} cycle={cycle} can={can} onCycleChanged={cycles.reload} />
        </>
      )}
    </Page>
  );
}

function Workspace({ cycle, can, onCycleChanged }) {
  const ws = useList(paths.calibration(cycle.uuid));
  const data = ws.data ?? null;
  const actions = useDo();
  const [propose, setPropose] = useState(null);
  const [decide, setDecide] = useState(null);
  const [starting, setStarting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [result, setResult] = useState(null);
  const mayPropose = can('performance.calibrate');
  const mayApprove = can('performance.calibrate.approve');
  const pendingFor = (reviewUuid) => (data?.changes ?? []).some((c) => c.review_uuid === reviewUuid && c.status === 'pending');
  const reload = () => { ws.reload(); onCycleChanged(); };
  const nameOf = (reviewUuid) => data?.reviews?.find((r) => r.uuid === reviewUuid)?.employee?.name ?? 'Employee';
  const inCalibration = data?.cycle?.status === 'calibration';
  return (
    <>
      {ws.loading ? <Skeleton /> : ws.error ? <ErrorState error={ws.error} onRetry={ws.reload} /> : data && (
        <>
          {result && (
            <Banner tone={result.not_ready.length ? 'warn' : 'success'} title={`Finalized ${result.finalized} review${result.finalized === 1 ? '' : 's'}`}>
              {result.not_ready.length > 0 && <span>{result.not_ready.length} review(s) were not ready (no submitted manager review or no score) and stay in calibration.</span>}
            </Banner>
          )}
          <Card
            title={`${data.cycle.name}`}
            className="mb-5"
            action={<div className="flex gap-2">
              {data.cycle.status === 'open' && mayPropose && <Button onClick={() => setStarting(true)}>Start calibration</Button>}
              {inCalibration && mayApprove && <Button onClick={() => setFinalizing(true)}>Finalize cycle</Button>}
            </div>}
          >
            <Tiles items={[{ label: 'Reviews in scope', value: data.total }, { label: 'Status', value: titleCase(data.cycle.status) }, { label: 'Pending changes', value: (data.changes ?? []).filter((c) => c.status === 'pending').length }]} />
            <h3 className="mb-2 mt-0 text-sm">Rating distribution</h3>
            <Distribution buckets={data.distribution} />
            {(data.fairness_warnings ?? []).map((w, i) => (
              <Banner key={i} tone="warn" title={`Consistency prompt: ${w.group} group of ${w.size}`}>{w.message} (group average {w.average}, overall {w.overall})</Banner>
            ))}
          </Card>
          <ListCard
            title="Reviews"
            list={{ loading: false, error: null, rows: data.reviews ?? [] }}
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => r.employee?.name },
              { key: 'score', label: 'Score', render: (r) => r.final_score ?? r.computed_score ?? '-' },
              { key: 'manager', label: 'Manager review', priority: 'md', render: (r) => (r.manager_submitted ? 'Submitted' : 'Missing') },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
              { key: 'action', label: '', render: (r) => mayPropose && r.status === 'calibration' && (
                pendingFor(r.uuid) ? <span className="text-xs text-slate-500 dark:text-slate-400">Change pending</span> : <Button variant="secondary" onClick={() => setPropose(r)}>Propose change</Button>
              ) },
            ]}
            mobile={{ title: (r) => r.employee?.name, subtitle: (r) => `Score ${r.final_score ?? r.computed_score ?? '-'}`, badge: (r) => <StatusBadge value={r.status} />, facts: [{ label: 'Manager review', value: (r) => (r.manager_submitted ? 'Submitted' : 'Missing') }] }}
            empty={{ title: 'No reviews in your scope', description: 'Reviews appear once the cycle is launched.' }}
          />
          <ListCard
            title="Rating changes"
            list={{ loading: false, error: null, rows: data.changes ?? [] }}
            columns={[
              { key: 'employee', label: 'Employee', render: (c) => nameOf(c.review_uuid) },
              { key: 'change', label: 'Change', render: (c) => `${c.from_score ?? '-'} to ${c.to_score}` },
              { key: 'justification', label: 'Reason', priority: 'md' },
              { key: 'status', label: 'Status', render: (c) => <StatusBadge value={c.status} /> },
              { key: 'action', label: '', render: (c) => {
                const gate = changeGate(c, mayApprove);
                if (gate.canDecide) return <Button variant="secondary" onClick={() => setDecide(c)}>Decide</Button>;
                if (gate.waitingForOther) return <span className="text-xs text-slate-500 dark:text-slate-400">Waiting for an independent approver. You cannot approve your own change.</span>;
                return null;
              } },
            ]}
            mobile={{ title: (c) => nameOf(c.review_uuid), subtitle: (c) => `${c.from_score ?? '-'} to ${c.to_score}`, badge: (c) => <StatusBadge value={c.status} />, facts: [{ label: 'Reason', value: 'justification' }] }}
            empty={{ title: 'No rating changes', description: 'Proposed changes and their decisions are listed here.' }}
          />
        </>
      )}
      <FormModal
        open={Boolean(propose)}
        onClose={() => setPropose(null)}
        title={`Propose a rating change for ${propose?.employee?.name ?? ''}`}
        intro="A different approver must approve this before it takes effect. The reason is kept in the audit trail and the review snapshot."
        initial={{ to_score: '', justification: '' }}
        fields={[
          { name: 'to_score', label: 'New score', type: 'number', hint: `Current score ${propose?.final_score ?? propose?.computed_score ?? '-'}` },
          { name: 'justification', label: 'Reason for the change', textarea: true, hint: 'At least 10 characters. Describe evidence, not opinions about the person.' },
        ]}
        onSubmit={async (v) => {
          if (String(v.justification).trim().length < 10) throw invalid('justification', 'Explain the reason in at least 10 characters.');
          await send('POST', paths.propose(propose.uuid), { to_score: Number(v.to_score), justification: v.justification.trim() });
          reload();
        }}
        submitLabel="Submit for approval"
        success="Change proposed and sent for independent approval"
      />
      <DecisionModal change={decide} name={decide ? nameOf(decide.review_uuid) : ''} onClose={() => setDecide(null)} onDone={reload} />
      <ConfirmDialog
        open={starting}
        onClose={() => setStarting(false)}
        title="Start calibration?"
        intro="Reviews move into calibration and the rating distribution becomes final for discussion. Reviewers can no longer edit responses."
        confirmLabel="Start calibration"
        onConfirm={async () => { await actions.run('start', () => api(paths.calibration(cycle.uuid, 'start'), { method: 'POST' }), 'Calibration started'); reload(); }}
      />
      <ConfirmPreview
        open={finalizing}
        onClose={() => setFinalizing(false)}
        title="Finalize this cycle"
        notice="Finalized reviews are immutable and the employee is asked to acknowledge. Outcomes are inputs to human decisions only."
        load={() => data}
        blocked={(d) => (finalizeBlockers(d).blocked ? `${finalizeBlockers(d).pending} rating change(s) still wait for a decision. Decide them first.` : null)}
        ack={(d) => `I understand ${(d.reviews ?? []).filter((r) => r.status === 'calibration').length} review(s) will be frozen`}
        confirmLabel="Finalize cycle"
        onConfirm={async () => {
          const res = await actions.run('finalize', () => send('POST', paths.finalize(cycle.uuid), {}), 'Cycle finalized');
          if (res && res !== true) setResult({ finalized: res.finalized ?? 0, not_ready: res.not_ready ?? [] });
          reload();
        }}
      >
        {(d) => {
          const b = finalizeBlockers(d);
          return (
            <div className="text-xs">
              <p className="mt-0">Pending changes: <strong>{b.pending}</strong></p>
              <p>Reviews without a submitted manager review (they will not be finalized): <strong>{b.notReady.length}</strong></p>
              {b.notReady.length > 0 && <ul className="list-disc pl-5">{b.notReady.map((r) => <li key={r.uuid}>{r.employee?.name}</li>)}</ul>}
            </div>
          );
        }}
      </ConfirmPreview>
    </>
  );
}

function DecisionModal({ change, name, onClose, onDone }) {
  const [decision, setDecision] = useState('approve');
  return (
    <FormModal
      open={Boolean(change)}
      onClose={onClose}
      title={`Decide rating change for ${name}`}
      intro={change ? `Proposed ${change.from_score ?? '-'} to ${change.to_score}. Reason: ${change.justification}` : ''}
      initial={{ note: '' }}
      fields={[{ name: 'note', label: 'Decision note', textarea: true, required: false }]}
      extra={() => <Select label="Decision" value={decision} options={[{ value: 'approve', label: 'Approve' }, { value: 'reject', label: 'Reject' }]} onChange={(e) => setDecision(e.target.value)} />}
      onSubmit={async (v) => { await send('POST', paths.decide(change.uuid), { decision, note: v.note || undefined }); onDone(); }}
      submitLabel="Record decision"
      success="Decision recorded"
    />
  );
}
