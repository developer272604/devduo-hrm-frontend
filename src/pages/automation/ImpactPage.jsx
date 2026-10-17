import { useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, FormError, Input, Modal, PageHeader, Skeleton, Textarea } from '../../components/ui';
import Access from '../../components/Access';
import { send, useAction, useList } from '../../lib/timeOfficeApi';
import { useAuth } from '../../lib/auth';

const I = '/v1/analytics/impact';

export const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export function defaultRange(now = new Date()) {
  return { from: monthKey(new Date(now.getFullYear(), now.getMonth() - 5, 1)), to: monthKey(now) };
}
export const fmtNum = (v, d = 2) => (v === null || v === undefined ? 'n/a' : Number(v).toLocaleString(undefined, { maximumFractionDigits: d }));

const RATIO = {
  cost_per_unit: { label: 'Payroll cost per unit', get: (r) => r.cost_per_unit, money: true },
  payroll_pct_of_revenue: { label: 'Payroll as % of revenue', get: (r) => r.payroll_pct_of_revenue, money: false },
};

function MetricReport({ m }) {
  const ratio = RATIO[m.summary.headline_ratio];
  const values = m.series.map((r) => ratio.get(r)).filter((v) => v !== null);
  const max = Math.max(...values, 0);
  const s = m.summary;
  return (
    <Card title={m.name}>
      <div className="space-y-3 p-5 text-xs">
        <p className="m-0 flex flex-wrap items-center gap-2">
          <Badge>{m.kind}</Badge>
          <span className="text-slate-500">
            {m.unit} · {s.months_with_results} month(s) entered · {s.months_with_ratio} with a cost ratio
          </span>
        </p>
        {s.first && s.last && s.first.month !== s.last.month ? (
          <p className="m-0 text-sm">
            {ratio.label}: <strong>{fmtNum(s.first.value)}</strong> in {s.first.month} → <strong>{fmtNum(s.last.value)}</strong> in {s.last.month}
            {s.change_percent !== null && (
              <Badge tone={s.change_percent <= 0 ? 'green' : 'amber'}>
                {s.change_percent > 0 ? '+' : ''}
                {s.change_percent}%
              </Badge>
            )}
          </p>
        ) : (
          <p className="m-0 text-slate-500">{ratio.label}: needs at least two months with both a result and published payroll.</p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="py-2 pr-4">Month</th>
                <th className="py-2 pr-4">Result</th>
                <th className="py-2 pr-4">Headcount</th>
                <th className="py-2 pr-4">Per head</th>
                <th className="py-2 pr-4">Gross payroll</th>
                <th className="py-2 pr-4">{ratio.label}</th>
              </tr>
            </thead>
            <tbody>
              {m.series.map((r) => {
                const v = ratio.get(r);
                return (
                  <tr key={r.month} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="py-2 pr-4">
                      {r.month}
                      {r.partial ? ' (in progress)' : ''}
                    </td>
                    <td className="py-2 pr-4">{fmtNum(r.value, 0)}</td>
                    <td className="py-2 pr-4">{fmtNum(r.headcount, 0)}</td>
                    <td className="py-2 pr-4">{fmtNum(r.per_head)}</td>
                    <td className="py-2 pr-4">{r.cost ? `${r.cost.currency} ${fmtNum(r.cost.gross, 0)}` : 'n/a'}</td>
                    <td className="py-2 pr-4">
                      <span className="inline-flex items-center gap-2">
                        {fmtNum(v)}
                        {v !== null && max > 0 && <span aria-hidden className="inline-block h-2 rounded bg-brand-500" style={{ width: `${Math.max(4, (v / max) * 80)}px` }} />}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

function MetricDialog({ onClose }) {
  const [f, setF] = useState({ code: '', name: '', unit: '', kind: 'output', currency: 'INR', description: '' });
  const act = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={() => onClose(false)} title="New business result">
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = { ...f, currency: f.kind === 'revenue' ? f.currency : null, description: f.description || null };
          if (await act.run(() => send('POST', `${I}/metrics`, body))) onClose(true);
        }}
      >
        <FormError error={act.error} />
        <Input label="Short code (letters, numbers, underscore)" value={f.code} onChange={set('code')} required />
        <Input label="Name" value={f.name} onChange={set('name')} required />
        <Input label="Unit (for example orders, units, tickets)" value={f.unit} onChange={set('unit')} required />
        <label className="block text-xs font-semibold">
          Type
          <select value={f.kind} onChange={set('kind')} className="mt-1 block min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900">
            <option value="output">Output (a count of things produced or served)</option>
            <option value="revenue">Revenue (money)</option>
          </select>
        </label>
        {f.kind === 'revenue' && <Input label="Currency (3 letters, must match payroll)" maxLength={3} value={f.currency} onChange={set('currency')} required />}
        <Button type="submit" loading={act.busy}>
          Create
        </Button>
      </form>
    </Modal>
  );
}

function ValueDialog({ metrics, onClose }) {
  const [metric, setMetric] = useState(metrics[0]?.uuid ?? '');
  const [period, setPeriod] = useState(monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)));
  const [value, setValue] = useState('');
  const act = useAction();
  return (
    <Modal open onClose={() => onClose(false)} title="Enter a monthly result">
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act.run(() => send('PUT', `${I}/metrics/${metric}/values`, { values: [{ period, value: Number(value) }] }))) onClose(true);
        }}
      >
        <FormError error={act.error} />
        <label className="block text-xs font-semibold">
          Result
          <select value={metric} onChange={(e) => setMetric(e.target.value)} className="mt-1 block min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900">
            {metrics.map((m) => (
              <option key={m.uuid} value={m.uuid}>
                {m.name} ({m.unit})
              </option>
            ))}
          </select>
        </label>
        <Input label="Month" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required />
        <Input label="Value for the month" type="number" min="0" step="any" value={value} onChange={(e) => setValue(e.target.value)} required />
        <p className="m-0 text-xs text-slate-500">Entering the same month again replaces the earlier value.</p>
        <Button type="submit" loading={act.busy}>
          Save
        </Button>
      </form>
    </Modal>
  );
}

