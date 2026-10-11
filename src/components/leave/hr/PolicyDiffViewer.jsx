import { Banner, StatusBadge } from '../../timeoffice/parts';
import { titleCase } from '../../../lib/leaveHrApi';
import { Pill } from './kit';

const show = (v) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
const CHANGE_TEXT = { added: 'Added', removed: 'Removed', changed: 'Changed', type_added: 'Leave type added', type_removed: 'Leave type removed' };

/** Accepts both the policy diff (`section_label, before, after`) and the simulation policy-diff (`scope, from, to`) shapes. */
const normalise = (c) => ({
  section: c.section_label ?? c.section ?? c.scope ?? 'Policy',
  path: c.path,
  change: c.change,
  before: 'before' in c ? c.before : c.from,
  after: 'after' in c ? c.after : c.to,
});

const Side = ({ info }) =>
  info ? (
    <div className="min-w-0 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
      <strong className="block truncate">
        {info.policy_name ?? info.policy ?? 'Version'} {info.version != null && `v${info.version}`}
      </strong>
      <span className="mr-2">
        {info.effective_from ?? '—'} to {info.effective_to ?? 'open'}
      </span>
      {info.status && <StatusBadge status={info.status} />}
    </div>
  ) : null;

/** Policy Difference Viewer: what changed between two versions, grouped by section, every change in words. */
export default function PolicyDiffViewer({ diff }) {
  if (!diff) return null;
  const changes = (diff.changes ?? []).map(normalise);
  const groups = changes.reduce((acc, c) => ({ ...acc, [c.section]: [...(acc[c.section] ?? []), c] }), {});
  return (
    <div className="space-y-3" data-testid="policy-diff">
      {(diff.from || diff.to) && typeof diff.from === 'object' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Side info={diff.from} />
          <Side info={diff.to} />
        </div>
      )}
      {diff.identical ? (
        <Banner tone="info" title="No differences">
          These two versions have identical rules.
        </Banner>
      ) : (
        <>
          {diff.summary && (
            <p className="m-0 flex flex-wrap gap-1.5 text-xs">
              <Pill>{diff.summary.total} changes</Pill>
              <Pill>{diff.summary.added} added</Pill>
              <Pill>{diff.summary.removed} removed</Pill>
              <Pill>{diff.summary.changed} changed</Pill>
            </p>
          )}
          {(diff.meta_changes ?? []).length > 0 && (
            <section aria-label="Version details">
              <h4 className="mb-1 mt-0 text-xs">Version details</h4>
              <ul className="m-0 list-none p-0 text-xs">
                {diff.meta_changes.map((m) => (
                  <li key={m.field}>
                    <strong>{titleCase(m.field)}</strong>: {show(m.before)} to {show(m.after)}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {Object.entries(groups).map(([section, rows]) => (
            <section key={section} aria-label={section}>
              <h4 className="mb-1 mt-0 text-xs">{section}</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="text-slate-500 dark:text-slate-400">
                      <th scope="col" className="py-1 pr-3 font-medium">Rule</th>
                      <th scope="col" className="py-1 pr-3 font-medium">Change</th>
                      <th scope="col" className="py-1 pr-3 font-medium">Before</th>
                      <th scope="col" className="py-1 font-medium">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c, i) => (
                      <tr key={`${c.path}-${i}`} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="py-1.5 pr-3 font-mono wrap-anywhere">{c.path ?? '—'}</td>
                        <td className="py-1.5 pr-3">{CHANGE_TEXT[c.change] ?? titleCase(c.change)}</td>
                        <td className="py-1.5 pr-3 wrap-anywhere">{show(c.before)}</td>
                        <td className="py-1.5 wrap-anywhere">{show(c.after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
