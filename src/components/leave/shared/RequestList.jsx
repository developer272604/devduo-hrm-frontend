import { useState } from 'react';
import { useResource } from '../../../lib/hooks';
import { query } from '../../../lib/api';
import { leavePaths, fmtRange, fmtUnits, listOf, pageOf, personName, typeName, STATUS } from '../../../lib/leaveApi';
import ResponsiveList from '../../ResponsiveList';
import { Pagination, Resource, Select, FilterBar } from '../../ui';
import { StatusChip } from './LeaveBadge';

/**
 * Paginated request list for scope mine or team. Row click reports the request (callers decide: route or modal).
 * Sensitive types arrive already masked as "Leave" from the server.
 */
export default function RequestList({ scope = 'mine', onOpen, showEmployee = false, empty }) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const resource = useResource(`${leavePaths.requests}?${query({ scope, status, page, per_page: 15 })}`);
  const columns = [
    ...(showEmployee ? [{ key: 'employee', label: 'Employee', render: (r) => personName(r.employee) }] : []),
    { key: 'type', label: 'Type', render: (r) => typeName(r.type) },
    { key: 'dates', label: 'Dates', render: (r) => fmtRange(r) },
    { key: 'units', label: 'Charged', priority: 'md', render: (r) => fmtUnits(r.charged_units, r.unit) },
    { key: 'status', label: 'Status', render: (r) => <StatusChip status={r.status} /> },
  ];
  return (
    <>
      <FilterBar>
        <Select
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          options={[{ value: '', label: 'All statuses' }, ...Object.entries(STATUS).map(([value, m]) => ({ value, label: m.label }))]}
        />
      </FilterBar>
      <Resource resource={resource}>
        {(res) => (
          <>
            <ResponsiveList
              label={scope === 'team' ? 'Team leave requests' : 'My leave requests'}
              rows={listOf(res)}
              onRowClick={onOpen}
              empty={empty || { title: 'No leave requests', description: 'Requests will appear here.' }}
              columns={columns}
              card={(r) => (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <strong className="min-w-0 truncate text-sm">{showEmployee ? personName(r.employee) : typeName(r.type)}</strong>
                    <StatusChip status={r.status} />
                  </div>
                  <p className="m-0 mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                    {showEmployee ? `${typeName(r.type)} · ` : ''}
                    {fmtRange(r)}
                  </p>
                  <p className="m-0 text-[11px] text-slate-500 dark:text-slate-400">{fmtUnits(r.charged_units, r.unit)}</p>
                </div>
              )}
            />
            <Pagination data={pageOf(res)} onChange={setPage} />
          </>
        )}
      </Resource>
    </>
  );
}
