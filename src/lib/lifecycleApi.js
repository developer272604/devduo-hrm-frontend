import { query } from './api';

/**
 * Lifecycle API helpers (docs/api/lifecycle-onboarding.md). Paths are relative to `/api`.
 * Shapes: case lists are Laravel paginators with nested employee and readiness data; preboarders expose
 * {employee_uuid, name, joining_date, case}; task = {uuid, title, group_name, owner_name, owner_type, due_date, status, mandatory, requires_document, overdue, case_uuid};
 * template = {uuid, kind, name, versions:[{uuid, version, status}]}; moves include nested employee data plus employee_name and can_decide.
 */
export { listOf, pageOf, send, today, unwrap, useAction, useList } from './timeOfficeApi';
export { query };

export const titleCase = (s) => {
  const t = String(s ?? '').replace(/[_-]+/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const L = '/v1/lifecycle';
export const paths = {
  templates: `${L}/templates`,
  template: (uuid, part) => `${L}/templates/${uuid}${part ? `/${part}` : ''}`,
  publish: (versionUuid) => `${L}/template-versions/${versionUuid}/publish`,
  cases: `${L}/cases`,
  case: (uuid, part) => `${L}/cases/${uuid}${part ? `/${part}` : ''}`,
  myTasks: `${L}/me/tasks`,
  complete: (uuid) => `${L}/tasks/${uuid}/complete`,
  myExit: `${L}/me/exit-interview`,
  dashboard: `${L}/dashboard`,
  preboarders: `${L}/preboarders`,
  moves: `${L}/moves`,
  move: (uuid, part) => `${L}/moves/${uuid}/${part}`,
  alumni: `${L}/alumni`,
  eligibility: (uuid) => `${L}/alumni/${uuid}/eligibility`,
  employees: '/v1/employees?per_page=100',
};

/** Section navigation; `permission` is an any-of list. */
export const NAV = [
  { to: '/lifecycle/my', label: 'My tasks', permission: 'lifecycle.self' },
  { to: '/lifecycle/resignations', label: 'My resignation', permission: 'lifecycle.self' },
  { to: '/lifecycle/resignation-review', label: 'Resignation review', permission: 'people.separate' },
  { to: '/lifecycle/returns', label: 'Return to work', permission: 'people.manage' },
  { to: '/lifecycle/exit-interview', label: 'Exit interview', permission: 'lifecycle.self' },
  { to: '/lifecycle/dashboard', label: 'Dashboard', permission: 'lifecycle.view' },
  { to: '/lifecycle/cases', label: 'Cases', permission: 'lifecycle.view' },
  { to: '/lifecycle/preboarders', label: 'Pre-joiners', permission: 'lifecycle.view' },
  { to: '/lifecycle/templates', label: 'Templates', permission: 'lifecycle.templates.manage' },
  {
    to: '/lifecycle/moves',
    label: 'Internal moves',
    permission: 'lifecycle.moves.manage|lifecycle.moves.approve',
  },
  { to: '/lifecycle/alumni', label: 'Alumni', permission: 'lifecycle.alumni.manage' },
];
export const LIFECYCLE_ACCESS = [...new Set(NAV.flatMap((n) => n.permission.split('|')))].join('|');
export const clean = (o) =>
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  );
