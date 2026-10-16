import { useState } from 'react';
import { Button, Card, FormError, Input } from '../../components/ui';
import { send, useAction } from '../../lib/timeOfficeApi';

const API = '/v1/intelligence';
const newWave = () => ({ month: '1', count: '5', monthly_cost: '', lead_time_months: '2', ramp_months: '0' });
const newAlt = (name) => ({ name, backfill: false, backfill_lead_months: '2', waves: [] });

const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));

/** Builds the API body from form state. Empty optional fields are omitted so the server applies its documented defaults. */
export function buildPlanBody(f) {
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
  return {
    kind: 'workforce_plan',
    title: f.title || undefined,
    params: clean({
      months: num(f.months),
      annual_attrition_pct: num(f.attrition),
      attrition_low_pct: num(f.low),
      attrition_high_pct: num(f.high),
      avg_monthly_cost: num(f.avgCost),
      currency: f.currency || undefined,
      monthly_budget: num(f.budget),
      baseline_headcount: num(f.baseline),
      alternatives: f.alternatives.map((a) =>
        clean({
          name: a.name,
          backfill: a.backfill,
          backfill_lead_months: a.backfill ? num(a.backfill_lead_months) : undefined,
          waves: a.waves.map((w) =>
            clean({ month: num(w.month), count: num(w.count), monthly_cost: num(w.monthly_cost), lead_time_months: num(w.lead_time_months), ramp_months: num(w.ramp_months) }),
          ),
        }),
      ),
    }),
  };
}

const fmt = (v, cur) => (v === null || v === undefined ? 'n/a' : `${cur ? `${cur} ` : ''}${Number(v).toLocaleString()}`);

