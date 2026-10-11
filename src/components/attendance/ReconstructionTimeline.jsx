const kindDot = {
  punch: 'bg-brand-500',
  voided: 'bg-slate-400',
  exception: 'bg-amber-500',
  request: 'bg-emerald-500',
};

/** Chronological "what happened this day" list. items: [{display, label, detail?, kind?, day_label?}]. */
export default function ReconstructionTimeline({ items = [] }) {
  return (
    <section aria-labelledby="recon-heading">
      <h3 id="recon-heading" className="m-0 mb-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
        Day reconstruction
      </h3>
      {items.length === 0 ? (
        <p className="m-0 text-sm text-slate-500 dark:text-slate-400">
          No punches or events were recorded for this day.
        </p>
      ) : (
        <ol className="m-0 list-none space-y-3 border-l border-slate-200 p-0 pl-4 dark:border-slate-700">
          {items.map((it, i) => (
            <li key={i} className="relative">
              <span
                aria-hidden="true"
                className={`absolute -left-5 top-1.5 size-2 rounded-full ${kindDot[it.kind] || 'bg-slate-400'}`}
              />
              <p className="m-0 text-sm">
                <time className="font-semibold tabular-nums">{it.display}</time>{' '}
                <span className={it.kind === 'voided' ? 'line-through' : ''}>{it.label}</span>
              </p>
              {it.detail && (
                <p className="m-0 text-xs text-slate-500 dark:text-slate-400">{it.detail}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
