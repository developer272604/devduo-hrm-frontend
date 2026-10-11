import { api, download, query } from './api';

/** Thin, typed-by-convention helpers over the People API (paths are relative to /api). */

export const STATUSES = [
  'preboarding',
  'active',
  'probation',
  'notice_period',
  'suspended',
  'long_leave',
  'inactive',
  'separated',
  'archived',
];
export const WORKER_TYPES = ['employee', 'contractor', 'intern', 'consultant', 'temporary'];
export const WORK_MODES = ['onsite', 'remote', 'hybrid'];
export const GENDERS = ['female', 'male', 'non_binary', 'other', 'undisclosed'];

export const label = (value) =>
  value ? String(value).replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase()) : '';

const TONES = { active: 'green', probation: 'amber', preboarding: 'purple', notice_period: 'amber' };
export const statusTone = (status) => TONES[status] || 'neutral';

/** Remove empty filter values so the URL stays short and the API never sees blanks. */
export const cleanFilters = (filters = {}) =>
  Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  );

export function directoryPath({ coworkers = false, filters = {}, sort, page = 1, perPage = 25 }) {
  return `/v1/${coworkers ? 'directory' : 'employees'}?${query({
    ...cleanFilters(filters),
    sort: sort?.key,
    dir: sort?.dir,
    page,
    per_page: perPage,
  })}`;
}

/** 409 helpers: ApiError exposes only status/message/errors, so also honour a `code` when present. */
export const isDuplicate = (e) =>
  e?.status === 409 &&
  (e.code === 'possible_duplicate' || /already exist|duplicate/i.test(e.message || ''));
export const isChangeRequired = (e) =>
  e?.status === 409 &&
  (e.code === 'change_request_required' || /approval|change request/i.test(e.message || ''));

/** Flatten Laravel `errors` ({field: [msg]}) into {field: 'msg'} for inline display. */
export function fieldErrors(error) {
  const out = {};
  Object.entries(error?.errors || {}).forEach(([k, v]) => {
    out[k] = Array.isArray(v) ? v.join(' ') : String(v);
  });
  return out;
}

export const getProfile = (uuid) => api(`/v1/employees/${uuid}`);
export const listSection = (uuid, segment) => api(`/v1/employees/${uuid}/${segment}`);
export const createRecord = (uuid, segment, body) =>
  api(`/v1/employees/${uuid}/${segment}`, { method: 'POST', body });
export const updateRecord = (uuid, segment, id, body) =>
  api(`/v1/employees/${uuid}/${segment}/${id}`, { method: 'PATCH', body });
export const deleteRecord = (uuid, segment, id) =>
  api(`/v1/employees/${uuid}/${segment}/${id}`, { method: 'DELETE' });

export const savePersonal = (uuid, body) =>
  api(`/v1/employees/${uuid}/personal`, { method: 'PATCH', body });
export const changeStatus = (uuid, body) =>
  api(`/v1/employees/${uuid}/status`, { method: 'POST', body });
export const updateEmployment = (uuid, body) =>
  api(`/v1/employees/${uuid}/employment`, { method: 'PATCH', body });
export const changeAssignment = (uuid, body) =>
  api(`/v1/employees/${uuid}/assignments`, { method: 'POST', body });
export const changeManager = (uuid, body) =>
  api(`/v1/employees/${uuid}/relationships`, { method: 'POST', body });

export const revealIdentity = (uuid, id, kind = 'identity') =>
  api(`/v1/employees/${uuid}/${kind}/${id}/reveal`, { method: 'POST' });

export function uploadDocument(uuid, fields, file, documentId) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => v !== '' && v != null && form.append(k, v));
  form.append('file', file);
  return api(
    documentId
      ? `/v1/employees/${uuid}/documents/${documentId}/versions`
      : `/v1/employees/${uuid}/documents`,
    { method: 'POST', body: form },
  );
}
export const downloadDocument = (uuid, id, name) =>
  download(`/v1/employees/${uuid}/documents/${id}/download`, name);

export const bulkPreview = (body) => api('/v1/people/bulk/preview', { method: 'POST', body });
export const bulkApply = (confirmation_token) =>
  api('/v1/people/bulk/apply', { method: 'POST', body: { confirmation_token } });

export const listViews = () => api('/v1/people/views');
export const saveView = (body) => api('/v1/people/views', { method: 'POST', body });
export const deleteView = (uuid) => api(`/v1/people/views/${uuid}`, { method: 'DELETE' });

/** Queue an export, poll until it is ready, then download it. Resolves with the final export record. */
export async function runExport({ filters, selected, format = 'csv', wait = 1500, tries = 20 }) {
  const body = { format, filters: cleanFilters(filters) };
  if (selected?.length) body.selected_uuids = selected;
  let job = await api('/v1/people/exports', { method: 'POST', body });
  for (let i = 0; i < tries && !['completed', 'failed', 'expired'].includes(job.status); i++) {
    await new Promise((resolve) => setTimeout(resolve, wait));
    job = await api(`/v1/people/exports/${job.uuid}`);
  }
  if (job.status !== 'completed') throw new Error('The export is not ready yet. Check Import / export.');
  await download(`/v1/people/exports/${job.uuid}/download`, `employees.${format}`);
  return job;
}

export const createEmployee = (body, quick) =>
  api(quick ? '/v1/employees/quick-add' : '/v1/employees', { method: 'POST', body });

/** localStorage that never throws (private windows, blocked storage, tests). */
export const readLocal = (key, fallback = null) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
export const writeLocal = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the feature degrades to in-memory state */
  }
};
export const removeLocal = (key) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

/** Employee self-service change request (used when the tenant edit rule for a section is `request`). */
export const submitChangeRequest = (uuid, body) =>
  api(`/v1/employees/${uuid}/change-requests`, { method: 'POST', body });
export const getCompleteness = (uuid) => api(`/v1/employees/${uuid}/completeness`);

/** Lifecycle endpoints (docs/api/people-lifecycle.md). */
export const confirmProbation = (uuid, body) =>
  api(`/v1/employees/${uuid}/probation/confirm`, { method: 'POST', body });
export const extendProbation = (uuid, body) =>
  api(`/v1/employees/${uuid}/probation/extend`, { method: 'POST', body });
export const startSeparation = (uuid, body) =>
  api(`/v1/employees/${uuid}/separation`, { method: 'POST', body });
export const completeSeparation = (uuid, body = {}) =>
  api(`/v1/employees/${uuid}/separation/complete`, { method: 'POST', body });
export const withdrawSeparation = (uuid, body = {}) =>
  api(`/v1/employees/${uuid}/separation/withdraw`, { method: 'POST', body });
export const rehireEmployee = (uuid, body) =>
  api(`/v1/employees/${uuid}/rehire`, { method: 'POST', body });
export const listInvitations = (uuid) => api(`/v1/employees/${uuid}/invitations`);
export const inviteEmployee = (uuid, body = {}) =>
  api(`/v1/employees/${uuid}/invitations`, { method: 'POST', body });
export const resendInvitation = (uuid) => api(`/v1/people/invitations/${uuid}/resend`, { method: 'POST' });
export const cancelInvitation = (uuid) => api(`/v1/people/invitations/${uuid}/cancel`, { method: 'POST' });
