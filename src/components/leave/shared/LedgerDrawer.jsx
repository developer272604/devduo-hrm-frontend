import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useResource } from '../../../lib/hooks';
import { query } from '../../../lib/api';
import { leavePaths, fmtDate, fmtUnits, unwrap } from '../../../lib/leaveApi';
import { Drawer, EmptyState, Resource, Badge } from '../../ui';

const entriesOf = (res) => {
  const d = unwrap(res);
  return d?.entries ?? d?.statement ?? (Array.isArray(d) ? d : []);
};
const kindLabel = (e) => String(e.kind ?? e.type ?? e.bucket ?? 'entry').replaceAll('_', ' ');
const requestLink = (e) => e.request?.uuid ?? e.request_uuid ?? e.links?.request?.uuid ?? e.links?.request_uuid ?? null;

function CalculationBlock({ id }) {
  const resource = useResource(leavePaths.ledgerEntry(id));
  return (
    <Resource resource={resource}>
      {(res) => {
        const d = unwrap(res);
        const calc = d?.calculation && typeof d.calculation === 'object' ? Object.entries(d.calculation) : [];
        return (
          <div className="mt-2 rounded-lg bg-slate-50 p-3 text-[11px] dark:bg-slate-950" aria-label="Calculation">
            {calc.length === 0 && <p className="m-0 text-slate-500 dark:text-slate-400">No further calculation recorded.</p>}
            <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-1">
              {calc.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-slate-500 dark:text-slate-400">{k.replaceAll('_', ' ')}</dt>
                  <dd className="m-0 wrap-anywhere text-slate-800 dark:text-slate-100">
                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </dd>
                </div>
              ))}
            </dl>
            {(d?.lots || d?.consumed_lots || []).length > 0 && (
              <p className="m-0 mt-2 text-slate-600 dark:text-slate-300">
                Drawn from {(d.lots || d.consumed_lots).length} credit lot(s).
              </p>
            )}
          </div>
        );
      }}
    </Resource>
  );
}

function Entry({ entry, unit }) {
  const [open, setOpen] = useState(false);
  const id = entry.id ?? entry.uuid;
  const link = requestLink(entry);
  const units = Number(entry.units ?? entry.amount ?? 0);
  return (
    <li className="space-y-1 py-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold capitalize text-slate-800 dark:text-slate-100">{kindLabel(entry)}</span>
        <span className={units < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}>
          {units > 0 ? '+' : ''}
          {fmtUnits(entry.units ?? entry.amount, unit)}
        </span>
      </div>
      <p className="m-0 text-slate-500 dark:text-slate-400">
        {fmtDate(entry.effective_date ?? entry.date ?? entry.posted_at)}
        {entry.running_balance != null || entry.balance != null
          ? ` · balance ${fmtUnits(entry.running_balance ?? entry.balance, unit)}`
          : ''}
        {entry.status && entry.status !== 'posted' ? ` · ${entry.status}` : ''}
      </p>
      {(entry.explain || entry.sentence) && (
        <p className="m-0 text-slate-700 dark:text-slate-200">{entry.explain || entry.sentence}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {link && (
          <Link className="text-brand-700 underline dark:text-brand-300" to={`/leave/requests/${link}`}>
            View request
          </Link>
        )}
        {id && (
          <button
            type="button"
            className="p-0 text-brand-700 underline dark:text-brand-300"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? 'Hide calculation' : 'Show calculation'}
          </button>
        )}
      </div>
      {open && id && <CalculationBlock id={id} />}
    </li>
  );
}

/** Traceable statement for one leave account: every entry with its explanation, links and calculation. */
export default function LedgerDrawer({ item, onClose, asOf }) {
  const account = item?.account?.id ?? item?.account?.uuid;
  return (
    <Drawer open={!!item} onClose={onClose} title={item ? `${item.leave_type?.name} ledger` : 'Ledger'}>
      {item && <LedgerBody account={account} unit={item.leave_type?.unit} asOf={asOf} />}
    </Drawer>
  );
}

function LedgerBody({ account, unit, asOf }) {
  const resource = useResource(`${leavePaths.ledger(account)}?${query({ as_of: asOf })}`);
  return (
    <Resource resource={resource}>
      {(res) => {
        const entries = entriesOf(res);
        const integrity = unwrap(res)?.integrity;
        return (
          <div>
            {integrity && (
              <p className="m-0 mb-3">
                <Badge tone={integrity.consistent === false || integrity.exact === false ? 'amber' : 'green'}>
                  {integrity.consistent === false || integrity.exact === false ? 'Needs review' : 'Ledger verified'}
                </Badge>
              </p>
            )}
            {entries.length === 0 ? (
              <EmptyState title="No ledger entries" description="Credits and usage for this balance will appear here." />
            ) : (
              <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800" aria-label="Ledger entries">
                {entries.map((e, i) => (
                  <Entry key={e.id ?? e.uuid ?? i} entry={e} unit={unit} />
                ))}
              </ul>
            )}
          </div>
        );
      }}
    </Resource>
  );
}
