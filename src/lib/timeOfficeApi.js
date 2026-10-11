import { useCallback, useEffect, useState } from 'react';
import { api, query } from './api';
import { useResource } from './hooks';

/**
 * Time Office API helpers. Every endpoint the console uses is named here, so a backend path change is a one-line edit.
 * Paths are relative to `/api` (see lib/api.js).
 */
export const A = '/v1/attendance';
/** Scheduling and policy resources live directly under `/v1`, not under `/v1/attendance`. */
export const V = '/v1';
export const paths = {
  commandCenter: `${A}/command-center`,
  days: `${A}/days`,
  daily: `${A}/daily`,
  report: (key) => `${A}/reports/${key}`,
  reportExport: (key) => `${A}/reports/${key}/exports`,
  reportCatalogue: `${A}/reports`,
  exports: `${A}/exports`,
  exportDownload: (uuid) => `${A}/exports/${uuid}/download`,
  views: `${A}/views`,
  approvals: `${A}/approvals`,
  exceptions: `${A}/exceptions`,
  processRuns: `${A}/process/runs`,
  process: `${A}/process`,
  processPreview: `${A}/process/preview`,
  locks: `${A}/locks`,
  lockPreview: `${A}/locks/preview`,
  lockApproveDays: `${A}/locks/approve-days`,
  rosterGaps: `${A}/roster-gaps`,
  rosters: `${V}/rosters`,
  roster: (uuid, part) => `${V}/rosters/${uuid}${part ? `/${part}` : ''}`,
  shifts: `${V}/shifts`,
  shiftRotations: `${V}/shift-rotations`,
  shiftAssignments: `${V}/shift-assignments`,
  shiftSwaps: `${V}/shift-swaps`,
  workWeeks: `${V}/work-weeks`,
  workWeekAssignments: `${V}/work-week-assignments`,
  holidayCalendars: `${V}/holiday-calendars`,
  holidayCalendarAssignments: `${V}/holiday-calendar-assignments`,
  payrollGroups: `${V}/payroll-groups`,
  policies: `${V}/attendance-policies`,
  policyAssignments: `${V}/attendance-policy-assignments`,
  policyResolve: `${V}/attendance-policies/resolve`,
  policySimulate: `${V}/attendance-policies/simulate`,
  mySchedule: `${A}/me/schedule`,
  teamSchedule: `${A}/team/schedule`,
  impactPreview: `${A}/impact-preview`,
  devices: `${A}/devices`,
  geofences: `${A}/geofences`,
  deviceProviders: `${A}/device-providers`,
  imports: `${A}/imports`,
  settings: (section) => `${A}/settings${section ? `/${section}` : ''}`,
  payrollReadiness: `${A}/payroll-readiness`,
  bulkPreview: `${A}/bulk/preview`,
  bulkApply: `${A}/bulk/apply`,
  adjustments: `${A}/adjustments`,
};

/** Section navigation. `permission` is an any-of list; the nav shows only what the user may open. */
export const NAV = [
  { to: '/time-office', label: 'Command center', end: true, permission: 'attendance.manage|attendance.process|attendance.reports.view' },
  { to: '/time-office/daily', label: 'Daily attendance', permission: 'attendance.manage|attendance.reports.view|attendance.team.view' },
  { to: '/time-office/exceptions', label: 'Exceptions', permission: 'attendance.manage|attendance.team.view' },
  { to: '/time-office/approvals', label: 'Approvals', permission: 'attendance.approve|attendance.overtime.approve|attendance.adjust.approve|attendance.manage' },
  { to: '/time-office/roster', label: 'Roster', permission: 'attendance.roster.manage|attendance.manage' },
  { to: '/time-office/shifts', label: 'Shifts', permission: 'attendance.roster.manage|attendance.manage' },
  { to: '/time-office/calendars', label: 'Calendars', permission: 'attendance.roster.manage|attendance.manage' },
  { to: '/time-office/policies', label: 'Policies', permission: 'attendance.policy.manage|attendance.manage' },
  { to: '/time-office/devices', label: 'Devices', permission: 'attendance.devices.manage' },
  { to: '/time-office/imports', label: 'Imports', permission: 'attendance.import|attendance.manage' },
  { to: '/time-office/processing', label: 'Processing', permission: 'attendance.process|attendance.manage' },
  { to: '/time-office/locks', label: 'Locks', permission: 'attendance.lock|attendance.manage' },
  { to: '/time-office/reports', label: 'Reports', permission: 'attendance.reports.view|attendance.manage' },
  { to: '/time-office/settings', label: 'Settings', permission: 'attendance.manage' },
];

