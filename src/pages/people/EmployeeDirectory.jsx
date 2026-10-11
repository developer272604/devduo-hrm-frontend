import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDownAZ, ArrowUpAZ, Download, UserPlus } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useDebounced, useResource } from '../../lib/hooks';
import { query } from '../../lib/api';
import {
  cleanFilters,
  directoryPath,
  readLocal,
  runExport,
  writeLocal,
} from '../../lib/peopleApi';
import ResponsiveList from '../../components/ResponsiveList';
import {
  Button,
  Card,
  Pagination,
  PageHeader,
  Resource,
  Select,
  useToast,
} from '../../components/ui';
import DirectoryFilters, { EMPTY_FILTERS, SORT_OPTIONS } from '../../components/people/DirectoryFilters';
import BulkPanel from '../../components/people/BulkPanel';
import EmployeePreview from '../../components/people/EmployeePreview';
import StatusBadge from '../../components/people/StatusBadge';
import { ColumnPicker, SavedViews } from '../../components/people/ViewsAndColumns';
import { DEFAULT_COLUMNS, toListColumns } from '../../components/people/directoryColumns';

const COLUMN_STORE = 'people.directory.columns';

const addLinkClass =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-brand-600';

/** Insight drill-down: the employees behind an Action Center insight (no filters, scope-limited). */
function InsightList({ insight }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const resource = useResource(
    `/v1/people/action-center/${encodeURIComponent(insight)}/employees?${query({ page })}`,
  );
  return (
    <>
      <PageHeader
        title="Employees needing attention"
        description="The employees behind this insight, limited to your permitted scope."
      />
      <Link className="mb-4 inline-block text-sm text-brand-600 dark:text-brand-300" to="/people/action-center">
        ← Back to action center
      </Link>
      <Card>
        <Resource resource={resource}>
          {(data) => (
            <>
              <ResponsiveList
                label="Employees needing attention"
                rows={data.data.map((row) => ({
                  ...row,
                  uuid: row.uuid || row.employee_uuid,
                  display_name: row.display_name || row.name,
                }))}
                onRowClick={(row) => navigate(`/people/${row.uuid}`)}
                columns={[
                  { key: 'display_name', label: 'Employee' },
                  { key: 'detail', label: 'Needs attention' },
                ]}
                mobile={{ title: 'display_name', subtitle: 'detail' }}
                empty={{ title: 'No matching employees', description: 'Nothing needs attention here.' }}
              />
              <Pagination data={data} onChange={setPage} />
            </>
          )}
        </Resource>
      </Card>
    </>
  );
}

