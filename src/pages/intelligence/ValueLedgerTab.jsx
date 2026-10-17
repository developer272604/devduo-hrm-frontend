import { useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, FormError, Input, Modal, Skeleton, Textarea } from '../../components/ui';
import { send, useAction, useList } from '../../lib/timeOfficeApi';

const V = '/v1/intelligence/value';
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const defaultRange = (now = new Date()) => ({ from: monthKey(new Date(now.getFullYear(), now.getMonth() - 5, 1)), to: monthKey(now) });
export const moneyMap = (m) => {
  const rows = Object.entries(m || {});
  return rows.length ? rows.map(([c, v]) => `${c} ${Number(v).toLocaleString()}`).join(' · ') : 'none';
};
const sel = 'mt-1 block min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900';

function Tile({ title, value, tone, note }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <p className="m-0 flex items-center gap-2 text-xs text-slate-500">
        {title} <Badge tone={tone}>{tone === 'green' ? 'verified' : tone === 'purple' ? 'estimated' : tone === 'amber' ? 'not yet recovered' : 'claimed'}</Badge>
      </p>
      <p className="m-0 mt-1 text-lg font-semibold">{value}</p>
      {note && <p className="m-0 mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

function AssumptionDialog({ item, onClose }) {
  const a = item.assumption;
  const [f, setF] = useState({ minutes: String(a?.minutes_per_run ?? ''), cost: a?.hourly_cost != null ? String(a.hourly_cost) : '', currency: a?.currency ?? 'INR', basis: a?.basis ?? '' });
  const act = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={() => onClose(false)} title={`Time saved per run: ${item.name}`}>
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = { minutes_per_run: Number(f.minutes), hourly_cost: f.cost === '' ? null : Number(f.cost), currency: f.cost === '' ? null : f.currency, basis: f.basis };
          if (await act.run(() => send('PUT', `${V}/assumptions/${item.definition_uuid}`, body))) onClose(true);
        }}
      >
        <FormError error={act.error} />
        <Input label="Minutes saved each time this workflow completes" type="number" min="1" max="10000" value={f.minutes} onChange={set('minutes')} required />
        <Input label="Cost of an hour of that work (optional)" type="number" min="0" step="any" value={f.cost} onChange={set('cost')} />
        {f.cost !== '' && <Input label="Currency" maxLength={3} value={f.currency} onChange={set('currency')} />}
        <Textarea label="How did you arrive at the minutes? (required)" value={f.basis} onChange={set('basis')} required />
        <p className="m-0 text-xs text-slate-500">This stays labelled as an estimate everywhere it appears.</p>
        <div className="flex gap-2">
          <Button type="submit" loading={act.busy}>Save assumption</Button>
          {a && (
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                if (await act.run(() => send('DELETE', `${V}/assumptions/${item.definition_uuid}`))) onClose(true);
              }}
            >
              Remove
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function ClaimDialog({ onClose }) {
  const [f, setF] = useState({ month: monthKey(new Date()), category: 'avoided_cost', title: '', basis: '', amount: '', currency: 'INR', hours: '' });
  const act = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={() => onClose(false)} title="Record a value claim">
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = { month: f.month, category: f.category, title: f.title, basis: f.basis, amount: f.amount === '' ? null : Number(f.amount), currency: f.amount === '' ? null : f.currency, hours: f.hours === '' ? null : Number(f.hours) };
          if (await act.run(() => send('POST', `${V}/entries`, body))) onClose(true);
        }}
      >
        <FormError error={act.error} />
        <Input label="Month" type="month" value={f.month} onChange={set('month')} required />
        <label className="block text-xs font-semibold">
          Kind
          <select value={f.category} onChange={set('category')} className={sel}>
            <option value="avoided_cost">Cost avoided</option>
            <option value="recovered_cost">Cost recovered outside the system</option>
            <option value="time_saved">Time saved</option>
            <option value="other">Other</option>
          </select>
        </label>
        <Input label="Title" value={f.title} onChange={set('title')} required />
        <Textarea label="Basis: what is this claim based on? (required)" value={f.basis} onChange={set('basis')} required />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Amount" type="number" min="0" step="any" value={f.amount} onChange={set('amount')} />
          <Input label="Currency" maxLength={3} value={f.currency} onChange={set('currency')} />
          <Input label="Hours" type="number" min="0" step="any" value={f.hours} onChange={set('hours')} />
        </div>
        <Button type="submit" loading={act.busy}>Save claim</Button>
      </form>
    </Modal>
  );
}