function Results({ data }) {
  const r = data.result;
  const cur = r.currency;
  return (
    <div className="space-y-3 p-5 text-xs" role="region" aria-label="Plan results">
      <p className="m-0">
        Starting headcount <strong>{r.baseline_headcount}</strong> ({r.baseline_source}). Annual attrition: low {r.assumptions.annual_attrition_pct.low}% · base{' '}
        {r.assumptions.annual_attrition_pct.base}% · high {r.assumptions.annual_attrition_pct.high}%.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="py-2 pr-4">Plan</th>
              <th className="py-2 pr-4">Headcount at end (low / base / high)</th>
              <th className="py-2 pr-4">Effective capacity (base)</th>
              <th className="py-2 pr-4">Total cost (base)</th>
              <th className="py-2 pr-4">Change vs first plan</th>
              <th className="py-2 pr-4">Months over budget</th>
            </tr>
          </thead>
          <tbody>
            {r.alternatives.map((a) => (
              <tr key={a.name} className="border-t border-slate-200 dark:border-slate-700">
                <td className="py-2 pr-4 font-semibold">{a.name}</td>
                <td className="py-2 pr-4">
                  {a.cases.low.end_headcount} / {a.cases.base.end_headcount} / {a.cases.high.end_headcount}
                </td>
                <td className="py-2 pr-4">{a.cases.base.end_effective_fte}</td>
                <td className="py-2 pr-4">{fmt(a.cases.base.total_cost, cur)}</td>
                <td className="py-2 pr-4">
                  {a.vs_first
                    ? `${a.vs_first.headcount >= 0 ? '+' : ''}${a.vs_first.headcount} people, cost ${a.vs_first.total_cost === null ? 'n/a' : fmt(a.vs_first.total_cost, cur)}`
                    : 'reference'}
                </td>
                <td className="py-2 pr-4">{a.cases.base.months_over_budget ?? 'no budget set'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-slate-500">{r.method}</p>
      <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">{r.limitations}</p>
    </div>
  );
}

export function WorkforcePlanPanel() {
  const [f, setF] = useState({
    title: '',
    months: '12',
    attrition: '12',
    low: '',
    high: '',
    avgCost: '',
    currency: 'INR',
    budget: '',
    baseline: '',
    alternatives: [newAlt('Do nothing'), { ...newAlt('Hire 5'), waves: [newWave()] }],
  });
  const [result, setResult] = useState(null);
  const act = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setAlt = (i, patch) => setF({ ...f, alternatives: f.alternatives.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  const setWave = (i, k, patch) =>
    setAlt(i, { waves: f.alternatives[i].waves.map((w, j) => (j === k ? { ...w, ...patch } : w)) });
  return (
    <Card title="Workforce plan: compare hiring options" className="mt-4">
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await act.run(() => send('POST', `${API}/scenarios`, buildPlanBody(f)));
          if (r && r !== true) setResult(r);
        }}
      >
        <p className="m-0 text-xs text-slate-600 dark:text-slate-300">
          Every number is your assumption. Nothing is predicted, and confidential payroll data is not used: enter an average monthly cost yourself.
        </p>
        <FormError error={act.error} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Months to look ahead" type="number" min="1" max="36" value={f.months} onChange={set('months')} required />
          <Input label="Annual attrition % (base)" type="number" min="0" max="100" step="any" value={f.attrition} onChange={set('attrition')} required />
          <Input label="Starting headcount (blank = your scope)" type="number" min="0" value={f.baseline} onChange={set('baseline')} />
          <Input label="Attrition % low (optional)" type="number" min="0" max="100" step="any" value={f.low} onChange={set('low')} />
          <Input label="Attrition % high (optional)" type="number" min="0" max="100" step="any" value={f.high} onChange={set('high')} />
          <Input label="Currency" maxLength={3} value={f.currency} onChange={set('currency')} />
          <Input label="Average monthly cost per person" type="number" min="0" step="any" value={f.avgCost} onChange={set('avgCost')} />
          <Input label="Monthly budget (optional)" type="number" min="0" step="any" value={f.budget} onChange={set('budget')} />
          <Input label="Name this run (optional)" value={f.title} onChange={set('title')} />
        </div>
        {f.alternatives.map((a, i) => (
          <fieldset key={i} className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <legend className="px-1 text-xs font-semibold">Option {i + 1}</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Option name" value={a.name} onChange={(e) => setAlt(i, { name: e.target.value })} required />
              <label className="flex items-center gap-2 pt-6 text-xs">
                <input type="checkbox" className="size-4 accent-brand-500" checked={a.backfill} onChange={(e) => setAlt(i, { backfill: e.target.checked })} />
                Replace people who leave
              </label>
              {a.backfill && (
                <Input label="Months to replace" type="number" min="0" max="12" value={a.backfill_lead_months} onChange={(e) => setAlt(i, { backfill_lead_months: e.target.value })} />
              )}
            </div>
            {a.waves.map((w, k) => (
              <div key={k} className="grid gap-3 sm:grid-cols-6">
                <Input label="Start hiring in month" type="number" min="1" value={w.month} onChange={(e) => setWave(i, k, { month: e.target.value })} />
                <Input label="People" type="number" min="1" value={w.count} onChange={(e) => setWave(i, k, { count: e.target.value })} />
                <Input label="Monthly cost each" type="number" min="0" step="any" value={w.monthly_cost} onChange={(e) => setWave(i, k, { monthly_cost: e.target.value })} />
                <Input label="Months to fill" type="number" min="0" max="12" value={w.lead_time_months} onChange={(e) => setWave(i, k, { lead_time_months: e.target.value })} />
                <Input label="Months to full speed" type="number" min="0" max="12" value={w.ramp_months} onChange={(e) => setWave(i, k, { ramp_months: e.target.value })} />
                <div className="flex items-end">
                  <Button type="button" variant="secondary" onClick={() => setAlt(i, { waves: a.waves.filter((_, j) => j !== k) })}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" disabled={a.waves.length >= 12} onClick={() => setAlt(i, { waves: [...a.waves, newWave()] })}>
                Add hiring wave
              </Button>
              {f.alternatives.length > 1 && (
                <Button type="button" variant="secondary" onClick={() => setF({ ...f, alternatives: f.alternatives.filter((_, j) => j !== i) })}>
                  Remove option
                </Button>
              )}
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={f.alternatives.length >= 4} onClick={() => setF({ ...f, alternatives: [...f.alternatives, newAlt(`Option ${f.alternatives.length + 1}`)] })}>
            Add option
          </Button>
          <Button type="submit" loading={act.busy}>
            Compare options
          </Button>
        </div>
      </form>
      {result && <Results data={result} />}
    </Card>
  );
}
