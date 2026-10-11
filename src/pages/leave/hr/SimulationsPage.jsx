import { useState } from 'react';
import { Card, ErrorState, FormError, Input, Select, Tabs, Textarea, Button } from '../../../components/ui';
import ResponsiveList from '../../../components/ResponsiveList';
import { Banner, Screen, StatusBadge, guarded } from '../../../components/timeoffice/parts';
import PolicyDiffViewer from '../../../components/leave/hr/PolicyDiffViewer';
import { KeyValues, Tiles } from '../../../components/leave/hr/kit';
import { useAuth } from '../../../lib/auth';
import { addDays, paths, send, splitIds, titleCase, today, unwrap, useAction, useList } from '../../../lib/leaveHrApi';

const cell = (v) => (v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function ResultTable({ rows, label }) {
  const keys = Object.keys(rows[0] ?? {}).filter((k) => rows[0][k] === null || typeof rows[0][k] !== 'object');
  return (
    <ResponsiveList
      label={label}
      rows={rows}
      rowKey={(r) => JSON.stringify(r)}
      columns={keys.map((k, i) => ({ key: k, label: titleCase(k), priority: i < 3 ? 'always' : i < 6 ? 'md' : 'lg', render: (r) => cell(r[k]) }))}
      mobile={{ title: (r) => cell(r[keys[0]]), subtitle: (r) => cell(r[keys[1]]), facts: keys.slice(2, 6).map((k) => ({ label: titleCase(k), value: (r) => cell(r[k]) })) }}
      empty={{ title: 'No rows', description: 'The simulation returned no rows.' }}
    />
  );
}

/** Picks a policy version (needs the policy list, so it falls back to a plain id box without policy rights). */
function VersionSelect({ label, value, onChange }) {
  const { can } = useAuth();
  return can('leave.policy.manage|leave.manage') ? <ManagedVersionSelect label={label} value={value} onChange={onChange} /> : <Input label={`${label} (id)`} required value={value} onChange={(e) => onChange(e.target.value)} />;
}
function ManagedVersionSelect({ label, value, onChange }) {
  const policies = useList(paths.policies);
  const opts = policies.rows.flatMap((p) => (p.versions ?? []).map((v) => ({ value: String(v.id ?? v.uuid), label: `${p.name} v${v.version} (${v.status})` })));
  if (policies.error) return <ErrorState error={policies.error} onRetry={policies.reload} />;
  return <Select label={label} required value={value} options={[{ value: '', label: policies.loading ? 'Loading…' : 'Choose…' }, ...opts]} onChange={(e) => onChange(e.target.value)} />;
}

/** Common wrapper: runs the request, shows the read-only guarantee and the error state. */
function useRunner(path) {
  const [result, setResult] = useState(null);
  const act = useAction();
  const run = async (body) => {
    const r = await act.run(async () => unwrap(await send('POST', path, body)));
    if (r) setResult(r);
  };
  return { result, run, ...act };
}
const ReadOnly = ({ r }) =>
  r?.read_only !== false ? (
    <Banner tone="success" title="Read-only simulation">Nothing was changed. {r?.simulation_uuid && <>Saved as run <code>{r.simulation_uuid}</code>.</>}</Banner>
  ) : null;

function Sandbox({ types }) {
  const [f, setF] = useState({ leave_type_id: '', source: 'version', policy_version_id: '', rules: '{\n  "entitlement": { "basis": "annual", "amount": "12" }\n}', employees: '', period_start: today(), period_end: addDays(today(), 364) });
  const [parseError, setParseError] = useState(null);
  const r = useRunner(paths.simSandbox);
  const submit = (e) => {
    e.preventDefault();
    let rules;
    if (f.source === 'rules') {
      try {
        rules = JSON.parse(f.rules);
        setParseError(null);
      } catch {
        return setParseError({ message: 'The draft rules are not valid JSON.' });
      }
    }
    r.run({ leave_type_id: f.leave_type_id, ...(f.source === 'rules' ? { rules } : { policy_version_id: f.policy_version_id }), employees: splitIds(f.employees), period_start: f.period_start, period_end: f.period_end });
  };
  return (
    <Card title="Policy Sandbox" className="mb-5">
      <form onSubmit={submit} className="px-6 pb-5">
        <p className="mt-0 text-xs text-slate-500 dark:text-slate-400">Try draft rules on real employees and compare with what they get today. Nothing is saved to balances.</p>
        <FormError error={parseError ?? r.error} />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Select label="Leave type" required value={f.leave_type_id} options={[{ value: '', label: 'Choose…' }, ...types.map((t) => ({ value: t.uuid, label: `${t.name} (${t.code})` }))]} onChange={(e) => setF({ ...f, leave_type_id: e.target.value })} />
          <Select label="Rules from" value={f.source} options={[{ value: 'version', label: 'A policy version' }, { value: 'rules', label: 'Draft rules (JSON)' }]} onChange={(e) => setF({ ...f, source: e.target.value })} />
        </div>
        {f.source === 'version' ? (
          <VersionSelect label="Policy version" value={f.policy_version_id} onChange={(v) => setF({ ...f, policy_version_id: v })} />
        ) : (
          <Textarea label="Draft rules for this leave type" value={f.rules} onChange={(e) => setF({ ...f, rules: e.target.value })} />
        )}
        <Textarea label="Employees (uuids, up to 200)" required value={f.employees} onChange={(e) => setF({ ...f, employees: e.target.value })} />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Input label="Period start" type="date" required value={f.period_start} onChange={(e) => setF({ ...f, period_start: e.target.value })} />
          <Input label="Period end" type="date" required value={f.period_end} min={f.period_start} onChange={(e) => setF({ ...f, period_end: e.target.value })} />
        </div>
        <Button type="submit" loading={r.busy} disabled={!f.leave_type_id}>Run sandbox</Button>
        {r.result && (
          <div className="mt-4" data-testid="sandbox-result">
            <ReadOnly r={r.result} />
            {r.result.live_engine_available === false && <Banner tone="warn" title="Live engine unavailable">Draft figures are evaluated from the rule document only, so the comparison with today may be approximate.</Banner>}
            <Tiles items={Object.entries(r.result.totals ?? {}).filter(([, v]) => typeof v !== 'object').map(([k, v]) => ({ label: titleCase(k), value: String(v) }))} />
            <ResultTable rows={r.result.rows ?? []} label="Sandbox results" />
          </div>
        )}
      </form>
    </Card>
  );
}

function Entitlement({ types }) {
  const [f, setF] = useState({ employee: '', leave_type_id: '', period_start: today(), period_end: addDays(today(), 364) });
  const r = useRunner(paths.simEntitlement);
  return (
    <Card title="Entitlement Simulator" className="mb-5">
      <form onSubmit={(e) => { e.preventDefault(); r.run(f); }} className="px-6 pb-5">
        <p className="mt-0 text-xs text-slate-500 dark:text-slate-400">Shows what the engine would credit one employee for a period, step by step.</p>
        <FormError error={r.error} />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Input label="Employee ID (uuid)" required value={f.employee} onChange={(e) => setF({ ...f, employee: e.target.value })} />
          <Select label="Leave type" required value={f.leave_type_id} options={[{ value: '', label: 'Choose…' }, ...types.map((t) => ({ value: t.uuid, label: `${t.name} (${t.code})` }))]} onChange={(e) => setF({ ...f, leave_type_id: e.target.value })} />
          <Input label="Period start" type="date" required value={f.period_start} onChange={(e) => setF({ ...f, period_start: e.target.value })} />
          <Input label="Period end" type="date" required value={f.period_end} min={f.period_start} onChange={(e) => setF({ ...f, period_end: e.target.value })} />
        </div>
        <Button type="submit" loading={r.busy} disabled={!f.leave_type_id}>Simulate</Button>
        {r.result && (
          <div className="mt-4 space-y-3" data-testid="entitlement-result">
            <ReadOnly r={r.result} />
            <p className="m-0 text-xs">Source: <strong>{r.result.source === 'entitlement_engine' ? 'Entitlement engine' : titleCase(r.result.source)}</strong></p>
            {r.result.note && <Banner tone="warn">{r.result.note}</Banner>}
            <KeyValues data={r.result} skip={['simulation_uuid', 'read_only', 'source', 'note']} />
            {Array.isArray(r.result.lines) && <ResultTable rows={r.result.lines} label="Entitlement calculation" />}
          </div>
        )}
      </form>
    </Card>
  );
}

function Impact({ types }) {
  const [f, setF] = useState({ employee: '', leave_type_id: '', start_date: today(), end_date: today(), portion: '', units: '' });
  const r = useRunner(paths.simImpact);
  const body = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
  const v = r.result;
  return (
    <Card title="Request Impact Preview" className="mb-5">
      <form onSubmit={(e) => { e.preventDefault(); r.run(body); }} className="px-6 pb-5">
        <p className="mt-0 text-xs text-slate-500 dark:text-slate-400">What would a request cost, and who else would be away? Nothing is submitted.</p>
        <FormError error={r.error} />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Input label="Employee ID (uuid, optional)" value={f.employee} onChange={(e) => setF({ ...f, employee: e.target.value })} />
          <Select label="Leave type" required value={f.leave_type_id} options={[{ value: '', label: 'Choose…' }, ...types.map((t) => ({ value: t.uuid, label: `${t.name} (${t.code})` }))]} onChange={(e) => setF({ ...f, leave_type_id: e.target.value })} />
          <Input label="Start date" type="date" required value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
          <Input label="End date" type="date" required min={f.start_date} value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} />
          <Select label="Portion" value={f.portion} options={[{ value: '', label: 'Full day' }, { value: 'first_half', label: 'First half' }, { value: 'second_half', label: 'Second half' }]} onChange={(e) => setF({ ...f, portion: e.target.value })} />
          <Input label="Units (optional)" value={f.units} onChange={(e) => setF({ ...f, units: e.target.value })} />
        </div>
        <Button type="submit" loading={r.busy} disabled={!f.leave_type_id}>Preview impact</Button>
        {v && (
          <div className="mt-4 space-y-3" data-testid="impact-result">
            <ReadOnly r={v} />
            <p className="m-0 text-sm">Verdict: <StatusBadge status={v.verdict === 'ok' ? 'active' : 'warning'}>{titleCase(v.verdict)}</StatusBadge></p>
            {v.locked && <Banner tone="warn" title="Period locked">Dates in this range are locked.</Banner>}
            <KeyValues data={{ ...v.projected, ...(v.duration && typeof v.duration === 'object' ? { charged_units: v.duration.charged_units } : {}) }} />
            {v.team_overlap && <p className="m-0 text-xs">{v.team_overlap.count} teammate(s) already away in this range.</p>}
            {v.duration_engine_available === false && <Banner tone="warn">The duration engine is unavailable, so the charge is unknown.</Banner>}
          </div>
        )}
      </form>
    </Card>
  );
}

