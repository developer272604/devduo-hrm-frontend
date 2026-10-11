/** "Why is this attendance marked this way?" Renders the engine's structured explanation: {headline, lines[{label,value,rule?}], facts[], actions[]}. */
export default function ExplanationPanel({ explanation }) {
  if (!explanation)
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No explanation is available yet. The day has not been processed.
      </p>
    );
  return (
    <section aria-labelledby="why-heading">
      <h3 id="why-heading" className="m-0 mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
        Why is this attendance marked this way?
      </h3>
      <p className="m-0 mb-4 text-base font-semibold">{explanation.headline}</p>
      {explanation.lines?.length > 0 && (
        <dl className="m-0 space-y-3">
          {explanation.lines.map((l, i) => (
            <div key={i}>
              <dt className="text-xs text-slate-500 dark:text-slate-400">{l.label}</dt>
              <dd className="m-0 mt-0.5 text-sm">
                {l.value}
                {l.rule && (
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Rule: {l.rule}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {explanation.facts?.length > 0 && (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
          {explanation.facts.map((f, i) => (
            <li key={i}>{typeof f === 'string' ? f : (f.text ?? JSON.stringify(f))}</li>
          ))}
        </ul>
      )}
      {explanation.actions?.length > 0 && (
        <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-3 text-xs text-brand-700 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-300">
          <p className="m-0 mb-1 font-semibold">What you can do</p>
          <ul className="m-0 list-disc pl-5">
            {explanation.actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
