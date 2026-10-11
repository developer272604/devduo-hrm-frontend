import { useRef, useState } from 'react';
import { Badge, Button, Card, DataTable, ErrorState, FormError, Input, Skeleton } from '../../components/ui';
import { api } from '../../lib/api';
import { useResource } from '../../lib/hooks';

const body = 'space-y-4 px-6 pb-6';
const mono =
  'block break-all rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-100';

/** Second login step. `onVerified` receives the session payload. */
export function MfaChallengeForm({ onSubmit, busy, error }) {
  const [code, setCode] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(code.trim());
      }}
    >
      <FormError error={error} />
      <Input
        label="Authentication code"
        hint="Enter the 6-digit code from your authenticator app, or a recovery code."
        autoComplete="one-time-code"
        inputMode="text"
        required
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <Button type="submit" loading={busy} className="w-full">
        Verify and sign in
      </Button>
    </form>
  );
}

/** Keeps showing the last loaded data while a reload is in flight so the form does not remount. */
function useSticky(resource) {
  const last = useRef(null);
  if (resource.data) last.current = resource.data;
  const data = resource.data || (resource.error ? null : last.current);
  return { ...resource, data, loading: resource.loading && !data };
}

export function MfaPanel() {
  const status = useSticky(useResource('/v1/security/mfa'));
  const [setup, setSetup] = useState(null);
  const [codes, setCodes] = useState(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setCode('');
      setPassword('');
      status.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const enroll = () => run(async () => setSetup(await api('/v1/security/mfa/enroll', { method: 'POST' })));
  const confirm = (e) => {
    e.preventDefault();
    return run(async () => {
      const result = await api('/v1/security/mfa/confirm', { method: 'POST', body: { code } });
      setCodes(result.recovery_codes);
      setSetup(null);
    });
  };
  const regenerate = (e) => {
    e.preventDefault();
    return run(async () => {
      const result = await api('/v1/security/mfa/recovery-codes', { method: 'POST', body: { code } });
      setCodes(result.recovery_codes);
      setMode('');
    });
  };
  const disable = (e) => {
    e.preventDefault();
    return run(async () => {
      await api('/v1/security/mfa/disable', { method: 'POST', body: { password, code } });
      setMode('');
      setCodes(null);
    });
  };

  return (
    <Card title="Two-factor authentication" className="max-w-156">
      <div className={body}>
        {status.loading ? (
          <Skeleton rows={1} />
        ) : status.error ? (
          <ErrorState error={status.error} onRetry={status.reload} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <Badge tone={status.data.enabled ? 'green' : 'amber'}>
                {status.data.enabled ? 'Enabled' : 'Not enabled'}
              </Badge>
              {status.data.required && <Badge tone="purple">Required by your workspace</Badge>}
              {status.data.enabled && (
                <span>{status.data.recovery_codes_remaining} recovery codes left</span>
              )}
            </div>
            <FormError error={error} />
            {codes && (
              <div
                role="status"
                className="space-y-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-4 text-sm text-amber-800 dark:text-amber-200"
              >
                <p className="font-semibold">Save these recovery codes now. They are shown only once.</p>
                <ul className="grid grid-cols-2 gap-2 font-mono text-xs">
                  {codes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {!status.data.enabled && !setup && (
              <Button onClick={enroll} loading={busy}>
                Set up authenticator app
              </Button>
            )}
            {setup && (
              <form onSubmit={confirm} className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Add this account in your authenticator app using the setup key or the otpauth link
                  below, then enter the 6-digit code.
                </p>
                <div>
                  <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Setup key
                  </span>
                  <code className={mono}>{setup.secret}</code>
                </div>
                <div>
                  <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    otpauth link (for QR generators)
                  </span>
                  <code className={mono}>{setup.otpauth_uri}</code>
                </div>
                <Input
                  label="6-digit code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <Button type="submit" loading={busy}>
                  Verify and turn on
                </Button>
              </form>
            )}
            {status.data.enabled && !mode && (
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => setMode('regenerate')}>
                  New recovery codes
                </Button>
                {!status.data.required && (
                  <Button variant="danger" onClick={() => setMode('disable')}>
                    Turn off
                  </Button>
                )}
              </div>
            )}
            {mode === 'regenerate' && (
              <form onSubmit={regenerate} className="space-y-4">
                <Input
                  label="Current 6-digit code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <Button type="submit" loading={busy}>
                  Generate new codes
                </Button>
              </form>
            )}
            {mode === 'disable' && (
              <form onSubmit={disable} className="space-y-4">
                <Input
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Input
                  label="Current 6-digit code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <Button type="submit" variant="danger" loading={busy}>
                  Turn off two-factor authentication
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

const when = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

export function SessionsPanel() {
  const sessions = useSticky(useResource('/v1/security/sessions'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function act(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      sessions.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const rows = (sessions.data?.data || []).map((s) => ({ ...s, id: s.uuid }));

  return (
    <Card
      title="Active sessions"
      className="max-w-4xl"
      action={
        rows.length > 1 ? (
          <Button
            variant="secondary"
            loading={busy}
            onClick={() => act(() => api('/v1/security/sessions/revoke-others', { method: 'POST' }))}
          >
            Sign out all other sessions
          </Button>
        ) : null
      }
    >
      <div className="px-6 pb-6">
        <FormError error={error} />
        {sessions.loading ? (
          <Skeleton rows={2} />
        ) : sessions.error ? (
          <ErrorState error={sessions.error} onRetry={sessions.reload} />
        ) : (
          <DataTable
            rows={rows}
            empty={{ title: 'No active sessions', description: 'Signed-in devices appear here.' }}
            columns={[
              {
                key: 'device',
                label: 'Device',
                render: (s) => (
                  <span className="flex items-center gap-2">
                    {s.device || 'Unknown device'}
                    {s.current && <Badge tone="green">This device</Badge>}
                  </span>
                ),
              },
              { key: 'ip_address', label: 'IP address' },
              { key: 'signed_in_at', label: 'Signed in', render: (s) => when(s.signed_in_at) },
              { key: 'last_seen_at', label: 'Last seen', render: (s) => when(s.last_seen_at) },
              {
                key: 'actions',
                label: 'Actions',
                render: (s) =>
                  s.current ? null : (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      aria-label={`Sign out ${s.device || 'device'} ${s.ip_address || ''}`}
                      onClick={() => act(() => api(`/v1/security/sessions/${s.uuid}`, { method: 'DELETE' }))}
                    >
                      Sign out
                    </Button>
                  ),
              },
            ]}
          />
        )}
      </div>
    </Card>
  );
}
