import { useState } from 'react';
import { useResource, useDebounced } from '../../lib/hooks';
import { query } from '../../lib/api';
import {
  PageHeader,
  Card,
  Resource,
  Search,
  Select,
  Button,
  Pagination,
  EmptyState,
  FilterBar,
} from '../../components/ui';
import {
  OrgChartCard,
  OrgChartLevel,
  OrgChartDrillList,
} from '../../components/people/OrgChartTree';
import OrgChartPreview from '../../components/people/OrgChartPreview';

const optionsOf = (resource) => [
  { value: '', label: 'All' },
  ...(resource.data?.data || []).map((x) => ({ value: String(x.id), label: x.name })),
];

export default function OrgChart() {
  const [search, setSearch] = useState(''),
    [department, setDepartment] = useState(''),
    [location, setLocation] = useState(''),
    [view, setView] = useState('tree'),
    [page, setPage] = useState(1),
    [stack, setStack] = useState([]),
    [selected, setSelected] = useState(null),
    q = useDebounced(search),
    // Filter lookups are optional: without organization.view the filters simply stay hidden.
    departments = useResource('/organization/departments?per_page=100'),
    locations = useResource('/organization/locations?per_page=100'),
    searching = q.trim().length >= 2 || department !== '' || location !== '',
    params = {
      q: q.trim().length >= 2 ? q.trim() : '',
      department_id: department,
      location_id: location,
      page,
    };
  const path = searching
    ? `/v1/people/org-chart?${query(params)}`
    : `/v1/people/org-chart?${query({ depth: 1, page })}`;
  const resource = useResource(path);
  const reset = () => {
    setPage(1);
    setStack([]);
  };
  const showTree = !searching && view === 'tree',
    showDrill = !searching && view === 'list';
  return (
    <>
      <PageHeader
        title="Organization chart"
        description="Explore reporting relationships within your permitted scope."
        action={
          <div className="flex gap-2" role="group" aria-label="Chart layout">
            <Button
              variant="secondary"
              aria-pressed={view === 'tree'}
              onClick={() => setView('tree')}
            >
              Tree
            </Button>
            <Button
              variant="secondary"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              List
            </Button>
          </div>
        }
      />
      <Card>
        <FilterBar>
          <Search
            value={search}
            onChange={(value) => {
              setSearch(value);
              reset();
            }}
            placeholder="Find a colleague…"
          />
          {departments.data && (
            <Select
              label="Department"
              value={department}
              options={optionsOf(departments)}
              onChange={(e) => {
                setDepartment(e.target.value);
                reset();
              }}
            />
          )}
          {locations.data && (
            <Select
              label="Location"
              value={location}
              options={optionsOf(locations)}
              onChange={(e) => {
                setLocation(e.target.value);
                reset();
              }}
            />
          )}
          {(search || department || location) && (
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('');
                setDepartment('');
                setLocation('');
                reset();
              }}
            >
              Clear filters
            </Button>
          )}
        </FilterBar>
        <div className="p-4 sm:p-5">
          {showDrill ? (
            <OrgChartDrillList
              stack={stack}
              setStack={setStack}
              rootPage={{ path, setPage }}
              onSelect={setSelected}
            />
          ) : (
            <Resource resource={resource}>
              {(data) =>
                data.data.length ? (
                  <>
                    {showTree ? (
                      <OrgChartLevel nodes={data.data} onSelect={setSelected} />
                    ) : (
                      <ul className="list-none space-y-2 p-0" aria-label="Search results">
                        {data.data.map((node) => (
                          <li key={node.uuid}>
                            <OrgChartCard
                              node={node}
                              ancestors={node.ancestors}
                              onSelect={setSelected}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                    <Pagination data={data} onChange={setPage} />
                  </>
                ) : (
                  <EmptyState
                    title="No employees found"
                    description="Try a different search or filter, or add reporting relationships."
                  />
                )
              }
            </Resource>
          )}
        </div>
      </Card>
      <OrgChartPreview node={selected} onClose={() => setSelected(null)} />
    </>
  );
}
