import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Skeleton,
  StatCard,
} from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { send, useList } from '../../lib/timeOfficeApi';

const BASE = '/v1/integrations';
const panel = 'space-y-4 p-5';
const selectClass =
  'mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900';
const tabs = [
  ['/integrations/health', 'Health'],
  ['/integrations/api-clients', 'API clients'],
  ['/integrations/webhooks', 'Webhooks'],
  ['/integrations/imports', 'Import profiles'],
  ['/integrations', 'Connections'],
];
const when = (iso) => (iso ? new Date(iso).toLocaleString() : 'never');
const tone = (s) =>
  ['active', 'delivered', 'completed', 'dry_run_ok', 'live', 'ok', 'pass'].includes(s)
    ? 'green'
    : ['failed', 'dead_letter', 'revoked', 'attention', 'fail', 'dry_run_errors'].includes(s)
      ? 'red'
      : ['not_live', 'degraded', 'warn', 'retry', 'pending', 'completed_with_errors'].includes(s)
        ? 'amber'
        : 'neutral';

function PlatformShell({ title, description, children }) {
  return (
    <>
      <PageHeader eyebrow="PHASE 14 · INTEGRATION PLATFORM" title={title} description={description} />
      <nav aria-label="Integration sections" className="mb-5 flex flex-wrap gap-2">
        {tabs.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `inline-flex min-h-10 items-center rounded-lg border px-4 text-xs font-semibold ${
                isActive
                  ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-slate-900 dark:text-brand-300'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      {children}
    </>
  );
}

function ListState({ list, empty, children }) {
  if (list.loading) return <Skeleton />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (!list.rows.length) return <EmptyState title={empty.title} description={empty.description} />;
  return children;
}

/** One-time secret display; the value is never requested from the server again. */
function SecretOnce({ label, value, onDismiss }) {
  return (
    <div
      role="alert"
      className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950"
    >
      <strong>{label}</strong>
      <p className="my-2 text-xs">Copy it now. It is shown only once and cannot be retrieved later.</p>
      <code className="block break-all rounded-lg bg-white p-3 text-xs dark:bg-slate-900">{value}</code>
      <Button variant="secondary" className="mt-3" onClick={onDismiss}>
        I have stored it
      </Button>
    </div>
  );
}

function useMutation(reload) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      if (reload) await reload();
      return result;
    } catch (e) {
      setError(e);
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { error, busy, run };
}

export function IntegrationHealthPage() {
  const health = useList(`${BASE}/health`);
  const diagnostics = useList(`${BASE}/diagnostics`);
  const h = health.data || {};
  return (
    <PlatformShell
      title="Integration health"
      description="Live status from this workspace. Provider adapters without code are shown as not live; nothing is simulated."
    >
      {health.loading ? (
        <Skeleton />
      ) : health.error ? (
        <ErrorState error={health.error} onRetry={health.reload} />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <strong className="text-sm">Overall</strong>
            <Badge tone={tone(h.status)}>{h.status}</Badge>
          </div>
          {(h.issues || []).length > 0 && (
            <Card title="Needs attention">
              <ul className="m-0 list-none space-y-2 p-5 text-sm">
                {h.issues.map((i) => (
                  <li key={i.message} className="flex flex-wrap items-center gap-2">
                    <Badge tone={i.severity === 'high' ? 'red' : 'amber'}>{i.severity}</Badge>
                    <span>{i.message}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active API clients" value={h.api?.active_clients ?? 0} detail={`${h.api?.requests_24h ?? 0} requests in 24h`} />
            <StatCard label="Rate limited (24h)" value={h.api?.rate_limited_24h ?? 0} detail={`${h.api?.errors_24h ?? 0} error responses`} />
            <StatCard label="Webhook backlog" value={h.webhooks?.backlog ?? 0} detail={`${h.webhooks?.delivered_24h ?? 0} delivered in 24h`} />
            <StatCard label="Dead letters" value={h.webhooks?.dead_letters ?? 0} detail={`${h.imports?.failed_24h ?? 0} failed imports in 24h`} />
          </div>
          <Card title="Adapters">
            <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800">
              {(h.adapters || []).map((a) => (
                <li key={a.key} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                  <strong className="min-w-0 flex-1">{a.label}</strong>
                  <Badge tone={tone(a.state)}>{a.state === 'not_live' ? 'not live' : a.state}</Badge>
                  <span className="w-full text-xs text-slate-500">{a.note}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Diagnostics">
            <ListState list={diagnostics} empty={{ title: 'No checks', description: 'Diagnostics are unavailable.' }}>
              <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800">
                {diagnostics.rows.map((c) => (
                  <li key={c.key} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                    <Badge tone={tone(c.status)}>{c.status}</Badge>
                    <strong>{c.label}</strong>
                    <span className="text-xs text-slate-500">{c.detail}</span>
                  </li>
                ))}
              </ul>
            </ListState>
          </Card>
        </div>
      )}
    </PlatformShell>
  );
}

export function ApiClientsPage() {
  const { can } = useAuth();
  const canManage = can('integrations.api_clients.manage');
  const clients = useList(`${BASE}/api-clients`);
  const scopes = clients.data?.scopes || [];
  const { error, busy, run } = useMutation(clients.reload);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState(['employees:read']);
  const [rate, setRate] = useState('60');
  const [ips, setIps] = useState('');
  const [secret, setSecret] = useState(null);
  const [log, setLog] = useState({ uuid: '', rows: [] });

  async function create(e) {
    e.preventDefault();
    const res = await run(() =>
      send('POST', `${BASE}/api-clients`, {
        name,
        scopes: picked,
        rate_limit_per_minute: Number(rate) || 60,
        ip_allowlist: ips.split(',').map((s) => s.trim()).filter(Boolean),
      }),
    );
    if (res?.key) {
      setSecret({ label: `API key for ${res.client.name}`, value: res.key });
      setName('');
    }
  }
  async function rotate(c) {
    const res = await run(() => send('POST', `${BASE}/api-clients/${c.uuid}/rotate`, { grace_minutes: 0 }));
    if (res?.key) setSecret({ label: `New API key for ${c.name}`, value: res.key });
  }
  async function showLog(uuid) {
    const res = await run(() => api(`${BASE}/api-clients/${uuid}/requests`));
    setLog({ uuid, rows: res?.data || [] });
  }
  const toggle = (key) => setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  return (
    <PlatformShell
      title="API clients"
      description="Tenant-scoped, read-only public API v1 keys. Keys are stored hashed and shown once."
    >
      {secret && <SecretOnce {...secret} onDismiss={() => setSecret(null)} />}
      {error && <ErrorState error={error} />}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {canManage && (
          <Card title="Create API client">
            <form className={panel} onSubmit={create}>
              <Input label="Client name" required value={name} onChange={(e) => setName(e.target.value)} />
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold">Scopes</legend>
                {scopes.map((s) => (
                  <label key={s.key} className="flex items-start gap-2 text-xs">
                    <input type="checkbox" checked={picked.includes(s.key)} onChange={() => toggle(s.key)} className="mt-0.5" />
                    <span>
                      <code>{s.key}</code> · {s.description}
                    </span>
                  </label>
                ))}
              </fieldset>
              <Input label="Rate limit (requests per minute)" type="number" min="1" value={rate} onChange={(e) => setRate(e.target.value)} />
              <Input label="IP allow-list (optional, comma separated)" value={ips} onChange={(e) => setIps(e.target.value)} hint="Addresses or CIDR ranges. Empty allows any IP." />
              <Button type="submit" loading={busy} disabled={!picked.length}>
                Create client
              </Button>
            </form>
          </Card>
        )}
        <Card title="Clients">
          <ListState list={clients} empty={{ title: 'No API clients', description: 'Create a client to let another system read employee and department data.' }}>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {clients.rows.map((c) => (
                <div key={c.uuid} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm">{c.name}</strong>
                    <Badge tone={tone(c.status)}>{c.status}</Badge>
                    <code className="text-xs">{c.key_prefix}…</code>
                  </div>
                  <p className="m-0 text-xs text-slate-500">
                    Scopes: {c.scopes.join(', ')} · {c.rate_limit_per_minute}/min · IPs: {c.ip_allowlist.length ? c.ip_allowlist.join(', ') : 'any'} · Last used: {when(c.last_used_at)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => showLog(c.uuid)}>
                      Request log
                    </Button>
                    {canManage && c.status === 'active' && (
                      <>
                        <Button variant="secondary" disabled={busy} onClick={() => rotate(c)}>
                          Rotate key
                        </Button>
                        <Button variant="danger" disabled={busy} onClick={() => run(() => send('POST', `${BASE}/api-clients/${c.uuid}/revoke`))}>
                          Revoke
                        </Button>
                      </>
                    )}
                  </div>
                  {log.uuid === c.uuid && (
                    <div className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-950">
                      {log.rows.length ? (
                        <ul className="m-0 list-none space-y-1 p-0">
                          {log.rows.map((r, i) => (
                            <li key={`${r.created_at}-${i}`}>
                              {r.status} · {r.method} {r.path} · {r.ip} · {when(r.created_at)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        'No requests yet.'
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ListState>
        </Card>
      </div>
    </PlatformShell>
  );
}

export function WebhooksPage() {
  const { can } = useAuth();
  const canManage = can('integrations.webhooks.manage');
  const endpoints = useList(`${BASE}/webhooks`);
  const eventTypes = endpoints.data?.event_types || [];
  const { error, busy, run } = useMutation(endpoints.reload);
  const [form, setForm] = useState({ name: '', url: '' });
  const [events, setEvents] = useState([]);
  const [secret, setSecret] = useState(null);
  const [selected, setSelected] = useState('');
  const [deliveries, setDeliveries] = useState([]);

  async function loadDeliveries(uuid) {
    setSelected(uuid);
    const res = await run(() => api(`${BASE}/webhooks/${uuid}/deliveries`));
    setDeliveries(res?.data || []);
  }
  async function create(e) {
    e.preventDefault();
    const res = await run(() => send('POST', `${BASE}/webhooks`, { ...form, events }));
    if (res?.secret) {
      setSecret({ label: `Signing secret for ${res.endpoint.name}`, value: res.secret });
      setForm({ name: '', url: '' });
      setEvents([]);
    }
  }
  async function rotate(w) {
    const res = await run(() => send('POST', `${BASE}/webhooks/${w.uuid}/rotate-secret`));
    if (res?.secret) setSecret({ label: `New signing secret for ${w.name}`, value: res.secret });
  }
  async function replay(d) {
    await run(() => send('POST', `${BASE}/webhook-deliveries/${d.uuid}/replay`));
    await loadDeliveries(selected);
  }
  const toggle = (key) => setEvents((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  return (
    <PlatformShell
      title="Webhooks"
      description="Signed outbound events with retries, dead-letter and manual replay. Payloads contain identifiers only."
    >
      {secret && <SecretOnce {...secret} onDismiss={() => setSecret(null)} />}
      {error && <ErrorState error={error} />}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {canManage && (
          <Card title="Register endpoint">
            <form className={panel} onSubmit={create}>
              <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="HTTPS URL" required type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} hint="Private, loopback and link-local addresses are blocked." />
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold">Events</legend>
                {eventTypes.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={events.includes(t)} onChange={() => toggle(t)} />
                    <code>{t}</code>
                  </label>
                ))}
              </fieldset>
              <Button type="submit" loading={busy} disabled={!events.length}>
                Create endpoint
              </Button>
            </form>
          </Card>
        )}
        <div className="space-y-5">
          <Card title="Endpoints">
            <ListState list={endpoints} empty={{ title: 'No webhook endpoints', description: 'Register an HTTPS endpoint to receive signed events.' }}>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {endpoints.rows.map((w) => (
                  <div key={w.uuid} className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm">{w.name}</strong>
                      <Badge tone={tone(w.status)}>{w.status}</Badge>
                      {w.dead_letters > 0 && <Badge tone="red">{w.dead_letters} dead-lettered</Badge>}
                    </div>
                    <p className="m-0 break-all text-xs text-slate-500">
                      {w.url} · {w.events.join(', ')} · {w.pending_deliveries} pending · {w.consecutive_failures} consecutive failures
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => loadDeliveries(w.uuid)}>
                        Delivery log
                      </Button>
                      {canManage && w.status === 'active' && (
                        <>
                          <Button variant="secondary" disabled={busy} onClick={() => run(() => send('POST', `${BASE}/webhooks/${w.uuid}/test`))}>
                            Send test
                          </Button>
                          <Button variant="secondary" disabled={busy} onClick={() => rotate(w)}>
                            Rotate secret
                          </Button>
                          <Button variant="danger" disabled={busy} onClick={() => run(() => send('DELETE', `${BASE}/webhooks/${w.uuid}`))}>
                            Disable
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ListState>
          </Card>
          {selected && (
            <Card title="Delivery log">
              {deliveries.length === 0 ? (
                <EmptyState title="No deliveries" description="Events appear here once they are queued." />
              ) : (
                <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800">
                  {deliveries.map((d) => (
                    <li key={d.uuid} className="flex flex-wrap items-center gap-2 p-4 text-xs">
                      <Badge tone={tone(d.status)}>{d.status.replace('_', ' ')}</Badge>
                      <strong>{d.event_type}</strong>
                      <span>
                        attempt {d.attempts}
                        {d.last_status_code ? ` · HTTP ${d.last_status_code}` : ''}
                        {d.last_error ? ` · ${d.last_error}` : ''}
                      </span>
                      <span className="text-slate-500">{when(d.created_at)}</span>
                      {canManage && d.status !== 'sending' && d.status !== 'pending' && (
                        <Button variant="secondary" disabled={busy} onClick={() => replay(d)}>
                          Replay
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </PlatformShell>
  );
}

export function ImportProfilesPage() {
  const { can } = useAuth();
  const canManage = can('integrations.imports.manage');
  const profiles = useList(`${BASE}/import-profiles`);
  const runs = useList(`${BASE}/import-runs`);
  const kinds = profiles.data?.kinds || [];
  const { error, busy, run } = useMutation(async () => {
    await profiles.reload();
    await runs.reload();
  });
  const [form, setForm] = useState({ name: '', kind: 'attendance_punches', format: 'csv', source: 'upload', mapping: '' });
  const [files, setFiles] = useState({});
  const [dryRun, setDryRun] = useState(true);
  const [items, setItems] = useState({ uuid: '', rows: [] });

  function parseMapping(text) {
    return Object.fromEntries(
      text
        .split('\n')
        .map((l) => l.split('=').map((s) => s.trim()))
        .filter(([k, v]) => k && v),
    );
  }
  async function create(e) {
    e.preventDefault();
    const res = await run(() =>
      send('POST', `${BASE}/import-profiles`, {
        name: form.name,
        kind: form.kind,
        format: form.format,
        source: form.source,
        mapping: parseMapping(form.mapping),
        ...(form.source === 'drop' ? { interval_minutes: 15 } : {}),
      }),
    );
    if (res) setForm({ ...form, name: '', mapping: '' });
  }
  async function runFile(p) {
    const file = files[p.uuid];
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    body.append('dry_run', dryRun ? '1' : '0');
    await run(() => api(`${BASE}/import-profiles/${p.uuid}/runs`, { method: 'POST', body }));
  }
  async function showItems(uuid) {
    const res = await run(() => api(`${BASE}/import-runs/${uuid}/items`));
    setItems({ uuid, rows: res?.data || [] });
  }

  return (
    <PlatformShell
      title="Import profiles"
      description="Local CSV/JSON adapters for attendance punches and the employee master, with column mapping and dry-run. No vendor connection is involved."
    >
      {error && <ErrorState error={error} />}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {canManage && (
          <Card title="New profile">
            <form className={panel} onSubmit={create}>
              <Input label="Profile name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <label className="block text-xs font-semibold">
                Type
                <select className={selectClass} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  {kinds.map((k) => (
                    <option key={k.key} value={k.key}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold">
                File format
                <select className={selectClass} value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
              </label>
              <label className="block text-xs font-semibold">
                Source
                <select className={selectClass} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  <option value="upload">Manual upload</option>
                  <option value="drop">Scheduled file drop folder</option>
                </select>
              </label>
              <label className="block text-xs font-semibold">
                Column mapping (one per line: field = file column)
                <textarea
                  className={`${selectClass} min-h-24 py-2 font-mono`}
                  value={form.mapping}
                  onChange={(e) => setForm({ ...form, mapping: e.target.value })}
                  placeholder={'employee_number = Emp No\ntimestamp = Punch Time'}
                />
              </label>
              <Button type="submit" loading={busy}>
                Save profile
              </Button>
            </form>
          </Card>
        )}
        <div className="space-y-5">
          <Card title="Profiles">
            <ListState list={profiles} empty={{ title: 'No import profiles', description: 'Create a profile to import punches or employees from a file.' }}>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {profiles.rows.map((p) => (
                  <div key={p.uuid} className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm">{p.name}</strong>
                      <Badge>{p.kind_label}</Badge>
                      <Badge>{p.format}</Badge>
                      <Badge tone={tone(p.status)}>{p.status}</Badge>
                      {p.last_run_status && <Badge tone={tone(p.last_run_status)}>{p.last_run_status.replace(/_/g, ' ')}</Badge>}
                    </div>
                    {p.drop_folder && <p className="m-0 break-all text-xs text-slate-500">Drop folder: {p.drop_folder}</p>}
                    {canManage && (
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="text-xs font-semibold">
                          File for {p.name}
                          <input
                            type="file"
                            accept={p.format === 'json' ? '.json' : '.csv'}
                            className="mt-2 block text-xs"
                            onChange={(e) => setFiles({ ...files, [p.uuid]: e.target.files[0] })}
                          />
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                          Dry run (validate only)
                        </label>
                        <Button disabled={busy || !files[p.uuid]} onClick={() => runFile(p)}>
                          {dryRun ? 'Validate file' : 'Import file'}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ListState>
          </Card>
          <Card title="Runs">
            <ListState list={runs} empty={{ title: 'No runs yet', description: 'Runs appear after a file is validated or imported.' }}>
              <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800">
                {runs.rows.map((r) => (
                  <li key={r.uuid} className="space-y-2 p-4 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={tone(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                      <strong>{r.profile_name}</strong>
                      <span>{r.file_name}</span>
                      <span className="text-slate-500">
                        {r.total_rows} rows · {r.valid_rows} valid · {r.error_rows} errors · {r.imported_rows} imported · attempt {r.attempts}
                      </span>
                    </div>
                    {r.error_message && <p className="m-0 text-red-700 dark:text-red-300">{r.error_message}</p>}
                    <div className="flex flex-wrap gap-2">
                      {r.error_rows > 0 && (
                        <Button variant="secondary" onClick={() => showItems(r.uuid)}>
                          Row errors
                        </Button>
                      )}
                      {canManage && r.status === 'failed' && (
                        <Button variant="secondary" disabled={busy} onClick={() => run(() => send('POST', `${BASE}/import-runs/${r.uuid}/retry`))}>
                          Retry
                        </Button>
                      )}
                    </div>
                    {items.uuid === r.uuid && (
                      <ul className="m-0 list-none space-y-1 rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                        {items.rows.map((i) => (
                          <li key={i.row_number}>
                            Row {i.row_number}: {i.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </ListState>
          </Card>
        </div>
      </div>
    </PlatformShell>
  );
}