function Diff() {
  const [f, setF] = useState({ from: '', to: '' });
  const r = useRunner(paths.simPolicyDiff);
  return (
    <Card title="Policy Difference (any two versions)" className="mb-5">
      <form onSubmit={(e) => { e.preventDefault(); r.run(f); }} className="px-6 pb-5">
        <FormError error={r.error} />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <VersionSelect label="From" value={f.from} onChange={(v) => setF({ ...f, from: v })} />
          <VersionSelect label="To" value={f.to} onChange={(v) => setF({ ...f, to: v })} />
        </div>
        <Button type="submit" loading={r.busy} disabled={!f.from || !f.to}>Compare</Button>
        {r.result && <div className="mt-4"><PolicyDiffViewer diff={r.result} /></div>}
      </form>
    </Card>
  );
}

function SimulationsPageInner() {
  const [tab, setTab] = useState('sandbox');
  const types = useList(`${paths.types}?active_only=1`);
  return (
    <Screen title="Simulators" description="Safe what-if tools. They read real data but never change a balance, request or policy." permission="leave.simulate|leave.policy.manage">
      <Card className="mb-5">
        <Tabs value={tab} onChange={setTab} items={[{ value: 'sandbox', label: 'Policy Sandbox' }, { value: 'entitlement', label: 'Entitlement' }, { value: 'impact', label: 'Request impact' }, { value: 'diff', label: 'Policy diff' }]} />
      </Card>
      {types.error && <ErrorState error={types.error} onRetry={types.reload} />}
      {tab === 'sandbox' && <Sandbox types={types.rows} />}
      {tab === 'entitlement' && <Entitlement types={types.rows} />}
      {tab === 'impact' && <Impact types={types.rows} />}
      {tab === 'diff' && <Diff />}
    </Screen>
  );
}

export default guarded(SimulationsPageInner, { title: 'Simulators', permission: 'leave.simulate|leave.policy.manage' });