/** The API wraps payloads as `{data}` or returns them bare; paginators carry `data` plus meta. */
export const unwrap = (r) => (r && typeof r === 'object' && !Array.isArray(r) && 'data' in r ? r.data : r);
export const listOf = (r) => {
  const d = unwrap(r);
  if (Array.isArray(d)) return d;
  return Array.isArray(d?.data) ? d.data : [];
};
/** Normalizes Laravel paginator (`current_page`) and `{meta:{page}}` shapes for the shared Pagination control. */
export const pageOf = (r) => {
  const m = r?.meta ?? r ?? {};
  return {
    current_page: m.current_page ?? m.page ?? 1,
    last_page: m.last_page ?? Math.max(1, Math.ceil((m.total ?? 0) / (m.per_page || 25))),
    total: m.total ?? 0,
  };
};

export const today = () => new Date().toLocaleDateString('en-CA');
export const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
};
export const minutes = (m) => (m == null ? '—' : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`);
export const time = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
export const titleCase = (s) => String(s ?? '').replace(/[_-]+/g, ' ');

/** Maps the command center's server-side deep links onto this app's `/time-office` routes. */
export function normalizeHref(href = '') {
  const [path, qs] = String(href).split('?');
  let to = path.replace('/attendance/time-office', '/time-office');
  const extra = new URLSearchParams(qs || '');
  if (to === '/attendance/rosters') to = '/time-office/roster';
  else if (to === '/attendance/devices') to = '/time-office/devices';
  else if (to === '/time-office/missing-punches') {
    to = '/time-office/exceptions';
    extra.set('type', 'missing_in,missing_out');
  } else if (to === '/time-office/late') {
    to = '/time-office/daily';
    extra.set('status', 'late');
  }
  if (!to.startsWith('/time-office')) to = '/time-office';
  const s = extra.toString();
  return s ? `${to}?${s}` : to;
}

/** Fetches a list endpoint (rows only). Returns the shared resource plus `rows`. */
export function useList(path) {
  const resource = useResource(path);
  return { ...resource, rows: resource.data ? listOf(resource.data) : [] };
}

/** Runs a mutation with busy + error state. `run(fn)` resolves to the result, or `undefined` on error. */
export function useAction() {
  const [state, setState] = useState({ busy: false, error: null });
  const run = useCallback(async (fn) => {
    setState({ busy: true, error: null });
    try {
      const result = await fn();
      setState({ busy: false, error: null });
      return result ?? true;
    } catch (error) {
      setState({ busy: false, error });
      return undefined;
    }
  }, []);
  const clear = useCallback(() => setState({ busy: false, error: null }), []);
  return { ...state, run, clear };
}

export const send = (method, path, body) => api(path, { method, body });

/** Options for department/location/shift filters. Failure degrades to an empty list (filters just stay text-free). */
export function useLookup(path) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let live = true;
    api(path)
      .then((r) => live && setRows(listOf(r)))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [path]);
  return rows;
}
export const toOptions = (rows, empty = 'All') => [
  { value: '', label: empty },
  ...rows.map((r) => ({ value: String(r.id ?? r.uuid), label: r.name ?? r.code ?? String(r.id) })),
];

/** Per-browser saved filter views (a convenience only: storage failures are ignored). */
export function loadViews(key) {
  try {
    return JSON.parse(localStorage.getItem(`to-views:${key}`)) || [];
  } catch {
    return [];
  }
}
export function storeViews(key, views) {
  try {
    localStorage.setItem(`to-views:${key}`, JSON.stringify(views));
  } catch {
    /* storage unavailable */
  }
}

export { query };
