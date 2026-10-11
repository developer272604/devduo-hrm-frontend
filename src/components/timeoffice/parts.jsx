import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Info, Lock, LoaderCircle } from 'lucide-react';
import { Badge, ErrorState, PageHeader, Card } from '../ui';
import { useAuth } from '../../lib/auth';
import { titleCase } from '../../lib/timeOfficeApi';

const TONES = {
  green: ['present', 'approved', 'published', 'active', 'completed', 'applied', 'resolved', 'locked', 'success', 'ok', 'ready', 'finalized'],
  amber: ['pending', 'pending_approval', 'draft', 'late', 'partial', 'queued', 'running', 'warning', 'open', 'changed', 'processing', 'action_required', 'missing_punch', 'half_day', 'unlock_requested'],
  purple: ['info', 'holiday', 'weekly_off', 'leave', 'on_duty', 'scheduled', 'acknowledged'],
};
export const toneOf = (status) => {
  const s = String(status ?? '').toLowerCase();
  if (['rejected', 'failed', 'absent', 'error', 'critical', 'revoked', 'blocked', 'retired'].includes(s)) return 'neutral';
  return Object.keys(TONES).find((t) => TONES[t].includes(s)) ?? 'neutral';
};
/** Status chip. Text always carries the meaning; colour is only reinforcement (never colour alone). */
export const StatusBadge = ({ status, children }) => (
  <Badge tone={toneOf(status)}>{children ?? titleCase(status) ?? '—'}</Badge>
);

const bannerTone = {
  info: 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200',
  warn: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  error: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
};
const bannerIcon = { info: Info, warn: AlertTriangle, error: AlertTriangle, success: CheckCircle2 };
export function Banner({ tone = 'info', title, children, action, role }) {
  const Icon = bannerIcon[tone];
  return (
    <div className={`mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-xs ${bannerTone[tone]}`} role={role ?? (tone === 'error' ? 'alert' : 'status')}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <strong className="block text-sm">{title}</strong>}
        {children}
      </div>
      {action}
    </div>
  );
}
export const LockedBanner = ({ children = 'This period is locked. Changes are blocked until an approved unlock.' }) => (
  <Banner tone="warn" title="Locked">
    <span className="inline-flex items-center gap-1">
      <Lock size={12} /> {children}
    </span>
  </Banner>
);
export const ProcessingBanner = ({ children = 'Attendance is being recalculated. Figures may change when it finishes.' }) => (
  <Banner tone="info" title="Processing">
    <span className="inline-flex items-center gap-1">
      <LoaderCircle size={12} className="animate-spin motion-reduce:animate-none" /> {children}
    </span>
  </Banner>
);
/** Shown when an operation succeeded for some rows only. `items` is a short list of failure messages. */
export const PartialFailure = ({ failed, total, items = [] }) =>
  failed > 0 ? (
    <Banner tone="warn" title={`Partly completed: ${failed} of ${total} could not be processed`}>
      {items.length > 0 && (
        <ul className="m-0 mt-1 list-disc pl-4">
          {items.slice(0, 5).map((m, i) => (
            <li key={i}>{typeof m === 'string' ? m : (m.message ?? JSON.stringify(m))}</li>
          ))}
        </ul>
      )}
    </Banner>
  ) : null;

export const Progress = ({ value = 0, max = 100, label }) => (
  <progress
    className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-brand-500 [&::-webkit-progress-bar]:bg-slate-200 dark:[&::-webkit-progress-bar]:bg-slate-700 [&::-webkit-progress-value]:bg-brand-500"
    value={value}
    max={max || 1}
    aria-label={label}
  />
);

/** Page frame: header + permission gate. Without permission the page shows the shared 403 state instead of dead controls. */
export function Screen({ title, description, action, permission, children }) {
  const { can } = useAuth();
  if (permission && !can(permission))
    return (
      <>
        <PageHeader title={title} />
        <ErrorState error={{ status: 403, message: 'Your role does not include access to this section. Contact your administrator.' }} />
      </>
    );
  return (
    <>
      <PageHeader title={title} description={description} action={action} />
      {children}
    </>
  );
}

export const LinkButton = ({ to, children }) => (
  <Link
    to={to}
    className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-brand-950"
  >
    {children}
  </Link>
);

/** Renders any preview/impact object: numbers as tiles, arrays as short lists, strings as notes. Server wording is shown as-is. */
export function Impact({ data }) {
  if (!data || typeof data !== 'object') return null;
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined);
  const nums = entries.filter(([, v]) => typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.length < 40));
  const lists = entries.filter(([, v]) => Array.isArray(v) && v.length);
  const objs = entries.filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v));
  return (
    <div className="space-y-3 text-xs">
      {nums.length > 0 && (
        <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {nums.map(([k, v]) => (
            <div key={k} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              <dt className="text-slate-500 dark:text-slate-400">{titleCase(k)}</dt>
              <dd className="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {objs.map(([k, v]) => (
        <div key={k}>
          <strong className="capitalize">{titleCase(k)}</strong>
          <Impact data={v} />
        </div>
      ))}
      {lists.map(([k, v]) => (
        <div key={k}>
          <strong className="capitalize">{titleCase(k)}</strong>
          <ul className="m-0 mt-1 list-disc pl-4 text-slate-600 dark:text-slate-300">
            {v.slice(0, 8).map((x, i) => (
              <li key={i}>{typeof x === 'object' ? Object.values(x).filter((y) => typeof y !== 'object').join(' · ') : String(x)}</li>
            ))}
            {v.length > 8 && <li>and {v.length - 8} more</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}

export const Panel = ({ title, action, children }) => (
  <Card title={title} action={action} className="mb-5">
    {children}
  </Card>
);

/**
 * Wraps a page so that, without permission, it renders the shared 403 state and mounts nothing else
 * (no data requests are made for a page the user cannot open).
 */
export function guarded(Page, { title, permission }) {
  function Guarded(props) {
    const { can } = useAuth();
    if (permission && !can(permission))
      return (
        <>
          <PageHeader title={title} />
          <ErrorState error={{ status: 403, message: 'Your role does not include access to this section. Contact your administrator.' }} />
        </>
      );
    return <Page {...props} />;
  }
  Guarded.displayName = `Guarded(${title})`;
  return Guarded;
}
