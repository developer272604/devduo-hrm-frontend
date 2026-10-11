import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  ErrorState,
  FormError,
  Input,
  MultiSelect,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '../../components/ui';
import { api, download, query } from '../../lib/api';
import { useResource } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';

const body = 'space-y-4 px-6 pb-6';
const num = (v) => (v === '' || v == null ? 0 : Number(v));
const when = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

function NumberField({ label, value, onChange, hint, min = 0 }) {
  return (
    <Input
      label={label}
      hint={hint}
      type="number"
      min={min}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SecuritySettingsPage() {
  const settings = useResource('/v1/security/settings');
  const roles = useResource('/roles');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  useEffect(() => {
    if (settings.data) setForm(settings.data.settings);
  }, [settings.data]);

  const set = (section, key) => (value) => setForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const s = form;
    try {
      const result = await api('/v1/security/settings', {
        method: 'PUT',
        body: {
          mfa: { enforcement: s.mfa.enforcement, role_ids: s.mfa.enforcement === 'roles' ? s.mfa.role_ids : [] },
          session: { idle_minutes: num(s.session.idle_minutes), absolute_minutes: num(s.session.absolute_minutes), max_concurrent: num(s.session.max_concurrent) },
          password: {
            min_length: num(s.password.min_length),
            history: num(s.password.history),
            expiry_days: num(s.password.expiry_days),
            lockout_attempts: num(s.password.lockout_attempts),
            lockout_minutes: num(s.password.lockout_minutes),
          },
          audit: { retention_days: num(s.audit.retention_days) },
          sso: { protocol: s.sso.protocol, issuer: s.sso.issuer || null, client_id: s.sso.client_id || null, metadata_url: s.sso.metadata_url || null },
        },
      });
      setForm(result.settings);
      toast('Security settings saved');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="PHASE 15 · SECURITY & COMPLIANCE"
        title="Security settings"
        description="Multi-factor enforcement, session limits and password policy for this workspace. Every change is audited."
      />
      {settings.loading || !form ? (
        settings.error ? (
          <ErrorState error={settings.error} onRetry={settings.reload} />
        ) : (
          <Skeleton />
        )
      ) : (
        <form onSubmit={save} className="grid max-w-4xl gap-5">
          <FormError error={error} />
          <Card title="Multi-factor authentication">
            <div className={body}>
              <Select
                label="Enforcement"
                value={form.mfa.enforcement}
                onChange={(e) => set('mfa', 'enforcement')(e?.target ? e.target.value : e)}
                options={[
                  { value: 'off', label: 'Optional for everyone' },
                  { value: 'all', label: 'Required for everyone' },
                  { value: 'roles', label: 'Required for selected roles' },
                ]}
              />
              {form.mfa.enforcement === 'roles' && (
                <MultiSelect
                  label="Roles that must use MFA"
                  options={(Array.isArray(roles.data) ? roles.data : roles.data?.data || []).map((r) => ({ value: r.id, label: r.name }))}
                  value={form.mfa.role_ids}
                  onChange={set('mfa', 'role_ids')}
                />
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                People without MFA can only reach the setup screen until they enrol.
              </p>
            </div>
          </Card>
          <Card title="Sessions">
            <div className={`${body} grid gap-x-5 sm:grid-cols-3`}>
              <NumberField label="Idle timeout (minutes)" hint="0 = off" value={form.session.idle_minutes} onChange={set('session', 'idle_minutes')} />
              <NumberField label="Absolute timeout (minutes)" hint="0 = off" value={form.session.absolute_minutes} onChange={set('session', 'absolute_minutes')} />
              <NumberField label="Concurrent sessions per person" hint="0 = unlimited" value={form.session.max_concurrent} onChange={set('session', 'max_concurrent')} />
            </div>
          </Card>
          <Card title="Password policy">
            <div className={`${body} grid gap-x-5 sm:grid-cols-3`}>
              <NumberField label="Minimum length" min={8} value={form.password.min_length} onChange={set('password', 'min_length')} />
              <NumberField label="Remember previous passwords" hint="0 = off" value={form.password.history} onChange={set('password', 'history')} />
              <NumberField label="Expire after (days)" hint="0 = never" value={form.password.expiry_days} onChange={set('password', 'expiry_days')} />
              <NumberField label="Lock after failed sign-ins" hint="0 = off" value={form.password.lockout_attempts} onChange={set('password', 'lockout_attempts')} />
              <NumberField label="Lockout duration (minutes)" min={1} value={form.password.lockout_minutes} onChange={set('password', 'lockout_minutes')} />
            </div>
          </Card>
          <Card title="Audit retention">
            <div className={body}>
              <NumberField label="Retention target (days)" min={365} hint="Recorded policy; automatic audit purging is not implemented." value={form.audit.retention_days} onChange={set('audit', 'retention_days')} />
            </div>
          </Card>
          <Card title="Single sign-on (not live)" action={<Badge tone="amber">Not live</Badge>}>
            <div className={body}>
              <p className="text-sm text-slate-600 dark:text-slate-300" role="note">
                {settings.data.sso_adapter.note} These fields only store configuration for a future OIDC or
                SAML adapter; SSO cannot be enabled.
              </p>
              <Select
                label="Protocol"
                value={form.sso.protocol}
                onChange={(e) => set('sso', 'protocol')(e?.target ? e.target.value : e)}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'oidc', label: 'OpenID Connect' },
                  { value: 'saml', label: 'SAML 2.0' },
                ]}
              />
              <Input label="Issuer URL" value={form.sso.issuer || ''} onChange={(e) => set('sso', 'issuer')(e.target.value)} />
              <Input label="Client ID" value={form.sso.client_id || ''} onChange={(e) => set('sso', 'client_id')(e.target.value)} />
              <Input label="Metadata URL" value={form.sso.metadata_url || ''} onChange={(e) => set('sso', 'metadata_url')(e.target.value)} />
            </div>
          </Card>
          <div>
            <Button type="submit" loading={busy}>
              Save settings
            </Button>
          </div>
        </form>
      )}
    </>
  );
}

export function AuditReviewPage() {
  const { can } = useAuth();
  const [filters, setFilters] = useState({ action: '', module: '', actor: '', from: '', to: '', sensitive: false });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const audit = useResource(`/v1/security/audit?${query({ ...applied, sensitive: applied.sensitive ? 1 : '', page })}`);
  const [verify, setVerify] = useState(null);
  const [purpose, setPurpose] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  async function runVerify() {
    setBusy(true);
    setError(null);
    try {
      setVerify(await api('/v1/security/audit/verify', { method: 'POST' }));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function exportCsv(e) {
    e.preventDefault();
    setError(null);
    try {
      await download(`/v1/security/audit/export?${query({ ...applied, sensitive: applied.sensitive ? 1 : '', purpose })}`, 'audit-export.csv');
      toast('Audit export downloaded and logged');
    } catch (err) {
      setError(err);
    }
  }
  const rows = audit.data?.data || [];

  return (
    <>
      <PageHeader
        eyebrow="PHASE 15 · SECURITY & COMPLIANCE"
        title="Audit review"
        description="Search the tamper-evident audit trail. Exports require a stated purpose and are themselves audited."
      />
      <FormError error={error} />
      <div className="grid gap-5">
        <Card title="Filters">
          <form
            className="grid gap-x-5 px-6 pb-4 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setApplied(filters);
            }}
          >
            <Input label="Action" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} />
            <Input label="Module" value={filters.module} onChange={(e) => setFilters({ ...filters, module: e.target.value })} />
            <Input label="Actor" value={filters.actor} onChange={(e) => setFilters({ ...filters, actor: e.target.value })} />
            <Input label="From" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
            <Input label="To" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
            <label className="mb-5 flex items-center gap-2 self-end pb-3 text-sm">
              <input type="checkbox" checked={filters.sensitive} onChange={(e) => setFilters({ ...filters, sensitive: e.target.checked })} />
              Sensitive access only
            </label>
            <div className="sm:col-span-3">
              <Button type="submit">Search</Button>
            </div>
          </form>
        </Card>
        <Card title="Events">
          {audit.loading ? (
            <Skeleton />
          ) : audit.error ? (
            <ErrorState error={audit.error} onRetry={audit.reload} />
          ) : (
            <>
              <DataTable
                rows={rows}
                empty={{ title: 'No audit events', description: 'Try widening the filters.' }}
                columns={[
                  { key: 'created_at', label: 'Time', render: (r) => when(r.created_at) },
                  { key: 'actor', label: 'Actor' },
                  { key: 'action', label: 'Action' },
                  { key: 'module', label: 'Module' },
                  { key: 'resource', label: 'Resource' },
                  { key: 'ip_address', label: 'IP' },
                  { key: 'chained', label: 'Sealed', render: (r) => (r.chained ? `#${r.sequence}` : 'legacy') },
                ]}
              />
              <Pagination data={audit.data} onChange={setPage} />
            </>
          )}
        </Card>
        <div className="grid gap-5 lg:grid-cols-2">
          {can('security.audit.verify') && (
            <Card title="Integrity check">
              <div className={body}>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Recomputes the hash chain to detect edited, removed or truncated audit rows.
                </p>
                <Button onClick={runVerify} loading={busy}>
                  Verify audit chain
                </Button>
                {verify && (
                  <div role="status" className="text-sm">
                    <Badge tone={verify.ok ? 'green' : 'amber'}>{verify.ok ? 'Chain intact' : 'Tampering detected'}</Badge>
                    <p className="mt-2 text-slate-600 dark:text-slate-300">
                      Checked {verify.checked} sealed events
                      {verify.failure_count ? `, ${verify.failure_count} problem(s): ` : '.'}
                      {verify.failures.map((f) => `#${f.sequence} ${f.reason}`).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}
          {can('security.audit.export') && (
            <Card title="Export evidence">
              <form className={body} onSubmit={exportCsv}>
                <Textarea
                  label="Purpose (required)"
                  required
                  minLength={10}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
                <Button type="submit" disabled={purpose.trim().length < 10}>
                  Download CSV
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

export function LegalHoldPage() {
  const holds = useResource('/v1/security/legal-holds');
  const retention = useResource('/v1/security/retention-policies');
  const [hold, setHold] = useState({ name: '', reason: '', module: '' });
  const [policy, setPolicy] = useState({ data_category: '', module: 'lifecycle', retention_days: '365', action: 'review' });
  const [release, setRelease] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const modules = ['', 'people', 'attendance', 'leave', 'payroll', 'recruitment', 'lifecycle', 'performance', 'learning', 'experience', 'assets', 'expenses', 'travel', 'workflows'];

  async function act(fn, after) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      after?.();
      holds.reload();
      retention.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const post = (path, payload) => api(path, { method: 'POST', body: payload });

  return (
    <>
      <PageHeader
        eyebrow="PHASE 15 · SECURITY & COMPLIANCE"
        title="Legal holds and retention"
        description="Holds suspend automated purging in the covered modules. The retention registry documents intent; it is not legal advice."
      />
      <FormError error={error} />
      <div className="grid gap-5">
        <Card title="Place a legal hold">
          <form
            className="grid gap-x-5 px-6 pb-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => post('/v1/security/legal-holds', { name: hold.name, reason: hold.reason, module: hold.module || null }), () => setHold({ name: '', reason: '', module: '' }));
            }}
          >
            <Input label="Hold name" required value={hold.name} onChange={(e) => setHold({ ...hold, name: e.target.value })} />
            <Select
              label="Covers"
              value={hold.module}
              onChange={(e) => setHold({ ...hold, module: e?.target ? e.target.value : e })}
              options={modules.map((m) => ({ value: m, label: m || 'Whole workspace' }))}
            />
            <div className="sm:col-span-2">
              <Textarea label="Reason" required minLength={5} value={hold.reason} onChange={(e) => setHold({ ...hold, reason: e.target.value })} />
              <Button type="submit" loading={busy}>
                Place hold
              </Button>
            </div>
          </form>
        </Card>
        <Card title="Holds">
          {holds.loading ? (
            <Skeleton />
          ) : holds.error ? (
            <ErrorState error={holds.error} onRetry={holds.reload} />
          ) : (
            <DataTable
              rows={(holds.data?.data || []).map((h) => ({ ...h, id: h.uuid }))}
              empty={{ title: 'No legal holds', description: 'Purge jobs run normally.' }}
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'module', label: 'Covers', render: (h) => h.subject_ref || h.module || 'Whole workspace' },
                { key: 'reason', label: 'Reason' },
                { key: 'active', label: 'Status', render: (h) => <Badge tone={h.active ? 'amber' : 'green'}>{h.active ? 'Active' : 'Released'}</Badge> },
                {
                  key: 'actions',
                  label: 'Release',
                  render: (h) =>
                    h.active ? (
                      <span className="flex items-center gap-2">
                        <input
                          aria-label={`Release reason for ${h.name}`}
                          className="min-h-10 w-40 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                          placeholder="Reason"
                          value={release[h.uuid] || ''}
                          onChange={(e) => setRelease({ ...release, [h.uuid]: e.target.value })}
                        />
                        <Button variant="secondary" disabled={busy || (release[h.uuid] || '').trim().length < 5} onClick={() => act(() => post(`/v1/security/legal-holds/${h.uuid}/release`, { reason: release[h.uuid] }))}>
                          Release
                        </Button>
                      </span>
                    ) : (
                      h.release_reason
                    ),
                },
              ]}
            />
          )}
        </Card>
        <Card title="Retention policy registry">
          <form
            className="grid gap-x-5 px-6 pb-4 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => post('/v1/security/retention-policies', { ...policy, retention_days: num(policy.retention_days) }), () => setPolicy({ ...policy, data_category: '' }));
            }}
          >
            <Input label="Data category" required value={policy.data_category} onChange={(e) => setPolicy({ ...policy, data_category: e.target.value })} />
            <Select label="Module" value={policy.module} onChange={(e) => setPolicy({ ...policy, module: e?.target ? e.target.value : e })} options={modules.filter(Boolean)} />
            <Input label="Retention (days)" type="number" min={1} required value={policy.retention_days} onChange={(e) => setPolicy({ ...policy, retention_days: e.target.value })} />
            <Select label="Action" value={policy.action} onChange={(e) => setPolicy({ ...policy, action: e?.target ? e.target.value : e })} options={['review', 'purge', 'anonymize']} />
            <div className="sm:col-span-4">
              <Button type="submit" loading={busy}>
                Add policy
              </Button>
            </div>
          </form>
          {retention.loading ? (
            <Skeleton rows={2} />
          ) : retention.error ? (
            <ErrorState error={retention.error} onRetry={retention.reload} />
          ) : (
            <DataTable
              rows={(retention.data?.data || []).map((p) => ({ ...p, id: p.uuid }))}
              empty={{ title: 'No retention policies', description: 'Add the categories your counsel has approved.' }}
              columns={[
                { key: 'data_category', label: 'Category' },
                { key: 'module', label: 'Module' },
                { key: 'retention_days', label: 'Days' },
                { key: 'action', label: 'Action' },
                { key: 'held', label: 'Hold', render: (p) => (p.held ? <Badge tone="amber">On hold</Badge> : '—') },
              ]}
            />
          )}
        </Card>
      </div>
    </>
  );
}
