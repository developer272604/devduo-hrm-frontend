import { useState } from 'react';
import { useResource } from '../../../lib/hooks';
import { query } from '../../../lib/api';
import { leavePaths, fmtUnits, fmtDate, unwrap, listOf } from '../../../lib/leaveApi';
import { Card, EmptyState, Resource, Select } from '../../ui';

/** Month-end projection per account, from /forecast. Accrual may be 0 when the engine is not available. */
export default function ForecastPanel() {
  const [months, setMonths] = useState('6');
  const resource = useResource(`${leavePaths.forecast}?${query({ months })}`);
  return (
    <Card
      title="Forecast"
      action={
        <Select
          label="Months ahead"
          value={months}
          onChange={(e) => setMonths(e.target.value)}
          options={['3', '6', '12'].map((m) => ({ value: m, label: `${m} months` }))}
        />
      }
    >
      <div className="px-6 pb-6">
        <Resource resource={resource}>
          {(res) => {
            const d = unwrap(res);
            const accounts = d?.accounts ?? (Array.isArray(d) ? d : listOf(res));
            if (!accounts.length)
              return <EmptyState title="No forecast yet" description="A forecast appears once you have an open leave account." />;
            return (
              <div className="space-y-5">
                {accounts.map((a, i) => (
                  <section key={a.account_uuid ?? i} aria-label={`${a.leave_type?.name ?? 'Leave'} forecast`}>
                    <h3 className="m-0 mb-2 text-sm font-semibold">{a.leave_type?.name ?? 'Leave'}</h3>
                    <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 text-xs sm:grid-cols-3 lg:grid-cols-6">
                      {(a.points || []).map((p) => (
                        <li key={p.date} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                          <span className="block text-slate-500 dark:text-slate-400">{fmtDate(p.date)}</span>
                          <strong className="text-sm">{fmtUnits(p.projected_available ?? p.ledger_available, a.leave_type?.unit)}</strong>
                        </li>
                      ))}
                    </ul>
                    {(a.expiring_lots || d?.expiring_lots || []).length > 0 && (
                      <p className="m-0 mt-2 text-[11px] text-amber-800 dark:text-amber-200">
                        Expiring:{' '}
                        {(a.expiring_lots || d.expiring_lots)
                          .map((l) => `${fmtUnits(l.units, a.leave_type?.unit)} on ${fmtDate(l.expires_on)}`)
                          .join(', ')}
                      </p>
                    )}
                  </section>
                ))}
              </div>
            );
          }}
        </Resource>
      </div>
    </Card>
  );
}
