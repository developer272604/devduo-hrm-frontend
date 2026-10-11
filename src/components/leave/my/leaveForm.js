import { allowedPortions } from '../../../lib/leaveApi';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const emptyRequest = (over = {}) => ({
  leave_type: '',
  start_date: '',
  end_date: '',
  portion: 'full_day',
  start_time: '',
  end_time: '',
  reason: '',
  handover_notes: '',
  delegate_employee: '',
  ...over,
});

/** Client rules only catch what is knowable without the server (required fields, contradictions). The server stays authoritative. */
export function validateLeaveRequest(v, type, files = []) {
  const e = {};
  if (!v.leave_type) e.leave_type = 'Choose a leave type.';
  if (!v.start_date) e.start_date = 'Choose the first day.';
  if (v.end_date && v.start_date && v.end_date < v.start_date) e.end_date = 'The last day cannot be before the first day.';
  if (type && !allowedPortions(type).includes(v.portion)) e.portion = 'This leave type does not allow that portion.';
  if (v.portion === 'hours' && (!v.start_time || !v.end_time)) e.start_time = 'Enter the start and end time.';
  if (v.reason.length > 2000) e.reason = 'Keep the reason under 2000 characters.';
  const big = files.find((f) => f.size > MAX_FILE_BYTES);
  if (big) e.documents = `${big.name} is larger than 5 MB.`;
  return e;
}
