import { useEffect } from 'react';
import { query } from './api';

/**
 * Leave HR operations API helpers. Every endpoint the console uses is named here, so a backend path change is a one-line edit.
 * Paths are relative to `/api` (see lib/api.js). Generic helpers are shared with the Time Office console.
 */
export {
  addDays,
  listOf,
  pageOf,
  send,
  titleCase,
  today,
  unwrap,
  useAction,
  useList,
  useLookup,
} from './timeOfficeApi';
export { query };

export const L = '/v1/leave';
export const paths = {
  settings: `${L}/settings`,
  bulkActions: `${L}/bulk-actions`,
  bulkActionPreview: (key) => `${L}/bulk-actions/${encodeURIComponent(key)}/preview`,
  bulkActionRun: (key) => `${L}/bulk-actions/${encodeURIComponent(key)}/run`,
  commandCenter: `${L}/command-center`,
  types: `${L}/types`,
  typesSeed: `${L}/types/seed-defaults`,
  policies: `${L}/policies`,
  policy: (uuid, part) => `${L}/policies/${uuid}${part ? `/${part}` : ''}`,
  policyVersion: (uuid, n, part) => `${L}/policies/${uuid}/versions/${n}${part ? `/${part}` : ''}`,
  policyDiff: (uuid) => `${L}/policies/${uuid}/diff`,
  policyResolve: `${L}/policies/resolve`,
  policyAssignments: `${L}/policy-assignments`,
  eligibility: `${L}/eligibility/check`,
  cycles: `${L}/cycles`,
  cyclePeriods: (uuid) => `${L}/cycles/${uuid}/periods`,
  cyclePeriodsGenerate: (uuid) => `${L}/cycles/${uuid}/periods/generate`,
  accrualRuns: `${L}/accrual-runs`,
  accrualPreview: `${L}/accrual-runs/preview`,
  accrualRun: (id, part) => `${L}/accrual-runs/${id}${part ? `/${part}` : ''}`,
  carryForward: `${L}/carry-forward`,
  carryForwardPreview: `${L}/carry-forward/preview`,
  carryForwardRun: `${L}/carry-forward/run`,
  expiries: `${L}/expiries`,
  expiriesProcess: `${L}/expiries/process`,
  adjustments: `${L}/adjustments`,
  adjustment: (uuid, part) => `${L}/adjustments/${uuid}/${part}`,
  adjustmentsBulkPreview: `${L}/adjustments/bulk/preview`,
  adjustmentsBulk: `${L}/adjustments/bulk`,
  adjustmentsBulkDecide: (key, part) => `${L}/adjustments/bulk/${key}/${part}`,
  imports: `${L}/imports`,
  importsTemplate: `${L}/imports/template`,
  importItem: (id, part) => `${L}/imports/${id}${part ? `/${part}` : ''}`,
  locks: `${L}/locks`,
  lockPreview: `${L}/locks/preview`,
  lockAction: (uuid, part) => `${L}/locks/${uuid}/${part}`,
  transfers: `${L}/transfers`,
  transferPreview: `${L}/transfers/preview`,
  transfer: (uuid, part) => `${L}/transfers/${uuid}${part ? `/${part}` : ''}`,
  typeMappings: `${L}/type-mappings`,
  payrollCutoff: `${L}/payroll/cutoff`,
  payrollContract: `${L}/payroll/contract`,
  payrollBatches: `${L}/payroll/contract/batches`,
  payrollBatch: (key) => `${L}/payroll/contract/batches/${encodeURIComponent(key)}`,
  simSandbox: `${L}/simulations/sandbox`,
  simEntitlement: `${L}/simulations/entitlement`,
  simImpact: `${L}/simulations/impact`,
  simPolicyDiff: `${L}/simulations/policy-diff`,
  simulations: `${L}/simulations`,
  reports: `${L}/reports`,
  report: (key) => `${L}/reports/${key}`,
  reportExport: (key) => `${L}/reports/${key}/export`,
  exports: `${L}/exports`,
  compOff: `${L}/comp-off`,
  compOffAction: (uuid, part) => `${L}/comp-off/${uuid}/${part}`,
};

