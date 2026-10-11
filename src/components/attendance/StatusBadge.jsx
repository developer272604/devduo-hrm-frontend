import { statusMeta } from '../../lib/attendanceApi';

export const toneClasses = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  amber: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  rose: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200',
  brand: 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-300',
  slate: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300',
};
export const dotClasses = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  brand: 'bg-brand-500',
  slate: 'bg-slate-400',
};

/** Attendance status chip. Always text plus a dot, never colour alone. */
export default function StatusBadge({ status, label }) {
  const meta = statusMeta(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium ${toneClasses[meta.tone]}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dotClasses[meta.tone]}`} />
      {label || meta.label}
    </span>
  );
}
