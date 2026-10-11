import { api, query } from './api';

/**
 * Profile change requests (docs/api/people-lifecycle.md).
 *
 *   POST /v1/employees/{uuid}/change-requests        { section, operation, target_id?, requested_value, effective_date?, comments? }   (see peopleApi.submitChangeRequest)
 *   GET  /v1/people/change-requests?status=&mine=1&employee_uuid=&page=   paginated; approvers also see requests in their data scope
 *   GET  /v1/people/change-requests/{uuid}
 *   POST /v1/people/change-requests/{uuid}/approve   { comment? }
 *   POST /v1/people/change-requests/{uuid}/reject    { comment }   (required)
 *   POST /v1/people/change-requests/{uuid}/cancel    requester only, while pending
 *
 * Request: { uuid, employee:{uuid,name,employee_number}, section, operation: create|update|delete, target_id,
 *   status: pending|approved|rejected|cancelled, fields:[name], old_value:{}, requested_value:{}, masked,
 *   requested_by (name), requested_at, effective_date, comments, decided_by (name), decided_at, decision_comment,
 *   can_decide, can_cancel }
 * Bank and identity values arrive masked unless the viewer may reveal them; the UI never un-masks.
 */
export const listQueue = ({ status = 'pending', page = 1 } = {}) => api(queuePath({ status, page }));
export const listMine = (employeeUuid, { status = '', page = 1 } = {}) => api(minePath(employeeUuid, { status, page }));
export const approveRequest = (uuid, comment = '') =>
  api(`/v1/people/change-requests/${uuid}/approve`, { method: 'POST', body: comment ? { comment } : {} });
export const rejectRequest = (uuid, comment) =>
  api(`/v1/people/change-requests/${uuid}/reject`, { method: 'POST', body: { comment } });
export const cancelRequest = (uuid) =>
  api(`/v1/people/change-requests/${uuid}/cancel`, { method: 'POST' });
export const myEmployee = () => api('/v1/me/employee');

export const queuePath = (params) => `/v1/people/change-requests?${query(params)}`;
/** The employee's own requests: the same listing, narrowed with `mine=1` (every requester sees only their own). */
export const minePath = (employeeUuid, params) =>
  `/v1/people/change-requests?${query({ mine: 1, employee_uuid: employeeUuid, ...params })}`;

/** Turns a request's old/requested value objects into the field-by-field rows the diff renders. */
export function changesOf(request) {
  const requested = request?.requested_value || {};
  const before = request?.old_value || {};
  // `custom` carries `{values:{key:value}, effective_from?}`.
  const newer = request?.section === 'custom' && requested.values ? requested.values : requested;
  const older = request?.section === 'custom' && before.values ? before.values : before;
  const names = request?.section === 'custom' && requested.values ? Object.keys(newer) : (request?.fields?.length ? request.fields : Object.keys(newer));
  return names.map((field) => ({
    field,
    label: field.replaceAll('_', ' '),
    before: older[field],
    after: request?.operation === 'delete' ? undefined : newer[field],
    masked: Boolean(request?.masked),
  }));
}

/** Show only the last 4 characters of a sensitive value; never reveal short values. */
export function maskValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  const text = String(value);
  if (/^[•*]+/.test(text) || text.includes('••')) return text;
  return text.length <= 4 ? '••••' : `••••${text.slice(-4)}`;
}