/** Any of these permissions opens the leave operations centre; each page enforces its own permission. */
export const LEAVE_HR_ACCESS =
  'leave.manage|leave.policy.manage|leave.adjust|leave.adjust.approve|leave.accrual.run|leave.import|leave.lock|leave.unlock|leave.reports.view|leave.simulate|leave.compoff.manage';

export const HR = '/leave/hr';
/** Section navigation. `permission` is an any-of list; the nav shows only what the user may open. */
export const NAV = [
  {
    to: HR,
    label: 'Command center',
    end: true,
    permission: 'leave.reports.view|leave.manage|leave.team.view',
  },
  { to: `${HR}/types`, label: 'Leave types', permission: 'leave.policy.manage|leave.manage' },
  { to: `${HR}/policies`, label: 'Policies', permission: 'leave.policy.manage|leave.manage' },
  { to: `${HR}/cycles`, label: 'Cycles', permission: 'leave.policy.manage|leave.manage' },
  { to: `${HR}/accruals`, label: 'Accrual runs', permission: 'leave.accrual.run|leave.manage' },
  {
    to: `${HR}/adjustments`,
    label: 'Adjustments',
    permission: 'leave.adjust|leave.adjust.approve|leave.manage',
  },
  {
    to: `${HR}/carry-forward`,
    label: 'Carry-forward & expiry',
    permission: 'leave.accrual.run|leave.manage',
  },
  { to: `${HR}/comp-off`, label: 'Comp-off', permission: 'leave.compoff.manage|leave.manage' },
  { to: `${HR}/imports`, label: 'Imports', permission: 'leave.import|leave.manage' },
  { to: `${HR}/locks`, label: 'Locks', permission: 'leave.lock|leave.unlock|leave.manage' },
  { to: `${HR}/transfers`, label: 'Transfers & separation', permission: 'leave.manage' },
  { to: `${HR}/payroll`, label: 'Payroll contract', permission: 'leave.manage|leave.reports.view' },
  {
    to: `${HR}/simulations`,
    label: 'Simulators',
    permission: 'leave.simulate|leave.policy.manage',
  },
  { to: `${HR}/reports`, label: 'Reports', permission: 'leave.reports.view|leave.manage' },
  {
    to: `${HR}/quality`,
    label: 'Data quality & setup',
    permission: 'leave.manage|leave.reports.view|leave.policy.manage',
  },
  { to: `${HR}/settings`, label: 'Settings', permission: 'leave.manage|leave.policy.manage' },
  { to: `${HR}/bulk-actions`, label: 'Bulk actions', permission: 'leave.manage' },
];

export const LEAVE_KINDS = [
  'annual',
  'casual',
  'sick',
  'medical',
  'parental',
  'maternity',
  'paternity',
  'bereavement',
  'marriage',
  'study',
  'sabbatical',
  'unpaid',
  'comp_off',
  'optional_holiday',
  'custom',
];
export const ASSIGN_TARGETS = [
  'tenant',
  'country',
  'legal_entity',
  'business_unit',
  'location',
  'department',
  'team',
  'employee_group',
  'employee_type',
  'employee',
];

/** Units arrive as 4-dp strings. Show them without trailing zeros but never as floats. */
export const units = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const s = String(v);
  return /^-?\d+\.\d+$/.test(s) ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
};
export const dateOnly = (v) => (v ? String(v).slice(0, 10) : '—');
export const options = (values, empty) => [
  ...(empty === undefined ? [] : [{ value: '', label: empty }]),
  ...values.map((v) =>
    typeof v === 'object' ? v : { value: v, label: String(v).replace(/[_-]+/g, ' ') },
  ),
];
export const typeOptions = (types, empty) => [
  ...(empty === undefined ? [] : [{ value: '', label: empty }]),
  ...types.map((t) => ({ value: t.code, label: `${t.name} (${t.code})` })),
];
/** Splits "a, b\nc" into trimmed ids. */
export const splitIds = (text) =>
  String(text ?? '')
    .split(/[\s,;]+/)
    .filter(Boolean);
export const newKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** Re-runs `reload` every few seconds while `active` (queued/running work). */
export function usePoll(active, reload, deps = [], ms = 3000) {
  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(reload, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps]);
}
