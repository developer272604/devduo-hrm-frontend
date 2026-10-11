import { useEffect, useState } from 'react';
import { Button, FormError, Input, Select, Skeleton, useToast } from '../ui';
import ResponsiveList from '../ResponsiveList';
import RuleEditor from './RuleEditor';
import { Banner, Impact, Panel } from './parts';
import { addDays, paths, send, today, toOptions, unwrap, useAction, useLookup, titleCase } from '../../lib/timeOfficeApi';
import { api } from '../../lib/api';

/**
 * Policy simulator: replays history against candidate rules and shows the impact. It never writes (the server confirms
 * `writes: false`); publishing is a separate, deliberate step on the Policies tab.
 */
export default function PolicySimulator({ policies }) {
  const toast = useToast();
  const departments = useLookup('/organization/departments?per_page=100');
  const [policy, setPolicy] = useState('');
  const [version, setVersion] = useState('');
  const [rules, setRules] = useState(null);
  const [edited, setEdited] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);
  const [scopeKind, setScopeKind] = useState('tenant');
  const [department, setDepartment] = useState('');
  const [employees, setEmployees] = useState('');
  const [range, setRange] = useState({ from: addDays(today(), -30), to: addDays(today(), -1) });
  const [sample, setSample] = useState('100');
  const run = useAction();
  const [result, setResult] = useState(null);
  const chosen = policies.find((p) => p.uuid === policy);
  const versions = chosen?.versions ?? [];

  useEffect(() => {
    if (!policy || !version) return;
    let live = true;
    setLoadingRules(true);
    api(`${paths.policies}/${policy}/versions/${version}`)
      .then((r) => live && (setRules(unwrap(r).effective_rules ?? unwrap(r).rules ?? {}), setEdited(false)))
      .catch(() => live && setRules(null))
      .finally(() => live && setLoadingRules(false));
    return () => {
      live = false;
    };
  }, [policy, version]);

  async function simulate(e) {
    e.preventDefault();
    setResult(null);
    const scope = scopeKind === 'tenant' ? { tenant: true } : scopeKind === 'department' ? { department_id: Number(department) } : { employee_uuids: employees.split(/[\s,]+/).filter(Boolean) };
    const v = versions.find((x) => String(x.version) === String(version));
    const body = { ...range, scope, sample_size: Number(sample) || 100, ...(edited || !v?.id ? { rules } : { version_id: v.id }) };
    const r = await run.run(() => send('POST', paths.policySimulate, body));
    if (r) {
      setResult(unwrap(r));
      toast('Simulation finished. Nothing was saved.');
    }
  }
  const s = result?.summary;
  /** The server sends transitions as [{from, to, count, message}]; the impact list wants label: count. */
  const transitions = Array.isArray(s?.by_transition) ? Object.fromEntries(s.by_transition.map((t) => [`${titleCase(t.from)} to ${titleCase(t.to)}`, t.count])) : s?.by_transition;
  return (
    <>
      <Panel title="Policy simulator">
        <form className="px-6 pb-6" onSubmit={simulate}>
          <Banner tone="info">Simulation re-calculates past days with the rules below and compares them with what was recorded. It changes no data.</Banner>
          <FormError error={run.error} />
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Select label="Policy" required value={policy} options={[{ value: '', label: 'Choose…' }, ...policies.map((p) => ({ value: p.uuid, label: p.name }))]} onChange={(e) => { setPolicy(e.target.value); setVersion(''); setRules(null); }} />
            <Select label="Version to start from" required value={version} options={[{ value: '', label: 'Choose…' }, ...versions.map((v) => ({ value: String(v.version), label: `v${v.version} (${v.status})` }))]} onChange={(e) => setVersion(e.target.value)} />
            <Input label="From" type="date" required value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
            <Input label="To" type="date" required value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
            <Select label="Who" value={scopeKind} options={[{ value: 'tenant', label: 'Whole organisation' }, { value: 'department', label: 'One department' }, { value: 'employees', label: 'Specific employees' }]} onChange={(e) => setScopeKind(e.target.value)} />
            {scopeKind === 'department' && <Select label="Department" required value={department} options={toOptions(departments, 'Choose…')} onChange={(e) => setDepartment(e.target.value)} />}
            {scopeKind === 'employees' && <Input label="Employee IDs" required hint="Separate with commas or spaces." value={employees} onChange={(e) => setEmployees(e.target.value)} />}
            <Input label="Examples to show" type="number" min={1} max={500} value={sample} onChange={(e) => setSample(e.target.value)} />
          </div>
          {loadingRules && <Skeleton rows={1} />}
          {rules && (
            <>
              <h3 className="mb-2 mt-2 text-sm">Rules to test {edited ? '(edited)' : '(unchanged)'}</h3>
              <RuleEditor rules={rules} onChange={(r) => { setRules(r); setEdited(true); }} />
            </>
          )}
          <div className="mt-4 flex justify-end">
            <Button type="submit" loading={run.busy} disabled={!rules}>Run simulation</Button>
          </div>
        </form>
      </Panel>
      {result && (
        <Panel title="Impact summary">
          <div className="space-y-4 px-6 pb-6" data-testid="simulation-result">
            {result.writes === false && <Banner tone="success" title="Nothing was changed">This was a simulation only.</Banner>}
            {s && (
              <Impact data={{ days_compared: s.records, days_that_change: s.changed, days_unchanged: s.unchanged, employees: s.employees }} />
            )}
            {s?.by_field && Object.keys(s.by_field).length > 0 && (
              <div>
                <h3 className="mb-1 text-sm">What changes</h3>
                <Impact data={s.by_field} />
              </div>
            )}
            {transitions && Object.keys(transitions).length > 0 && (
              <div>
                <h3 className="mb-1 text-sm">Status transitions</h3>
                <Impact data={transitions} />
              </div>
            )}
            {s?.messages?.length > 0 && <Banner tone="warn" title="Notes">{s.messages.join(' ')}</Banner>}
            <ResponsiveList
              label="Simulation examples"
              rows={result.examples ?? []}
              rowKey={(r) => `${r.employee_uuid}-${r.date}`}
              columns={[
                { key: 'employee_uuid', label: 'Employee' },
                { key: 'date', label: 'Date' },
                { key: 'differences', label: 'Difference', render: (r) => (Array.isArray(r.differences) ? r.differences.map((d) => (typeof d === 'string' ? d : `${titleCase(d.field)}: ${d.before} to ${d.after}`)).join('; ') : JSON.stringify(r.differences)) },
              ]}
              mobile={{ title: 'employee_uuid', subtitle: 'date', facts: [{ label: 'Difference', value: (r) => (Array.isArray(r.differences) ? r.differences.map((d) => (typeof d === 'string' ? d : `${titleCase(d.field)}: ${d.before} to ${d.after}`)).join('; ') : '') }] }}
              empty={{ title: 'No differences', description: 'These rules produce the same results as recorded for the chosen days.' }}
            />
          </div>
        </Panel>
      )}
    </>
  );
}

