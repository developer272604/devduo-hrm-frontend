import { Check } from 'lucide-react';
import { useResource } from '../lib/hooks';

export const money = (amount, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

/** Public monthly price list: each plan with the modules it includes. */
export function PlanCards({ className = '' }) {
  const { data } = useResource('/plans');
  if (!data?.length) return null;
  return (
    <div className={`grid gap-4 min-[769px]:grid-cols-3 ${className}`}>
      {data.map((p) => (
        <div key={p.code} className="rounded-xl border border-slate-200 bg-white p-5 text-left dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-base">{p.name}</h3>
          <p className="my-2 text-3xl font-semibold text-brand-800 dark:text-brand-200">
            {money(p.monthly_price, p.currency)}
            <span className="text-sm font-medium text-slate-500"> / month</span>
          </p>
          {p.description && <p className="mb-3 text-sm">{p.description}</p>}
          <ul className="space-y-1 text-sm text-slate-600">
            {p.modules
              .filter((m) => !['work', 'notifications'].includes(m))
              .map((m) => (
                <li key={m} className="flex items-center gap-2 capitalize">
                  <Check size={14} className="shrink-0 text-brand-500" />
                  {m}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
