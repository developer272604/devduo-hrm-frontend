import { api, query } from './api';

/**
 * Leave API helpers (employee + manager surface). Every endpoint is named once here; pages never build URLs.
 * Paths are relative to `/api` (see lib/api.js). Units are 4-dp decimal strings from the server.
 */
const L = '/v1/leave';

export const leavePaths = {
  types: `${L}/types`,
  directory: '/v1/directory',
  balances: `${L}/me/balances`,
  ledger: (id) => `${L}/accounts/${id}/ledger`,
  ledgerEntry: (id) => `${L}/ledger/entries/${id}`,
  explainBalance: `${L}/explain/balance`,
  explainRequest: (uuid) => `${L}/explain/requests/${uuid}`,
  forecast: `${L}/forecast`,
  timeStory: `${L}/time-story`,
  requests: `${L}/requests`,
  preview: `${L}/requests/preview`,
  request: (uuid) => `${L}/requests/${uuid}`,
  requestAction: (uuid, action) => `${L}/requests/${uuid}/${action}`,
  document: (uuid, doc) => `${L}/requests/${uuid}/documents/${doc}`,
  approvals: `${L}/approvals`,
  compOff: `${L}/comp-off`,
  compOffAction: (uuid, action) => `${L}/comp-off/${uuid}/${action}`,
  compOffTrace: (uuid) => `${L}/comp-off/${uuid}/trace`,
  myCalendar: `${L}/calendar/me`,
  teamCalendar: `${L}/team/calendar`,
  teamAvailability: `${L}/team/availability`,
};

export const newKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Servers wrap single records in `{data}`; accept both shapes. */
export const unwrap = (res) => (res && res.data !== undefined && !Array.isArray(res) ? res.data : res);
export const listOf = (res) => (Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);
/** Pagination meta lives either on the root (Laravel paginator) or under `meta`. */
export const pageOf = (res) => ({ ...(res?.meta || {}), ...(res?.current_page ? res : {}) });

export const getTypes = () => api(`${leavePaths.types}?${query({ active_only: 1 })}`);
export const getBalances = (params = {}) => api(`${leavePaths.balances}?${query(params)}`);
export const getLedger = (account, asOf) => api(`${leavePaths.ledger(account)}?${query({ as_of: asOf })}`);
export const getExplainBalance = (params) => api(`${leavePaths.explainBalance}?${query(params)}`);
export const getForecast = (params) => api(`${leavePaths.forecast}?${query(params)}`);
export const getTimeStory = (params) => api(`${leavePaths.timeStory}?${query(params)}`);
export const listRequests = (params) => api(`${leavePaths.requests}?${query(params)}`);
export const getRequest = (uuid) => api(leavePaths.request(uuid));
export const decideRequest = (uuid, action, body = {}) =>
  api(leavePaths.requestAction(uuid, action), { method: 'POST', body });

/** Request body shared by preview, submit and modify. Empty values are dropped; times only apply to the hours portion. */
export function buildRequestBody(v, extra = {}) {
  const body = {
    leave_type: v.leave_type,
    start_date: v.start_date,
    end_date: v.end_date || v.start_date,
    portion: v.portion || 'full_day',
    reason: v.reason,
    handover_notes: v.handover_notes,
    delegate_employee: v.delegate_employee,
    ...(v.portion === 'hours' ? { start_time: v.start_time, end_time: v.end_time } : {}),
    ...extra,
  };
  return Object.fromEntries(Object.entries(body).filter(([, x]) => x !== '' && x != null));
}

/** Submits as multipart only when files are attached (documents[]), otherwise plain JSON. */
export function toPayload(body, files = []) {
  if (!files.length) return body;
  const form = new FormData();
  Object.entries(body).forEach(([k, x]) => form.append(k, x));
  files.forEach((f) => form.append('documents[]', f));
  return form;
}

export const submitRequest = ({ path = leavePaths.requests, body, files, key }) =>
  api(path, { method: 'POST', body: toPayload(body, files), headers: { 'Idempotency-Key': key } });
export const previewRequest = (body, signal) => api(leavePaths.preview, { method: 'POST', body, signal });

/* ---- vocabulary ---- */
export const STATUS = {
  pending: { label: 'Pending', tone: 'amber' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'rose' },
  withdrawn: { label: 'Withdrawn', tone: 'slate' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
  partially_cancelled: { label: 'Partly cancelled', tone: 'amber' },
  modified: { label: 'Modified', tone: 'slate' },
};
export const statusMeta = (s) => STATUS[s] || { label: String(s || '-').replaceAll('_', ' '), tone: 'slate' };

export const PORTIONS = {
  full_day: 'Full day',
  first_half: 'First half',
  second_half: 'Second half',
  quarter: 'Quarter day',
  hours: 'Specific hours',
};
/** Portions a type unit allows (docs: day = full only; half_day +halves; quarter_day +quarter; hour = all). */
export function allowedPortions(type) {
  const explicit = type?.limits?.allowed_portions || type?.rules?.limits?.allowed_portions;
  if (Array.isArray(explicit) && explicit.length) return explicit;
  const order = ['full_day'];
  if (['half_day', 'quarter_day', 'hour'].includes(type?.unit)) order.push('first_half', 'second_half');
  if (['quarter_day', 'hour'].includes(type?.unit)) order.push('quarter');
  if (type?.unit === 'hour') order.push('hours');
  return order;
}

/** "1.5000" becomes "1.5 days"; the server value stays authoritative, only trailing zeros are trimmed. */
export function fmtUnits(value, unit) {
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  const text = String(Number(n.toFixed(4)));
  const suffix = unit === 'hour' ? 'h' : Math.abs(n) === 1 ? ' day' : ' days';
  return `${text}${suffix}`;
}
export const personName = (p) => (typeof p === 'string' ? p : p?.name || p?.display_name || p?.full_name || '-');
export const typeName = (t) => (typeof t === 'string' ? t : t?.name || 'Leave');
export const fmtDate = (d) => (d ? String(d).slice(0, 10) : '-');
export const fmtRange = (r) =>
  !r.end_date || r.start_date === r.end_date ? fmtDate(r.start_date) : `${fmtDate(r.start_date)} to ${fmtDate(r.end_date)}`;
export const fmtDateTime = (d) => (d ? String(d).replace('T', ' ').slice(0, 16) : '-');

/** Turns an ApiError into the message shown to people, covering the documented 423 / 409 / 422 cases. */
export function describeError(e) {
  const detail = Object.values(e?.errors || {}).flat().filter(Boolean);
  if (e?.status === 423) return `This period is locked and cannot be changed. ${e.message}`.trim();
  if (e?.status === 409) return `${e.message || 'This conflicts with a change that was already made.'} Refresh and try again.`;
  if (e?.status === 422 && e?.data?.code === 'insufficient_balance') return 'Your balance is not enough for this request.';
  if (e?.status === 403) return 'You do not have permission to do that.';
  if (e?.status === 404) return 'This record is not available to you.';
  if (e?.status === 422 && detail.length) return detail.join(' ');
  return e?.message || 'Something went wrong. Please try again.';
}

export const todayLocal = () => new Date().toLocaleDateString('en-CA');
