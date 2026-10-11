import { toneClasses, dotClasses } from '../../attendance/StatusBadge';
import { statusMeta } from '../../../lib/leaveApi';

/** Request status chip. Text plus a dot, never colour alone. */
export function StatusChip({ status }) {
  const meta = statusMeta(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium ${toneClasses[meta.tone]}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dotClasses[meta.tone]}`} />
      {meta.label}
    </span>
  );
}

const SEVERITY = {
  info: { tone: 'slate', label: 'Info' },
  warning: { tone: 'amber', label: 'Warning' },
  escalate: { tone: 'brand', label: 'Needs HR' },
  block: { tone: 'rose', label: 'Blocked' },
};

export function SeverityChip({ severity }) {
  const meta = SEVERITY[severity] || SEVERITY.info;
  return (
    <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium ${toneClasses[meta.tone]}`}>
      {meta.label}
    </span>
  );
}

/** Conflicts from preview/detail: overlap, blackout, staffing, balance... with severity. Messages come from the server. */
export function ConflictList({ conflicts = [], label = 'Conflicts' }) {
  if (!conflicts.length) return null;
  return (
    <ul className="m-0 list-none space-y-2 p-0" aria-label={label}>
      {conflicts.map((c, i) => (
        <li
          key={`${c.kind}-${i}`}
          className="flex flex-wrap items-start gap-2 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700"
        >
          <SeverityChip severity={c.severity} />
          <span className="min-w-0 flex-1 text-slate-700 wrap-anywhere dark:text-slate-200">
            {c.message || c.detail || String(c.kind || 'Conflict').replaceAll('_', ' ')}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TypeDot({ color }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-2.5 shrink-0 rounded-full bg-slate-400"
      data-color={color || undefined}
    />
  );
}