export function ValueLedgerTab({ canManage }) {
  const [range, setRange] = useState(defaultRange());
  const report = useList(`${V}/report?from=${range.from}&to=${range.to}`);
  const assumptions = useList(`${V}/assumptions`);
  const [dialog, setDialog] = useState(null);
  const act = useAction();
  const d = report.data;
  const refresh = () => {
    report.reload();
    assumptions.reload();
  };
  return (
    <Card
      title="Value ledger"
      action={canManage ? <Button variant="secondary" onClick={() => setDialog({ type: 'claim' })}>Record a claim</Button> : null}
    >
      <div className="space-y-4 p-5">
        <FormError error={act.error} />
        <div className="flex flex-wrap items-end gap-4">
          <Input label="From" type="month" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          <Input label="To" type="month" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </div>
        {report.loading ? (
          <Skeleton />
        ) : report.error ? (
          <ErrorState error={report.error} onRetry={report.reload} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Tile title="Recovered" tone="green" value={moneyMap(d.totals.verified_recovered)} note={`${d.verified_cases.length} case(s) a reviewer marked recovered`} />
              <Tile title="Identified" tone="amber" value={moneyMap(d.totals.identified_not_yet_recovered)} note="Confirmed, recovery not yet recorded" />
              <Tile title="Time saved" tone="purple" value={`${d.totals.estimated_hours_saved} h`} note={`Value: ${moneyMap(d.totals.estimated_value)} (assumption-based)`} />
              <Tile title="Other claims" tone="neutral" value={moneyMap(d.totals.claimed_amount)} note={`${d.totals.claimed_hours} h, each with a written basis`} />
            </div>
            <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">{d.confidence_note}</p>
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="py-2 pr-4">Month</th>
                    <th className="py-2 pr-4">Recovered (verified)</th>
                    <th className="py-2 pr-4">Hours saved (estimated)</th>
                    <th className="py-2 pr-4">Claims</th>
                  </tr>
                </thead>
                <tbody>
                  {d.months.map((m) => (
                    <tr key={m.month} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="py-2 pr-4">{m.month}</td>
                      <td className="py-2 pr-4">{moneyMap(m.verified_recovered)}</td>
                      <td className="py-2 pr-4">{m.estimated_hours_saved}</td>
                      <td className="py-2 pr-4">{m.claimed.entries ? `${m.claimed.entries} (${moneyMap(m.claimed.amount)})` : 'none'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="m-0 text-xs font-semibold">Automation time-saved assumptions</h3>
            {assumptions.loading ? (
              <Skeleton />
            ) : (assumptions.data?.items || []).length ? (
              <ul className="m-0 list-none space-y-2 p-0 text-xs">
                {assumptions.data.items.map((i) => (
                  <li key={i.definition_uuid} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <span>
                      <strong>{i.name}</strong>{' '}
                      {i.assumption ? `· ${i.assumption.minutes_per_run} min per completed run. Basis: ${i.assumption.basis}` : '· no assumption, so no time saving is counted'}
                    </span>
                    {canManage && (
                      <Button variant="secondary" onClick={() => setDialog({ type: 'assumption', item: i })}>
                        {i.assumption ? 'Edit' : 'Set'}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No workflows yet" description="Time saved can only be estimated for workflows you have built." />
            )}
            {d.claims.length > 0 && (
              <>
                <h3 className="m-0 text-xs font-semibold">Recorded claims</h3>
                <ul className="m-0 list-none space-y-2 p-0 text-xs">
                  {d.claims.map((c) => (
                    <li key={c.uuid} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <span>
                        <strong>{c.title}</strong> · {c.month} · {c.amount != null ? `${c.currency} ${Number(c.amount).toLocaleString()}` : ''} {c.hours != null ? `${c.hours} h` : ''}
                        <span className="block text-slate-500">Basis: {c.basis} (by {c.by})</span>
                      </span>
                      {canManage && (
                        <Button
                          variant="secondary"
                          onClick={async () => {
                            if (await act.run(() => send('DELETE', `${V}/entries/${c.uuid}`))) refresh();
                          }}
                        >
                          Delete
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="m-0 text-xs text-slate-500">{d.limitations}</p>
          </>
        )}
      </div>
      {dialog?.type === 'claim' && <ClaimDialog onClose={(ok) => { setDialog(null); if (ok) refresh(); }} />}
      {dialog?.type === 'assumption' && <AssumptionDialog item={dialog.item} onClose={(ok) => { setDialog(null); if (ok) refresh(); }} />}
    </Card>
  );
}
