import { useResource } from '../../../lib/hooks';
import { query } from '../../../lib/api';
import { leavePaths, fmtUnits, unwrap, listOf } from '../../../lib/leaveApi';
import { Badge, EmptyState, Modal, Resource } from '../../ui';

function Account({ account }) {
  const unit = account.leave_type?.unit;
  const buckets = Object.entries(account.buckets || {});
  return (
    <section className="space-y-3" aria-label="Balance explanation">
      {account.summary && <p className="m-0 text-sm text-slate-800 dark:text-slate-100">{account.summary}</p>}
      {account.entitlement?.sentence && (
        <p className="m-0 text-xs text-slate-600 dark:text-slate-300">{account.entitlement.sentence}</p>
      )}
      {buckets.length > 0 && (
        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {buckets.map(([name, b]) => (
            <div key={name}>
              <dt className="capitalize text-slate-500 dark:text-slate-400">{name.replaceAll('_', ' ')}</dt>
              <dd className="m-0 font-medium text-slate-800 dark:text-slate-100">{fmtUnits(b?.units ?? b, unit)}</dd>
            </div>
          ))}
        </dl>
      )}
      {(account.ledger || []).length > 0 && (
        <ol className="m-0 list-decimal space-y-1 pl-5 text-xs text-slate-700 dark:text-slate-200">
          {account.ledger.map((l, i) => (
            <li key={l.id ?? i}>{l.sentence || l.explain}</li>
          ))}
        </ol>
      )}
      {account.integrity && (
        <Badge tone={account.integrity.consistent === false ? 'amber' : 'green'}>
          {account.integrity.consistent === false ? 'Ledger needs review' : 'Ledger checks out'}
        </Badge>
      )}
    </section>
  );
}

/** "Why this balance": the server's own sentences for how the number was reached (never recomputed client side). */
export default function ExplainerPanel({ item, onClose, asOf }) {
  const type = item?.leave_type;
  const path = item ? `${leavePaths.explainBalance}?${query({ leave_type: type?.id ?? type?.uuid, as_of: asOf })}` : null;
  return (
    <Modal open={!!item} onClose={onClose} title={item ? `Why your ${type?.name} balance is what it is` : 'Balance'}>
      {item && <ExplainerBody path={path} />}
    </Modal>
  );
}

function ExplainerBody({ path }) {
  const resource = useResource(path);
  return (
    <Resource resource={resource}>
      {(res) => {
        const accounts = unwrap(res)?.accounts ?? listOf(res);
        return accounts.length ? (
          <div className="space-y-5">
            {accounts.map((a, i) => (
              <Account key={a.account_uuid ?? i} account={a} />
            ))}
          </div>
        ) : (
          <EmptyState title="No explanation available" description="There is nothing to explain for this balance yet." />
        );
      }}
    </Resource>
  );
}
