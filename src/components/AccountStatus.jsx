import { useEffect, useState } from 'react';
import { Clock, Lock } from 'lucide-react';
import { Button } from './ui';
import { useAuth } from '../lib/auth';
import { ThemeToggle } from '../lib/theme';

function remaining(endsAt, now) {
  const ms = Math.max(0, new Date(endsAt).getTime() - now);
  const h = Math.floor(ms / 3600000),
    m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Banner shown while the 24-hour free trial is running. */
export function TrialBanner() {
  const { session, refresh } = useAuth(),
    [now, setNow] = useState(Date.now());
  const account = session?.account;
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    // The moment the countdown reaches zero the server suspends the account; reload the state.
    if (account?.status === 'trial' && account.trial_ends_at && new Date(account.trial_ends_at).getTime() <= now) refresh();
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!account || account.is_owner || account.status !== 'trial') return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-brand-600 px-4 py-2 text-xs font-medium text-white">
      <Clock size={14} />
      Free trial: {remaining(account.trial_ends_at, now)} left. After that, your account is suspended until the HRMS owner approves it.
    </div>
  );
}

const copy = {
  trial_expired: ['Your free trial has ended', 'Your 24-hour trial is over and your account is suspended. The HRMS owner needs to approve it before you can continue. Your data is safe.'],
  rejected: ['Account not approved', 'The HRMS owner did not approve this account. Contact them if you think this is a mistake.'],
  deactivated: ['Account deactivated', 'This account has been deactivated. Contact the HRMS owner to restore access.'],
  default: ['Account suspended', 'This account is suspended. Contact the HRMS owner to restore access.'],
};

/** Replaces the app while the account is suspended, rejected or deactivated. */
export function AccountLocked() {
  const { session, refresh, logout } = useAuth(),
    [busy, setBusy] = useState(false);
  const a = session.account;
  const key = a.status === 'suspended' && a.reason === 'trial_expired' ? 'trial_expired' : a.status === 'suspended' ? 'default' : a.status;
  const [title, text] = copy[key] || copy.default;
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-white px-6 dark:bg-slate-900">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <div className="max-w-md text-center">
        <Lock size={32} className="mx-auto mb-4 text-brand-500" />
        <h1 className="mb-3 text-2xl font-semibold text-brand-900 dark:text-brand-100">{title}</h1>
        <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">{text}</p>
        {a.note && <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Note from the owner: {a.note}</p>}
        <p className="mb-6 text-xs text-slate-500 dark:text-slate-400">Workspace: {session.tenant.name} · {session.user.email}</p>
        <div className="flex justify-center gap-3">
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await refresh();
              setBusy(false);
            }}
          >
            Check approval status
          </Button>
          <Button variant="secondary" onClick={logout}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
