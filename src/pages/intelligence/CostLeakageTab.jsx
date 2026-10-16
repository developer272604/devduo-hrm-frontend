import { useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, FormError, Input, Modal, Skeleton, Textarea } from '../../components/ui';
import { send, useAction, useList } from '../../lib/timeOfficeApi';
import { useAuth } from '../../lib/auth';

const API = '/v1/intelligence/leakage';
const STATUSES = ['active', 'open', 'under_review', 'confirmed', 'false_positive', 'recovered', 'all'];
const tone = { action_required: 'amber', warning: 'purple', info: 'neutral' };
const NEXT = {
  open: ['under_review', 'confirmed', 'false_positive'],
  under_review: ['confirmed', 'false_positive'],
  confirmed: ['recovered'],
  false_positive: ['open'],
  recovered: [],
};
const label = (s) => s.replace('_', ' ');

const money = (map) => {
  const rows = Object.entries(map || {});
  return rows.length ? rows.map(([c, v]) => `${c} ${Number(v).toLocaleString()}`).join(' · ') : '0';
};

export function exposureText(e) {
  const parts = [];
  if (e.amount !== null) parts.push(`${e.currency} ${Number(e.amount).toLocaleString()}`);
  if (e.minutes !== null) parts.push(`${(e.minutes / 60).toFixed(1)} h`);
  return parts.join(' · ') || 'n/a';
}

