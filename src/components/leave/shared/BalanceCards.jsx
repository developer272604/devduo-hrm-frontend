import { Link } from 'react-router-dom';
import { Button, Badge, EmptyState } from '../../ui';
import { fmtUnits, fmtDate } from '../../../lib/leaveApi';

const BUCKETS = [
  ['opening', 'Opening'],
  ['accrued', 'Accrued'],
  ['carried', 'Carried'],
  ['consumed', 'Used'],
  ['pending', 'Pending'],
  ['scheduled', 'Scheduled'],
  ['expired', 'Expired'],
];

export function BalanceCard({ item, onLedger, onExplain, canRequest }) {
  const { leave_type: type, balance: b = {}, expiring = [], advance } = item;
  const unit = type?.unit;
  const negative = Number(b.available) < 0;
  return (
    <article
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
      aria-label={`${type?.name} balance`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="m-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{type?.name}</h3>
          <p className="m-0 text-[11px] text-slate-500 dark:text-slate-400">
            {item.account?.period_start && `${fmtDate(item.account.period_start)} to ${fmtDate(item.account.period_end)}`}
          </p>
        </div>
        {type?.is_statutory && <Badge tone="purple">Statutory</Badge>}
      </header>
      <div>
        <p className="m-0 text-[11px] text-slate-500 dark:text-slate-400">Available</p>
        <p
          className={`m-0 text-3xl font-semibold ${negative ? 'text-rose-700 dark:text-rose-300' : 'text-brand-800 dark:text-brand-200'}`}
          data-testid={`available-${type?.code}`}
        >
          {fmtUnits(b.available, unit)}
        </p>
        {negative && <p className="m-0 text-[11px] text-rose-700 dark:text-rose-300">Below zero (limit {fmtUnits(item.account?.negative_limit, unit)}).</p>}
      </div>
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        {BUCKETS.map(([key, label]) => (
          <div key={key} className="min-w-0">
            <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="m-0 font-medium text-slate-800 dark:text-slate-100">{fmtUnits(b[key], unit)}</dd>
          </div>
        ))}
      </dl>
      {expiring.length > 0 && (
        <p className="m-0 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {expiring.map((x) => `${fmtUnits(x.units, unit)} expires ${fmtDate(x.expires_on)}`).join(' · ')}
        </p>
      )}
      {advance && Number(advance.borrowed) > 0 && (
        <p className="m-0 text-[11px] text-slate-600 dark:text-slate-300">
          Includes {fmtUnits(advance.borrowed, unit)} taken in advance
          {advance.covered ? ' (covered by future accrual).' : ` (${fmtUnits(advance.shortfall, unit)} not yet covered).`}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => onLedger(item)} aria-label={`View ${type?.name} ledger`}>
          View ledger
        </Button>
        <Button variant="secondary" onClick={() => onExplain(item)} aria-label={`Why this ${type?.name} balance`}>
          Why this balance?
        </Button>
        {canRequest && (
          <Link
            to={`/leave/new?type=${type?.id ?? type?.uuid ?? ''}`}
            className="inline-flex min-h-10 items-center rounded-lg bg-brand-500 px-4 text-xs font-semibold text-white hover:bg-brand-600"
          >
            Request
          </Link>
        )}
      </div>
    </article>
  );
}

/** One card per leave type. Sensitive types the viewer may not see are already omitted by the server. */
export default function BalanceCards({ items, ...handlers }) {
  if (!items?.length)
    return (
      <EmptyState
        title="No leave balances yet"
        description="When HR opens your leave accounts, your balances will appear here."
      />
    );
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <BalanceCard key={item.account?.id ?? item.leave_type?.id} item={item} {...handlers} />
      ))}
    </div>
  );
}
