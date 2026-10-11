import { useResource } from '../../lib/hooks';
import { label } from '../../lib/peopleApi';
import { EmptyState, Resource } from '../ui';

const Facts = ({ title, values }) => {
  const entries = Object.entries(values || {}).filter(
    ([k, v]) => v !== null && v !== '' && typeof v !== 'object' && !k.endsWith('_id') && !k.includes('uuid'),
  );
  if (!entries.length) return null;
  return (
    <section aria-label={title} className="mb-6">
      <h3 className="mb-3 mt-0 text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</h3>
      <dl className="m-0 grid gap-4 sm:grid-cols-2">
        {entries.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-slate-500 dark:text-slate-400">{label(k)}</dt>
            <dd className="m-0 mt-1 wrap-break-word text-sm font-medium">{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

function History({ uuid, kind, title, empty, line }) {
  const resource = useResource(`/v1/employees/${uuid}/${kind}`);
  return (
    <Resource resource={resource}>
      {(data) => (
        <section aria-label={title} className="mb-6">
          <h3 className="mb-3 mt-0 text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</h3>
          {data.data?.length ? (
            <ol className="m-0 list-none space-y-3 p-0">
              {data.data.map((row, i) => (
                <li key={row.uuid ?? row.id ?? i} className="border-l-2 border-brand-200 pl-4 text-sm dark:border-brand-800">
                  {line(row)}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title={empty} description="Changes will be listed here." />
          )}
        </section>
      )}
    </Resource>
  );
}

const range = (r) => `${r.effective_from || r.starts_on || ''} to ${r.effective_to || r.ends_on || 'present'}`;

export default function JobPanel({ uuid, profile, sections }) {
  const showJob = sections.includes('job');
  return (
    <div className="p-5">
      {sections.includes('employment') && (
        <Facts title="Employment" values={{ ...profile.employment, ...(profile.employment?.probation || {}), ...(profile.employment?.contract || {}), probation: null, contract: null }} />
      )}
      {showJob && <Facts title="Current assignment" values={profile.job} />}
      {showJob && (
        <History
          uuid={uuid}
          kind="assignments"
          title="Assignment history"
          empty="No assignment history"
          line={(r) => (
            <>
              <strong>{[r.designation, r.department, r.location].filter(Boolean).join(' · ') || 'Assignment'}</strong>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{range(r)}{r.change_type ? ` · ${label(r.change_type)}` : ''}</span>
            </>
          )}
        />
      )}
      {showJob && (
        <History
          uuid={uuid}
          kind="relationships"
          title="Reporting history"
          empty="No reporting history"
          line={(r) => (
            <>
              <strong>{r.manager?.name || r.manager_name || 'No manager'}</strong>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{label(r.type)} · {range(r)}</span>
            </>
          )}
        />
      )}
    </div>
  );
}