function ImportDialog({ onClose }) {
  const [csv, setCsv] = useState('metric_code,period,value,note\n');
  const [preview, setPreview] = useState(null);
  const act = useAction();
  const run = (commit) => act.run(() => send('POST', `${I}/import`, { csv, commit }));
  return (
    <Modal open onClose={() => onClose(false)} title="Import results from CSV">
      <div className="space-y-4 p-5 text-xs">
        <FormError error={act.error} />
        <Textarea label="Paste CSV (columns: metric_code, period as YYYY-MM, value, optional note)" value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }} rows={8} />
        {preview && (
          <div role="status" className="space-y-1">
            <p className="m-0">
              {preview.rows_valid} of {preview.rows_total} rows are valid{preview.committed ? ` and ${preview.rows_written} were saved` : ''}.
            </p>
            {preview.errors.map((e) => (
              <p key={e.row} className="m-0 text-amber-800 dark:text-amber-200">
                Row {e.row}: {e.error}
              </p>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            loading={act.busy}
            onClick={async () => {
              const r = await run(false);
              if (r && r !== true) setPreview(r);
            }}
          >
            Check file
          </Button>
          <Button
            disabled={!preview || preview.rows_with_errors > 0 || preview.rows_valid === 0 || preview.committed}
            loading={act.busy}
            onClick={async () => {
              const r = await run(true);
              if (r && r !== true) {
                setPreview(r);
                onClose(true);
              }
            }}
          >
            Save all rows
          </Button>
        </div>
        <p className="m-0 text-slate-500">Nothing is saved unless every row is valid.</p>
      </div>
    </Modal>
  );
}

export function ImpactPage() {
  const { can } = useAuth();
  const manage = can('analytics.impact.manage');
  const [range, setRange] = useState(defaultRange());
  const [dialog, setDialog] = useState(null);
  const report = useList(`${I}/report?from=${range.from}&to=${range.to}`);
  const metrics = useList(`${I}/metrics`);
  const d = report.data;
  const refresh = () => {
    report.reload();
    metrics.reload();
  };
  return (
    <Access module="analytics" permission="analytics.impact.view">
      <PageHeader
        eyebrow="ANALYTICS · BUSINESS RESULTS"
        title="Business impact"
        description="Read workforce cost against the results your business tracks. Cost comes from published payroll inside your data scope."
        action={
          manage ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setDialog('metric')}>New result</Button>
              <Button variant="secondary" disabled={!(metrics.data?.items || []).length} onClick={() => setDialog('value')}>Enter value</Button>
              <Button variant="secondary" onClick={() => setDialog('import')}>Import CSV</Button>
            </div>
          ) : null
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <Input label="From" type="month" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <Input label="To" type="month" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
      </div>
      {report.loading ? (
        <Skeleton />
      ) : report.error ? (
        <ErrorState error={report.error} onRetry={report.reload} />
      ) : (
        <div className="space-y-4">
          {d.cost_note && (
            <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">{d.cost_note}</p>
          )}
          {d.metrics.length ? (
            d.metrics.map((m) => <MetricReport key={m.uuid} m={m} />)
          ) : (
            <EmptyState title="No business results yet" description={manage ? 'Create a result such as orders or revenue, then enter its monthly values.' : 'Ask an administrator to define the business results to track.'} />
          )}
          <p className="m-0 text-xs text-slate-500">{d.limitations}</p>
        </div>
      )}
      {dialog === 'metric' && <MetricDialog onClose={(ok) => { setDialog(null); if (ok) refresh(); }} />}
      {dialog === 'value' && <ValueDialog metrics={(metrics.data?.items || []).filter((m) => m.active)} onClose={(ok) => { setDialog(null); if (ok) refresh(); }} />}
      {dialog === 'import' && <ImportDialog onClose={(ok) => { setDialog(null); if (ok) refresh(); }} />}
    </Access>
  );
}
