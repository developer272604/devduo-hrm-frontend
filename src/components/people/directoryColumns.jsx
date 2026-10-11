import PersonAvatar from './PersonAvatar';
import StatusBadge from './StatusBadge';

const personCell = (row) => (
  <span className="flex items-center gap-3">
    <PersonAvatar uuid={row.uuid} name={row.display_name || ''} hasPhoto={row.has_photo !== false && Boolean(row.has_photo)} />
    <span className="min-w-0">
      <strong className="block truncate text-slate-800 dark:text-slate-100">{row.display_name}</strong>
      {row.pronouns && <small className="text-slate-500 dark:text-slate-400">{row.pronouns}</small>}
    </span>
  </span>
);

/** Renderers for every column key the directory API can list; unknown keys fall back to plain text. */
export const COLUMN_DEFS = {
  display_name: { label: 'Employee', render: personCell },
  name: { label: 'Employee', render: personCell },
  employee_number: { label: 'Number' },
  designation: { label: 'Designation' },
  department: { label: 'Department' },
  location: { label: 'Location' },
  manager: { label: 'Manager', render: (r) => r.manager?.name || '—' },
  status: { label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  worker_type: { label: 'Worker type', render: (r) => r.worker_type?.replaceAll('_', ' ') || '—' },
  employee_type: { label: 'Employee type' },
  joined_on: { label: 'Joined' },
  work_email: { label: 'Work email' },
  work_phone: { label: 'Work phone' },
};

export const DEFAULT_COLUMNS = [
  { key: 'display_name', label: 'Employee', default_visible: true, sortable: true, sort_key: 'name' },
  { key: 'employee_number', label: 'Number', default_visible: true, sortable: true },
  { key: 'designation', label: 'Designation', default_visible: true, sortable: true },
  { key: 'status', label: 'Status', default_visible: true, sortable: true },
  { key: 'department', label: 'Department', default_visible: true, sortable: true },
  { key: 'location', label: 'Location', default_visible: true, sortable: true },
  { key: 'manager', label: 'Manager', default_visible: false },
  { key: 'employee_type', label: 'Employee type', default_visible: false },
  { key: 'joined_on', label: 'Joined', default_visible: false, sortable: true },
  { key: 'work_email', label: 'Work email', default_visible: false },
];

/** Turn the visible column keys into ResponsiveList columns: first 3 always, next 2 on tablet, rest on desktop. */
export function toListColumns(all, visible) {
  return all
    .filter((c) => visible.includes(c.key))
    .map((c, i) => ({
      key: c.key,
      label: c.label || COLUMN_DEFS[c.key]?.label || c.key,
      render: COLUMN_DEFS[c.key]?.render,
      priority: i < 3 ? 'always' : i < 5 ? 'md' : 'lg',
    }));
}
