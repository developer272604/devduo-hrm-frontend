import { ArrowRight } from 'lucide-react';
import { Badge } from '../ui';
import { maskValue } from '../../lib/changeRequestsApi';

export const statusTone = {
  pending: 'amber',
  approved: 'green',
  applied: 'green',
  rejected: 'neutral',
  cancelled: 'neutral',
};

const show = (change, value) => {
  if (change.sensitive || change.masked) return maskValue(value);
  if (value === null || value === undefined || value === '') return '—';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

/** Before/after list. Sensitive values stay masked; layout stacks on narrow screens. */
export default function ProfileChangesDiff({ changes = [] }) {
  if (!changes.length)
    return <p className="text-xs text-slate-500 dark:text-slate-400">No field details were provided.</p>;
  return (
    <ul className="m-0 list-none space-y-3 p-0" aria-label="Requested changes">
      {changes.map((change) => (
        <li
          key={change.field}
          className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
        >
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
            {change.label || change.field}
            {(change.sensitive || change.masked) && <Badge tone="amber">Sensitive</Badge>}
          </div>
          <div className="grid items-center gap-2 text-sm sm:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-md bg-rose-50 px-3 py-2 dark:bg-rose-950">
              <span className="block text-[10px] uppercase text-rose-700 dark:text-rose-300">Current</span>
              <span className="wrap-break-word">{show(change, change.before)}</span>
            </div>
            <ArrowRight size={16} className="mx-auto rotate-90 text-slate-400 sm:rotate-0" aria-hidden="true" />
            <div className="rounded-md bg-emerald-50 px-3 py-2 dark:bg-emerald-950">
              <span className="block text-[10px] uppercase text-emerald-700 dark:text-emerald-300">Requested</span>
              <span className="wrap-break-word">{show(change, change.after)}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
