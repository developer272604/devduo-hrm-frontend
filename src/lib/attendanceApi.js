import { api, query } from './api';

/** Thin wrappers over /api/v1/attendance/*. Pages never build URLs by hand. */
const A = '/v1/attendance';

export const newKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const punchStatus = () => api(`${A}/me/status`);
export const sendPunch = ({ direction, key, position }) =>
  api(`${A}/me/punch`, {
    method: 'POST',
    body: {
      direction,
      idempotency_key: key,
      source: 'web',
      ...(position
        ? {
            latitude: position.latitude,
            longitude: position.longitude,
            accuracy: position.accuracy,
          }
        : {}),
    },
  });
export const dayPunches = (date) => api(`${A}/me/punches?${query({ date })}`);
export const dayDetail = (uuid) => api(`${A}/days/${uuid}`);

/** The days endpoint is paginated (25); a month needs every page. */
export async function monthDays(employee, month, signal) {
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const to = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  let page = 1,
    last = 1;
  const rows = [];
  do {
    const res = await api(`${A}/days?${query({ from, to, employee, page })}`, { signal });
    rows.push(...(res.data || []));
    last = res.last_page || res.meta?.last_page || 1;
    page += 1;
  } while (page <= last && page <= 5);
  return rows;
}

export const teamToday = (date) => api(`${A}/team/today?${query({ date })}`);
export const decide = (kind, uuid, action, body = {}) =>
  api(`${A}/${kind}/${uuid}/${action}`, { method: 'POST', body });

/** Turns raw punches into the shape the day reconstruction timeline renders. */
export function punchesToTimeline(punches = []) {
  return punches.map((p) => ({
    at: p.punched_at,
    display: (p.local_time || '').slice(11, 16),
    kind: p.voided ? 'voided' : 'punch',
    label: `${p.voided ? 'Voided ' : ''}${p.direction === 'IN' ? 'Check in' : p.direction === 'OUT' ? 'Check out' : 'Punch'} (${p.source})`,
    detail:
      [
        p.place && `At ${p.place}`,
        p.geofence_status === 'outside' && 'Outside the approved area',
        p.late_sync && 'Synced late',
        p.void_reason,
      ]
        .filter(Boolean)
        .join(' · ') || null,
  }));
}

export const fmtMinutes = (m) => {
  const n = Math.max(0, Math.round(Number(m) || 0));
  return n >= 60 ? `${Math.floor(n / 60)}h ${String(n % 60).padStart(2, '0')}m` : `${n}m`;
};
export const fmtTime = (iso, timeZone) =>
  iso
    ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone })
    : '—';

/** Status vocabulary shared by badge and calendar (codes are the backend contract). */
export const STATUS = {
  present: { label: 'Present', tone: 'green' },
  half_day: { label: 'Half day', tone: 'amber' },
  absent: { label: 'Absent', tone: 'rose' },
  missing_punch: { label: 'Missing punch', tone: 'amber' },
  incomplete: { label: 'Incomplete', tone: 'amber' },
  on_duty: { label: 'On duty', tone: 'brand' },
  remote_work: { label: 'Remote work', tone: 'brand' },
  leave: { label: 'On leave', tone: 'slate' },
  holiday: { label: 'Holiday', tone: 'slate' },
  weekly_off: { label: 'Weekly off', tone: 'slate' },
  not_scheduled: { label: 'Not scheduled', tone: 'slate' },
  pending: { label: 'Pending', tone: 'slate' },
};
export const statusMeta = (s) => STATUS[s] || { label: String(s || '—').replaceAll('_', ' '), tone: 'slate' };

export const isLockedError = (e) => e?.status === 423;
