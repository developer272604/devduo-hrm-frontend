import { useState } from 'react';
import { Link } from 'react-router-dom';
import { localAction } from '../../lib/api';
import { useResource } from '../../lib/hooks';
import { Badge, EmptyState, Input, Pagination, Resource } from '../ui';

/** Where each completeness rule is fixed (tab keys on the profile). */
export function tabForMissing(item) {
  const key = `${item?.key || ''}`.toLowerCase();
  const map = [
    ['document', 'documents'],
    ['emergency', 'emergency'],
    ['dependent', 'dependents'],
    ['education', 'education'],
    ['experience', 'experience'],
    ['skill', 'skills'],
    ['certification', 'certifications'],
    ['address', 'contact'],
    ['contact', 'contact'],
    ['email', 'contact'],
    ['phone', 'contact'],
    ['identity', 'identity'],
    ['bank', 'identity'],
    ['manager', 'job'],
    ['department', 'job'],
    ['designation', 'job'],
    ['location', 'job'],
    ['custom:', 'custom'],
    ['person', 'personal'],
  ].find(([needle]) => key.includes(needle));
  return map?.[1] || 'personal';
}

export function Completeness({ resource, onGo, tabs }) {
  return (
    <Resource resource={resource}>
      {(c) => (
        <section aria-label="Profile completeness" className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="m-0 text-sm">Profile completeness</h2>
            <strong className="text-sm">{c.percentage ?? 0}%</strong>
          </div>
          <progress
            className="h-2 w-full accent-brand-500"
            value={c.percentage ?? 0}
            max={100}
            aria-label="Profile completeness"
          />
          {c.complete ? (
            <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">Everything required is filled in.</p>
          ) : (
            <ul className="mt-3 list-none space-y-2 p-0 text-sm">
              {(c.missing || []).map((m) => {
                const tab = tabForMissing(m);
                return (
                  <li key={m.key} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {m.label}
                      {m.detail && <small className="block text-slate-500 dark:text-slate-400">{m.detail}</small>}
                    </span>
                    {tabs.includes(tab) && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300"
                        onClick={() => onGo(tab)}
                      >
                        Fix: {m.label}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </Resource>
  );
}

export function Employee360({ uuid }) {
  const resource = useResource(`/v1/employees/${uuid}/360`);
  return (
    <Resource resource={resource}>
      {(data) => (
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          {(data.sections || []).map((section) => (
            <section key={section.key} aria-label={section.title} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h2 className="mb-4 mt-0 text-sm">{section.title}</h2>
              <dl className="m-0 space-y-4">
                {section.items.map((item) => (
                  <div key={item.key}>
                    <dt className="text-xs text-slate-500 dark:text-slate-400">{item.label}</dt>
                    <dd className="m-0 mt-1 text-sm">
                      {localAction(item.href) ? (
                        <Link className="text-brand-600 dark:text-brand-300" to={item.href}>
                          {String(item.value ?? 'Open')}
                        </Link>
                      ) : Array.isArray(item.value) ? (
                        item.value.filter((v) => typeof v !== 'object').join(' → ')
                      ) : item.value && typeof item.value === 'object' ? (
                        item.detail || 'Details available in the record'
                      ) : (
                        String(item.value ?? '—')
                      )}
                    </dd>
                    {item.detail && typeof item.value !== 'object' && (
                      <p className="m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">{item.detail}</p>
                    )}
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}
    </Resource>
  );
}

export function Timeline({ uuid }) {
  const [page, setPage] = useState(1);
  const resource = useResource(`/v1/employees/${uuid}/timeline?page=${page}`);
  return (
    <Resource resource={resource}>
      {(data) => (
        <>
          {data.data?.length ? (
            <ol className="m-0 list-none space-y-6 p-5">
              {data.data.map((event) => (
                <li key={event.uuid} className="border-l-2 border-brand-200 pl-5 dark:border-brand-800">
                  <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
                    {event.effective_date || event.occurred_at?.slice(0, 10)} · {event.actor_name || 'System'}
                  </p>
                  <h3 className="mb-0 mt-1 text-sm">{event.label}</h3>
                  <p className="m-0 mt-1 text-sm">{event.summary}</p>
                  {event.future_dated && <Badge>Scheduled</Badge>}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No timeline events" description="Employment changes will appear here." />
          )}
          <Pagination data={data} onChange={setPage} />
        </>
      )}
    </Resource>
  );
}

export function OrganizationMemory({ uuid }) {
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const resource = useResource(`/v1/employees/${uuid}/memory?date=${date}`);
  return (
    <>
      <div className="p-5">
        <Input label="Organization as of" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <Resource resource={resource}>
        {(data) => (
          <dl className="m-0 grid gap-4 px-5 pb-5 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-slate-500">Status</dt><dd className="m-0">{data.employed ? data.status : 'Not employed on this date'}</dd></div>
            {Object.entries(data.assignment?.names || {}).map(([k, v]) => (
              <div key={k}><dt className="text-xs text-slate-500">{k.replaceAll('_', ' ')}</dt><dd className="m-0">{String(v ?? '—')}</dd></div>
            ))}
            {Object.entries(data.managers || {}).map(([type, managers]) => (
              <div key={type}><dt className="text-xs text-slate-500">{type} manager</dt><dd className="m-0">{managers.map((m) => m.name).join(', ')}</dd></div>
            ))}
          </dl>
        )}
      </Resource>
    </>
  );
}