function Directory() {
  const { can } = useAuth(),
    toast = useToast();
  const [filters, setFilters] = useState(EMPTY_FILTERS),
    [sort, setSort] = useState({ key: 'name', dir: 'asc' }),
    [page, setPage] = useState(1),
    [visible, setVisible] = useState(() => readLocal(COLUMN_STORE)),
    [viewId, setViewId] = useState(''),
    [selected, setSelected] = useState(() => new Set()),
    [preview, setPreview] = useState(null),
    [exporting, setExporting] = useState(false);
  const q = useDebounced(filters.q);
  const effective = { ...filters, q };
  const resource = useResource(directoryPath({ filters: effective, sort, page }));
  const columnsResource = useResource('/v1/people/directory/columns');
  const allColumns = useMemo(() => {
    const fromApi = Array.isArray(columnsResource.data)
      ? columnsResource.data
      : columnsResource.data?.data;
    return fromApi?.length ? fromApi : DEFAULT_COLUMNS;
  }, [columnsResource.data]);
  const visibleKeys = visible || allColumns.filter((c) => c.default_visible).map((c) => c.key);
  const listColumns = toListColumns(allColumns, visibleKeys);
  useEffect(() => {
    if (visible) writeLocal(COLUMN_STORE, visible);
  }, [visible]);

  const changeFilters = (next) => {
    setFilters(next);
    setPage(1);
    setViewId('');
  };
  const applyView = (view) => {
    setViewId(view?.uuid || '');
    setFilters({ ...EMPTY_FILTERS, ...(view?.filters || {}) });
    if (view?.columns?.length) setVisible(view.columns);
    setSort(view?.sort?.key ? { key: view.sort.key, dir: view.sort.dir || 'asc' } : { key: 'name', dir: 'asc' });
    setPage(1);
  };
  const toggle = (row) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(row.uuid)) next.delete(row.uuid);
      else next.add(row.uuid);
      return next;
    });
  async function exportList() {
    setExporting(true);
    try {
      await runExport({ filters: effective, selected: [...selected] });
      toast('Export downloaded.');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Employees"
        description="Find people, explore their roles, and open their profiles."
        action={
          can('people.manage') && (
            <div className="flex flex-wrap gap-2">
              <Link className={addLinkClass} to="/people/new?mode=quick">
                Quick add
              </Link>
              <Link className={addLinkClass} to="/people/new">
                <UserPlus size={16} /> Add employee
              </Link>
            </div>
          )
        }
      />
      <Card>
        <DirectoryFilters
          filters={filters}
          onChange={changeFilters}
          onClear={() => changeFilters(EMPTY_FILTERS)}
        />
        <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 px-5 pt-4 dark:border-slate-800">
          <Select
            label="Sort by"
            value={sort.key}
            onChange={(e) => setSort({ ...sort, key: e.target.value })}
            options={SORT_OPTIONS}
          />
          <Button
            variant="secondary"
            className="mb-5"
            aria-label={`Sort ${sort.dir === 'asc' ? 'ascending' : 'descending'}, switch direction`}
            onClick={() => setSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
          >
            {sort.dir === 'asc' ? <ArrowDownAZ size={16} /> : <ArrowUpAZ size={16} />}
          </Button>
          <div className="mb-5">
            <ColumnPicker columns={allColumns} visible={visibleKeys} onChange={setVisible} />
          </div>
          <SavedViews
            filters={filters}
            columns={visibleKeys}
            sort={sort}
            currentId={viewId}
            onApply={applyView}
            canShare={can('people.settings')}
          />
          {can('people.export') && (
            <Button variant="secondary" className="mb-5" loading={exporting} onClick={exportList}>
              <Download size={16} /> {selected.size ? `Export ${selected.size} selected` : 'Export results'}
            </Button>
          )}
        </div>
        {can('people.bulk') && selected.size > 0 && (
          <BulkPanel
            uuids={[...selected]}
            onClear={() => setSelected(new Set())}
            onDone={() => {
              setSelected(new Set());
              resource.reload();
            }}
          />
        )}
        <Resource resource={resource}>
          {(data) => {
            const rows = (data.data || []).map((row) => ({
              ...row,
              uuid: row.uuid || row.employee_uuid,
              display_name: row.display_name || row.name,
            }));
            const filtered = Object.keys(cleanFilters(effective)).length > 0;
            return (
              <>
                {can('people.bulk') && rows.length > 0 && (
                  <div className="flex items-center justify-between px-5 py-2 text-xs">
                    <span aria-live="polite">{data.total ?? rows.length} employees</span>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setSelected((current) => {
                          const next = new Set(current);
                          const all = rows.every((r) => next.has(r.uuid));
                          rows.forEach((r) => (all ? next.delete(r.uuid) : next.add(r.uuid)));
                          return next;
                        })
                      }
                    >
                      Select / deselect this page
                    </Button>
                  </div>
                )}
                <ResponsiveList
                  label="Employees"
                  rows={rows}
                  columns={listColumns}
                  onRowClick={setPreview}
                  selected={selected}
                  onToggle={can('people.bulk') ? toggle : undefined}
                  mobile={{
                    title: 'display_name',
                    subtitle: (r) => [r.designation, r.employee_number].filter(Boolean).join(' · '),
                    badge: (r) => <StatusBadge status={r.status} />,
                    facts: [
                      { label: 'Department', value: 'department' },
                      { label: 'Location', value: 'location' },
                    ],
                  }}
                  empty={{
                    title: filtered ? 'No matching employees' : 'No employees yet',
                    description: filtered
                      ? 'Try another search or clear the filters.'
                      : 'Add your first employee to get started.',
                    action: filtered ? (
                      <Button variant="secondary" onClick={() => changeFilters(EMPTY_FILTERS)}>
                        Clear filters
                      </Button>
                    ) : can('people.manage') ? (
                      <Link className={addLinkClass} to="/people/new">
                        Add employee
                      </Link>
                    ) : undefined,
                  }}
                />
                <Pagination data={data} onChange={setPage} />
              </>
            );
          }}
        </Resource>
      </Card>
      <EmployeePreview row={preview} onClose={() => setPreview(null)} />
    </>
  );
}

export default function EmployeeDirectory() {
  const [params] = useSearchParams();
  const insight = params.get('insight');
  return insight ? <InsightList insight={insight} /> : <Directory />;
}
