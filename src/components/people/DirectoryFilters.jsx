import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button, Search, Select } from '../ui';
import { STATUSES, WORKER_TYPES, label } from '../../lib/peopleApi';
import { EmployeePicker, OrgSelect, useOptions } from './lookups';

export const EMPTY_FILTERS = {
  q: '',
  status: '',
  department_id: '',
  location_id: '',
  employee_type_id: '',
  manager: '',
  tag_id: '',
  skill_id: '',
};

export const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'employee_number', label: 'Employee number' },
  { value: 'joined_on', label: 'Joining date' },
  { value: 'status', label: 'Status' },
  { value: 'department', label: 'Department' },
  { value: 'designation', label: 'Designation' },
  { value: 'location', label: 'Location' },
];

function AdvancedFilters({ filters, set }) {
  const tags = useOptions('/v1/people/tags?per_page=100');
  const skills = useOptions('/v1/people/skills?per_page=100');
  const any = (options) => [{ value: '', label: 'Any' }, ...options];
  return (
    <>
      <OrgSelect
        type="employee-types"
        label="Employee type"
        value={filters.employee_type_id}
        onChange={(e) => set('employee_type_id', e.target.value)}
      />
      <Select
        label="Worker type"
        value={filters.worker_type || ''}
        onChange={(e) => set('worker_type', e.target.value)}
        options={any(WORKER_TYPES.map((value) => ({ value, label: label(value) })))}
      />
      <EmployeePicker label="Manager" value={filters.manager} onChange={(v) => set('manager', v)} />
      <Select label="Tag" value={filters.tag_id} onChange={(e) => set('tag_id', e.target.value)} options={any(tags)} />
      <Select label="Skill" value={filters.skill_id} onChange={(e) => set('skill_id', e.target.value)} options={any(skills)} />
    </>
  );
}

/** Search + filters. Coworker mode exposes only the filters the privacy-respecting endpoint accepts. */
export default function DirectoryFilters({ filters, onChange, coworkers = false, onClear }) {
  const [more, setMore] = useState(false);
  const set = (key, value) => onChange({ ...filters, [key]: value });
  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-end gap-4">
        <Search
          value={filters.q}
          onChange={(value) => set('q', value)}
          placeholder="Search people…"
        />
        {!coworkers && (
          <Select
            label="Status"
            value={filters.status}
            onChange={(e) => set('status', e.target.value)}
            options={[
              { value: '', label: 'All statuses' },
              ...STATUSES.map((value) => ({ value, label: label(value) })),
            ]}
          />
        )}
        <Button
          variant="secondary"
          aria-expanded={more}
          aria-controls="directory-more-filters"
          onClick={() => setMore((v) => !v)}
        >
          <SlidersHorizontal size={16} /> Filters
        </Button>
        <Button variant="secondary" onClick={onClear}>
          Clear
        </Button>
      </div>
      {more && (
        <div
          id="directory-more-filters"
          className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-4"
          role="group"
          aria-label="More filters"
        >
          <OrgSelect
            type="departments"
            label="Department"
            value={filters.department_id}
            onChange={(e) => set('department_id', e.target.value)}
          />
          <OrgSelect
            type="locations"
            label="Location"
            value={filters.location_id}
            onChange={(e) => set('location_id', e.target.value)}
          />
          {!coworkers && <AdvancedFilters filters={filters} set={set} />}
        </div>
      )}
    </div>
  );
}
