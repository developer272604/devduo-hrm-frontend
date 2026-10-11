import { Skeleton } from '../../ui';
import { fmtUnits, fmtDate, personName } from '../../../lib/leaveApi';
import { ConflictList } from './LeaveBadge';

const Line = ({ tone = 'slate', children }) => {
  const tones = {
    slate: 'text-slate-700 dark:text-slate-200',
    amber: 'text-amber-900 dark:text-amber-200',
    rose: 'text-rose-800 dark:text-rose-200',
  };
  return <li className={`text-xs ${tones[tone]}`}>{children}</li>;
};

/**
 * Live impact preview (nothing is written). Shows what will be charged and why, the projected balance,
 * every warning, block and escalation, and who would approve. The server's wording is shown verbatim.
 */
export default function ImpactPreview({ preview, loading, error, unit }) {
  if (loading && !preview)
    return (
      <div aria-busy="true">
        <Skeleton rows={2} />
      </div>
    );
  if (error && !preview)
    return (
      <p role="alert" className="m-0 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
        {error}
      </p>
    );
  if (!preview)
    return (
      <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
        Choose a leave type and dates to see exactly what this request would cost and who would approve it.
      </p>
    );
  const d = preview.duration || {};
  const accounts = preview.balance?.accounts || [];
  const approval = preview.approval || {};
  const blockers = [...(d.errors || []), ...(preview.errors?.request || [])];
  const escalations = approval.escalation_reasons || [];
  const approvers = approval.first_approvers || [];
  return (
    <section className="space-y-4" aria-label="Impact preview" aria-busy={loading || undefined}>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p className="m-0 text-[11px] text-slate-500 dark:text-slate-400">Charged</p>
          <p className="m-0 text-xl font-semibold" data-testid="charged">
            {d.valid === false ? '-' : fmtUnits(d.charged_units, unit)}
          </p>
          {d.calendar_units != null && d.calendar_units !== d.charged_units && (
            <p className="m-0 text-[11px] text-slate-500 dark:text-slate-400">Calendar span {fmtUnits(d.calendar_units, unit)}</p>
          )}
        </div>
        {accounts.map((a, i) => (
          <div key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p className="m-0 text-[11px] text-slate-500 dark:text-slate-400">Balance after</p>
            <p
              className={`m-0 text-xl font-semibold ${a.sufficient === false ? 'text-rose-700 dark:text-rose-300' : ''}`}
              data-testid="projected"
            >
              {fmtUnits(a.projected, unit)}
            </p>
            <p className="m-0 text-[11px] text-slate-500 dark:text-slate-400">
              From {fmtUnits(a.available_before, unit)}
              {a.sufficient === false ? ' - not enough' : ''}
            </p>
          </div>
        ))}
      </div>

      {(d.explanation || []).length > 0 && (
        <div>
          <h3 className="m-0 mb-1 text-xs font-semibold">How this was charged</h3>
          <ul className="m-0 list-disc space-y-1 pl-5">
            {d.explanation.map((x, i) => (
              <Line key={i}>{typeof x === 'string' ? x : x.text || x.message}</Line>
            ))}
          </ul>
        </div>
      )}

      {blockers.length > 0 && (
        <ul className="m-0 list-disc space-y-1 pl-5" role="alert" aria-label="Problems">
          {blockers.map((x, i) => (
            <Line key={i} tone="rose">{x}</Line>
          ))}
        </ul>
      )}
      {(d.warnings || []).length > 0 && (
        <ul className="m-0 list-disc space-y-1 pl-5" aria-label="Warnings">
          {d.warnings.map((x, i) => (
            <Line key={i} tone="amber">{typeof x === 'string' ? x : x.message}</Line>
          ))}
        </ul>
      )}
      <ConflictList conflicts={preview.conflicts} />

      {(approval.roles || approvers.length > 0 || escalations.length > 0) && (
        <div className="text-xs text-slate-700 dark:text-slate-200">
          <h3 className="m-0 mb-1 text-xs font-semibold">Approval</h3>
          {approval.roles && <p className="m-0">Goes to: {[].concat(approval.roles).join(', then ')}</p>}
          {approvers.length > 0 && <p className="m-0">First approver: {approvers.map(personName).join(', ')}</p>}
          {escalations.map((r, i) => (
            <p key={i} className="m-0 text-amber-900 dark:text-amber-200">
              HR also reviews: {typeof r === 'string' ? r.replaceAll('_', ' ') : r.message}
            </p>
          ))}
        </div>
      )}

      {(preview.documents || []).length > 0 && (
        <div className="text-xs text-slate-700 dark:text-slate-200">
          <h3 className="m-0 mb-1 text-xs font-semibold">Documents</h3>
          <ul className="m-0 list-disc pl-5">
            {preview.documents.map((x, i) => (
              <li key={i}>{typeof x === 'string' ? x : x.message || x.label || x.kind}</li>
            ))}
          </ul>
        </div>
      )}

      {(preview.team_impact || []).length > 0 && (
        <div className="text-xs text-slate-700 dark:text-slate-200">
          <h3 className="m-0 mb-1 text-xs font-semibold">Team coverage</h3>
          <ul className="m-0 list-none p-0">
            {preview.team_impact.map((t) => (
              <li key={t.date}>
                {fmtDate(t.date)}: {t.available_after} of {t.team_size} available ({t.away_already} already away)
              </li>
            ))}
          </ul>
        </div>
      )}
      {preview.statutory && (
        <p className="m-0 text-[11px] text-slate-500 dark:text-slate-400">
          This is statutory leave: rule breaches do not stop it, they send it to HR.
        </p>
      )}
    </section>
  );
}