function Stat({ title, value, note }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <p className="m-0 text-xs text-slate-500">{title}</p>
      <p className="m-0 mt-1 text-lg font-semibold">{value}</p>
      {note && <p className="m-0 mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

function ExplainPanel({ uuid, onClose }) {
  const x = useList(`${API}/${uuid}/explain`);
  const e = x.data?.explain;
  return (
    <Modal open onClose={onClose} title="Why was this case raised?" drawer>
      {x.loading ? (
        <Skeleton rows={3} />
      ) : x.error ? (
        <ErrorState error={x.error} onRetry={x.reload} />
      ) : (
        <div className="space-y-4 p-5 text-xs">
          <p className="m-0 font-semibold">{x.data.title}</p>
          <dl className="space-y-3">
            {[
              ['Rule', e.rule],
              ['Threshold', JSON.stringify(e.threshold)],
              ['Data sources', e.sources.join(', ')],
              ['How exposure is estimated', e.exposure],
              ['As of', `${e.as_of.tenant_date} (${e.as_of.timezone})`],
              ['Data scope', e.scope],
              ['Important', e.caveat],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="font-semibold">{k}</dt>
                <dd className="m-0 text-slate-600 dark:text-slate-300">{v}</dd>
              </div>
            ))}
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

function StatusDialog({ item, to, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [recovered, setRecovered] = useState('');
  const act = useAction();
  const needsReason = ['confirmed', 'false_positive', 'recovered'].includes(to);
  async function submit(e) {
    e.preventDefault();
    const ok = await act.run(() =>
      send('POST', `${API}/${item.uuid}/status`, {
        status: to,
        reason,
        ...(to === 'recovered' ? { recovered_amount: Number(recovered) } : {}),
      }),
    );
    if (ok) onDone();
  }
  return (
    <Modal open onClose={onClose} title={`Mark as ${label(to)}`}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormError error={act.error} />
        <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required={needsReason} />
        {to === 'recovered' && (
          <Input
            label={`Amount recovered${item.exposure.currency ? ` (${item.exposure.currency})` : ''}`}
            type="number"
            min="0"
            step="0.01"
            value={recovered}
            onChange={(e) => setRecovered(e.target.value)}
            required
          />
        )}
        <Button type="submit" loading={act.busy}>
          Save
        </Button>
      </form>
    </Modal>
  );
}

function SettingsDialog({ onClose, onDone }) {
  const s = useList(`${API}/settings`);
  const [values, setValues] = useState(null);
  const [disabled, setDisabled] = useState(null);
  const act = useAction();
  const t = values ?? s.data?.thresholds ?? {};
  const off = disabled ?? s.data?.disabled_rules ?? [];
  async function submit(e) {
    e.preventDefault();
    const ok = await act.run(() => send('PUT', `${API}/settings`, { thresholds: t, disabled_rules: off }));
    if (ok) onDone();
  }
  const fields = {
    ot_spike_ratio: 'Overtime spike: times the usual average',
    ot_spike_min_minutes: 'Overtime spike: minimum minutes',
    ot_over_calculated_min_minutes: 'Approved above calculated: minimum minutes',
    regularization_min_count: 'Regularizations: minimum count',
    regularization_overtime_min_minutes: 'Regularizations + overtime: minimum overtime minutes',
    repeat_adjustment_min_count: 'Manual payroll adjustments: minimum count',
  };
  return (
    <Modal open onClose={onClose} title="Detection thresholds">
      {s.loading ? (
        <Skeleton rows={3} />
      ) : (
        <form onSubmit={submit} className="space-y-4 p-5">
          <FormError error={act.error} />
          {Object.entries(fields).map(([k, l]) => (
            <Input
              key={k}
              label={l}
              type="number"
              step="any"
              value={t[k] ?? ''}
              onChange={(e) => setValues({ ...t, [k]: Number(e.target.value) })}
            />
          ))}
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-brand-500"
              checked={Boolean(t.duplicate_cross_employee)}
              onChange={(e) => setValues({ ...t, duplicate_cross_employee: e.target.checked })}
            />
            <span>
              Also flag identical expense lines claimed by different people
              <span className="block text-slate-500">Off by default: shared fares and set meals make this noisy.</span>
            </span>
          </label>
          <fieldset className="space-y-2 text-xs">
            <legend className="font-semibold">Turn rules off</legend>
            {(s.data?.rules || []).map((r) => (
              <label key={r.code} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-brand-500"
                  checked={off.includes(r.code)}
                  onChange={(e) => setDisabled(e.target.checked ? [...off, r.code] : off.filter((x) => x !== r.code))}
                />
                <span>
                  {r.label}
                  <span className="block text-slate-500">{r.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <Button type="submit" loading={act.busy}>
            Save thresholds
          </Button>
        </form>
      )}
    </Modal>
  );
}

export function CostLeakageTab({ canManage }) {
  const { session } = useAuth();
  const [status, setStatus] = useState('active');
  const [rule, setRule] = useState('');
  const list = useList(`${API}?status=${status}${rule ? `&rule=${rule}` : ''}`);
  const [explain, setExplain] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [settings, setSettings] = useState(false);
  const act = useAction();
  const items = list.data?.items || [];
  const sum = list.data?.summary;
  return (
    <Card
      title="Workforce cost leakage"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by rule"
            value={rule}
            onChange={(e) => setRule(e.target.value)}
            className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">all rules</option>
            {(list.data?.rules || []).map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
          {canManage && (
            <>
              <Button
                variant="secondary"
                loading={act.busy}
                onClick={async () => {
                  if (await act.run(() => send('POST', `${API}/scan`, {}))) await list.reload();
                }}
              >
                Scan this month
              </Button>
              <Button variant="secondary" onClick={() => setSettings(true)}>
                Thresholds
              </Button>
            </>
          )}
        </div>
      }
    >
      <FormError error={act.error} />
      {sum && (
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat title="Open cases" value={sum.open_cases} note={`${(sum.open_exposure_minutes / 60).toFixed(1)} h overtime exposure`} />
          <Stat title="Open money exposure" value={money(sum.open_exposure_by_currency)} note="Estimate until reviewed" />
          <Stat title="Confirmed by a reviewer" value={sum.confirmed_cases} note={money(sum.confirmed_exposure_by_currency)} />
          <Stat title="Recovered" value={money(sum.recovered_by_currency)} note={sum.precision === null ? 'Precision shown after 5 reviewed cases' : `Reviewer precision ${Math.round(sum.precision * 100)}%`} />
        </div>
      )}
      {list.loading ? (
        <Skeleton />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : items.length ? (
        <ul className="m-0 list-none space-y-3 p-5">
          {items.map((c) => (
            <li key={c.uuid} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <strong className="text-sm">{c.title}</strong>
                <Badge tone={tone[c.severity]}>{label(c.severity)}</Badge>
                <Badge>{c.rule}</Badge>
                <Badge tone="green">{label(c.status)}</Badge>
              </div>
              <p className="m-0 mb-3 text-xs text-slate-600 dark:text-slate-300">
                {c.summary} Exposure: {exposureText(c.exposure)} · Window {c.window.from} to {c.window.to} · Owner:{' '}
                {c.owner?.name || 'unassigned'}
                {c.status_reason ? ` · Reason: ${c.status_reason}` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setExplain(c.uuid)}>
                  Explain this
                </Button>
                {canManage && (
                  <>
                    {['open', 'under_review'].includes(c.status) && (
                      <Button
                        variant="secondary"
                        disabled={c.owner?.id === session?.user?.id && c.has_task}
                        onClick={async () => {
                          if (await act.run(() => send('POST', `${API}/${c.uuid}/assign`, { owner_user_id: session.user.id })))
                            await list.reload();
                        }}
                      >
                        {c.has_task ? 'Reassign to me' : 'Assign to me'}
                      </Button>
                    )}
                    {(NEXT[c.status] || [])
                      .filter((to) => !(c.status === 'open' && to === 'under_review'))
                      .map((to) => (
                        <Button key={to} variant="secondary" onClick={() => setDialog({ item: c, to })}>
                          {to === 'false_positive' ? 'Not an issue' : `Mark ${label(to)}`}
                        </Button>
                      ))}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No cases"
          description={canManage ? 'Run a scan to check this month against the detection rules.' : 'Nothing is flagged in your scope for this filter.'}
        />
      )}
      <p className="m-0 px-5 pb-5 text-xs text-slate-500">{list.data?.limitations}</p>
      {explain && <ExplainPanel uuid={explain} onClose={() => setExplain(null)} />}
      {dialog && (
        <StatusDialog
          {...dialog}
          onClose={() => setDialog(null)}
          onDone={async () => {
            setDialog(null);
            await list.reload();
          }}
        />
      )}
      {settings && (
        <SettingsDialog
          onClose={() => setSettings(false)}
          onDone={async () => {
            setSettings(false);
            await list.reload();
          }}
        />
      )}
    </Card>
  );
}
