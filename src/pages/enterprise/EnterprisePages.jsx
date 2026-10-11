import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Skeleton,
  Textarea,
} from '../../components/ui';
import { send, useList } from '../../lib/timeOfficeApi';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const panel = 'space-y-4 p-5';

export function IntegrationsPage() {
  const { can } = useAuth();
  const canManage = can('integrations.manage');
  const providers = useList('/v1/integrations/providers');
  const connections = useList('/v1/integrations/connections');
  const [provider, setProvider] = useState('');
  const [name, setName] = useState('');
  const [credentialRef, setCredentialRef] = useState('');
  const [scopes, setScopes] = useState('');
  const [selected, setSelected] = useState('');
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function mutate(fn, success) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await connections.reload();
      if (success) success();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function create(e) {
    e.preventDefault();
    await mutate(
      () =>
        send('POST', '/v1/integrations/connections', {
          provider_key: provider,
          name,
          ...(credentialRef ? { credential_ref: credentialRef } : {}),
          scopes: scopes
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      () => {
        setName('');
        setCredentialRef('');
        setScopes('');
      },
    );
  }
  async function showRuns(uuid) {
    setSelected(uuid);
    setError(null);
    try {
      const result = await api(`/v1/integrations/connections/${uuid}/runs`);
      setRuns(result?.data || []);
    } catch (e) {
      setError(e);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="PHASE 14 · ENTERPRISE PLATFORM"
        title="Integrations"
        description="Manage tenant connection metadata and run safe diagnostics. Provider adapters are not live yet."
      />
      {error && <ErrorState error={error} />}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {canManage && (
          <Card title="Register a connection">
            <form className={panel} onSubmit={create}>
              {providers.loading ? (
                <Skeleton rows={2} />
              ) : providers.error ? (
                <ErrorState error={providers.error} onRetry={providers.reload} />
              ) : (
                <>
                  <label className="block text-xs font-semibold">
                    Provider
                    <select
                      required
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="">Choose provider</option>
                      {(providers.rows || []).map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label} · not live
                        </option>
                      ))}
                    </select>
                  </label>
                  <Input
                    label="Connection name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Input
                    label="Secret reference (optional)"
                    value={credentialRef}
                    onChange={(e) => setCredentialRef(e.target.value)}
                    hint="Use a vault/secret URI. Never paste a secret value here."
                  />
                  <Textarea
                    label="Scopes (comma separated)"
                    value={scopes}
                    onChange={(e) => setScopes(e.target.value)}
                  />
                  <Button type="submit" loading={busy}>
                    Save metadata
                  </Button>
                </>
              )}
            </form>
          </Card>
        )}
        <Card title="Connections">
          {connections.loading ? (
            <Skeleton />
          ) : connections.error ? (
            <ErrorState error={connections.error} onRetry={connections.reload} />
          ) : connections.rows.length === 0 ? (
            <EmptyState
              title="No connections"
              description="Register a connection to start tracking its metadata."
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {connections.rows.map((c) => (
                <div key={c.uuid} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm">{c.name}</strong>
                    <Badge>{c.provider_key}</Badge>
                    <Badge tone={c.status === 'active' ? 'green' : 'amber'}>{c.status}</Badge>
                    <Badge>{c.health_status || 'unchecked'}</Badge>
                  </div>
                  <p className="m-0 text-xs text-slate-500">
                    Scopes: {(c.scopes || []).join(', ') || 'none'} · Last checked:{' '}
                    {c.last_checked_at || 'never'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {canManage && (
                      <Button
                        variant="secondary"
                        disabled={busy || c.status === 'revoked'}
                        onClick={() =>
                          mutate(() => send('POST', `/v1/integrations/connections/${c.uuid}/test`))
                        }
                      >
                        Run diagnostic
                      </Button>
                    )}
                    <Button variant="secondary" onClick={() => showRuns(c.uuid)}>
                      History
                    </Button>
                    {canManage && c.status !== 'revoked' && (
                      <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() =>
                          mutate(() =>
                            send('POST', `/v1/integrations/connections/${c.uuid}/revoke`),
                          )
                        }
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                  {selected === c.uuid && (
                    <div className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-950">
                      <strong>Diagnostic history</strong>
                      {runs.length ? (
                        <ul className="mb-0 space-y-2">
                          {runs.map((run) => (
                            <li key={run.uuid || run.id}>
                              {run.status} · {run.started_at || 'time unavailable'} ·{' '}
                              {run.summary?.message ||
                                run.error_code ||
                                'No network request was made.'}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mb-0 mt-2">No diagnostic runs.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

export function AccessReviewsPage() {
  const { session, can } = useAuth();
  const canManage = can('security.access_reviews.manage');
  const campaigns = useList('/v1/security/access-reviews');
  const [selected, setSelected] = useState('');
  const items = useList(selected ? `/v1/security/access-reviews/${selected}/items` : '');
  const [name, setName] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [notes, setNotes] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  async function act(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await campaigns.reload();
      if (selected) await items.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function create(e) {
    e.preventDefault();
    await act(async () => {
      const r = await send('POST', '/v1/security/access-reviews', { name, due_on: dueOn || null });
      setSelected(r.uuid);
      setName('');
    });
  }
  async function review(item, decision) {
    await act(() =>
      send('POST', `/v1/security/access-reviews/${selected}/items/${item.uuid}/review`, {
        decision,
        ...(notes[item.uuid] ? { note: notes[item.uuid] } : {}),
      }),
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="PHASE 15 · SECURITY & COMPLIANCE"
        title="Access reviews"
        description="Review role and permission snapshots. Decisions are audited; access is never revoked automatically."
      />
      {error && <ErrorState error={error} />}
      <div className="grid gap-5 xl:grid-cols-[minmax(16rem,0.7fr)_minmax(0,1.5fr)]">
        <div className="space-y-5">
          {canManage && (
            <Card title="Start a review">
              <form className={panel} onSubmit={create}>
                <Input
                  label="Campaign name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  label="Due date"
                  type="date"
                  required
                  min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                  value={dueOn}
                  onChange={(e) => setDueOn(e.target.value)}
                />
                <Button type="submit" loading={busy}>
                  Create snapshot
                </Button>
              </form>
            </Card>
          )}
          <Card title="Campaigns">
            {campaigns.loading ? (
              <Skeleton rows={2} />
            ) : campaigns.error ? (
              <ErrorState error={campaigns.error} onRetry={campaigns.reload} />
            ) : campaigns.rows.length ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {campaigns.rows.map((c) => (
                  <button
                    key={c.uuid}
                    type="button"
                    onClick={() => setSelected(c.uuid)}
                    className={`block w-full p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-950 ${selected === c.uuid ? 'bg-brand-50 dark:bg-brand-950' : ''}`}
                  >
                    <span className="block text-sm font-semibold">{c.name}</span>
                    <span className="text-xs text-slate-500">
                      {c.status} · Due {c.due_on || 'not set'} · {c.counts?.pending ?? 0} pending
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState title="No review campaigns" />
            )}
          </Card>
        </div>
        <Card title={selected ? 'Snapshot members' : 'Select a campaign'}>
          {!selected ? (
            <EmptyState description="Create a campaign or select an existing one to review its access snapshot." />
          ) : items.loading ? (
            <Skeleton />
          ) : items.error ? (
            <ErrorState error={items.error} onRetry={items.reload} />
          ) : items.rows.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.rows.map((item) => {
                const self = String(item.user?.id) === String(session?.user?.id);
                return (
                  <div key={item.uuid} className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm">
                        {item.user?.name || `User ${item.user?.id}`}
                      </strong>
                      <span className="text-xs text-slate-500">{item.user?.email}</span>
                      <Badge>{item.status}</Badge>
                      {self && <Badge tone="amber">You cannot review your own access</Badge>}
                    </div>
                    <p className="m-0 text-xs text-slate-500">
                      Role snapshot: {JSON.stringify(item.role_snapshot || {})}
                    </p>
                    {canManage && item.status === 'pending' && !self && (
                      <>
                        <Textarea
                          label="Review note (required for exceptions or revoke requests)"
                          value={notes[item.uuid] || ''}
                          onChange={(e) => setNotes({ ...notes, [item.uuid]: e.target.value })}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button disabled={busy} onClick={() => review(item, 'confirmed')}>
                            Confirm access
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={busy || !notes[item.uuid]?.trim()}
                            onClick={() => review(item, 'revoke_requested')}
                          >
                            Request revocation
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={busy || !notes[item.uuid]?.trim()}
                            onClick={() => review(item, 'exception_accepted')}
                          >
                            Accept exception
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No members in this snapshot" />
          )}
        </Card>
      </div>
    </>
  );
}

export function FindingsPage() {
  const [domain, setDomain] = useState('');
  const findings = useList(
    `/v1/intelligence/findings${domain ? `?domain=${encodeURIComponent(domain)}` : ''}`,
  );
  const result = findings.data || {};
  return (
    <>
      <PageHeader
        eyebrow="PHASE 16 · HRMS INTELLIGENCE"
        title="Findings"
        description="Read-only findings from existing module providers, filtered by your permissions."
      />
      <Card
        title="Current findings"
        action={
          <select
            aria-label="Filter findings by domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">All domains</option>
            {[
              'people',
              'attendance',
              'leave',
              'payroll',
              'recruitment',
              'lifecycle',
              'performance',
              'learning',
              'experience',
              'operations',
              'workflow',
            ].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        }
      >
        {findings.loading ? (
          <Skeleton />
        ) : findings.error ? (
          <ErrorState error={findings.error} onRetry={findings.reload} />
        ) : (
          <div className="p-5">
            {result.count ? (
              <div className="space-y-3">
                {result.items.map((item, i) => (
                  <article
                    key={item.id || item.uuid || i}
                    className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <strong className="text-sm">
                        {item.title || item.label || item.type || 'Finding'}
                      </strong>
                      {item.domain && <Badge>{item.domain}</Badge>}
                      {item.severity && (
                        <Badge tone={item.severity === 'high' ? 'amber' : 'neutral'}>
                          {item.severity}
                        </Badge>
                      )}
                    </div>
                    <p className="mb-0 text-xs text-slate-600 dark:text-slate-300">
                      {item.description || item.message || JSON.stringify(item)}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No findings"
                description="There are no permission-visible findings for this filter."
              />
            )}
            <p className="mb-0 mt-5 text-xs text-slate-500">
              Generated {result.generated_at || '—'}. {result.limitations || ''}
            </p>
          </div>
        )}
      </Card>
    </>
  );
}
