import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import { useDebounced, useResource } from '../../lib/hooks';
import { directoryPath } from '../../lib/peopleApi';
import { Button, Card, EmptyState, PageHeader, Pagination, Resource, Select } from '../../components/ui';
import DirectoryFilters, { EMPTY_FILTERS } from '../../components/people/DirectoryFilters';
import PersonAvatar from '../../components/people/PersonAvatar';

const SORTS = [
  { value: 'name', label: 'Name' },
  { value: 'department', label: 'Department' },
  { value: 'designation', label: 'Designation' },
  { value: 'location', label: 'Location' },
];

/** Privacy-respecting coworker directory: renders only what /v1/directory returns (hidden fields are null). */
export default function CoworkerDirectory() {
  const [filters, setFilters] = useState(EMPTY_FILTERS),
    [sort, setSort] = useState({ key: 'name', dir: 'asc' }),
    [page, setPage] = useState(1);
  const q = useDebounced(filters.q);
  const resource = useResource(
    directoryPath({
      coworkers: true,
      filters: { q, department_id: filters.department_id, location_id: filters.location_id },
      sort,
      page,
    }),
  );
  const change = (next) => {
    setFilters(next);
    setPage(1);
  };
  return (
    <>
      <PageHeader title="Coworker directory" description="Find colleagues and how to reach them." />
      <Card>
        <DirectoryFilters filters={filters} onChange={change} onClear={() => change(EMPTY_FILTERS)} coworkers />
        <div className="flex flex-wrap items-end gap-3 px-5">
          <Select label="Sort by" value={sort.key} onChange={(e) => setSort({ ...sort, key: e.target.value })} options={SORTS} />
          <Button
            variant="secondary"
            className="mb-5"
            onClick={() => setSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
          >
            {sort.dir === 'asc' ? 'A to Z' : 'Z to A'}
          </Button>
        </div>
        <Resource resource={resource}>
          {(data) =>
            data.data?.length ? (
              <>
                <ul
                  className="m-0 grid list-none gap-3 p-5 pt-0 sm:grid-cols-2 xl:grid-cols-3"
                  aria-label="Coworkers"
                >
                  {data.data.map((p) => {
                    const name = p.display_name || p.name;
                    return (
                      <li
                        key={p.uuid}
                        className="flex gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                      >
                        <PersonAvatar uuid={p.uuid} name={name} hasPhoto={Boolean(p.has_photo)} />
                        <div className="min-w-0 flex-1">
                          <Link
                            className="block truncate text-sm font-semibold text-slate-800 hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
                            to={`/people/${p.uuid}`}
                          >
                            {name}
                          </Link>
                          {p.pronouns && <small className="text-slate-500 dark:text-slate-400">{p.pronouns}</small>}
                          <p className="m-0 truncate text-xs text-slate-600 dark:text-slate-300">
                            {[p.designation, p.department].filter(Boolean).join(' · ')}
                          </p>
                          {p.location && <p className="m-0 truncate text-xs text-slate-500 dark:text-slate-400">{p.location}</p>}
                          {p.manager?.name && (
                            <p className="m-0 truncate text-xs text-slate-500 dark:text-slate-400">Reports to {p.manager.name}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-3 text-xs">
                            {p.work_email && (
                              <a
                                className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-300"
                                href={`mailto:${p.work_email}`}
                                aria-label={`Email ${name}`}
                              >
                                <Mail size={14} /> Email
                              </a>
                            )}
                            {p.work_phone && (
                              <a
                                className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-300"
                                href={`tel:${p.work_phone}`}
                                aria-label={`Call ${name}`}
                              >
                                <Phone size={14} /> Call
                              </a>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <Pagination data={data} onChange={setPage} />
              </>
            ) : (
              <EmptyState title="No coworkers found" description="Try another name, department or location." />
            )
          }
        </Resource>
      </Card>
    </>
  );
}
