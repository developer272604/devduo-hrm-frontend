import { query } from './api';

export { listOf, pageOf, send, today, unwrap, useAction, useList, useLookup } from './timeOfficeApi';
export { query };

export const P = '/v1/performance';
export const paths = {
  goals: `${P}/goals`,
  goal: (uuid, part = '') => `${P}/goals/${uuid}${part ? `/${part}` : ''}`,
  cycles: `${P}/cycles`,
  cycle: (uuid, part = '') => `${P}/cycles/${uuid}${part ? `/${part}` : ''}`,
  templates: `${P}/templates`,
  reviews: `${P}/reviews`,
  review: (uuid, part = '') => `${P}/reviews/${uuid}${part ? `/${part}` : ''}`,
  response: (uuid) => `${P}/review-responses/${uuid}/submit`,
  dashboard: `${P}/dashboard`,
  scales: `${P}/rating-scales`,
  competencies: `${P}/competencies`,
  calibration: (cycle, part = '') => `${P}/cycles/${cycle}/calibration${part ? `/${part}` : ''}`,
  finalize: (cycle) => `${P}/cycles/${cycle}/finalize`,
  propose: (review) => `${P}/reviews/${review}/calibration-changes`,
  decide: (change) => `${P}/calibration-changes/${change}/decision`,
  peers: (review) => `${P}/reviews/${review}/peers`,
  manager: (review) => `${P}/reviews/${review}/manager`,
  feedback: `${P}/feedback`,
  oneOnOnes: `${P}/one-on-ones`,
  plans: `${P}/development-plans`,
  planActions: (uuid) => `${P}/development-plans/${uuid}/actions`,
  action: (uuid) => `${P}/development-actions/${uuid}`,
  pips: `${P}/pips`,
  pip: (uuid, part = '') => `${P}/pips/${uuid}${part ? `/${part}` : ''}`,
  directory: '/v1/directory',
};

export const NAV = [
  { to: '/performance/goals', label: 'Goals and OKRs', permission: 'performance.self|performance.view' },
  { to: '/performance/reviews', label: 'Reviews', permission: 'performance.self|performance.view' },
  { to: '/performance/feedback', label: 'Feedback', permission: 'performance.self' },
  { to: '/performance/one-on-ones', label: '1:1 notes', permission: 'performance.self' },
  { to: '/performance/development', label: 'Development', permission: 'performance.self|performance.view' },
  { to: '/performance/calibration', label: 'Calibration', permission: 'performance.calibrate|performance.calibrate.approve' },
  { to: '/performance/cycles', label: 'Cycles', permission: 'performance.cycles.manage' },
  { to: '/performance/configuration', label: 'Configuration', permission: 'performance.cycles.manage' },
  { to: '/performance/pips', label: 'Improvement plans', permission: 'performance.pip.manage' },
  { to: '/performance/dashboard', label: 'Dashboard', permission: 'performance.reports.view' },
];
export const PERFORMANCE_ACCESS = [...new Set(NAV.flatMap((n) => n.permission.split('|')))].join('|');

export const titleCase = (s) => String(s ?? '').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
export const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined));

/** Throws an error shaped like the API's so FormModal shows it (message plus a per-field list). */
export const invalid = (field, message) => Object.assign(new Error('Please fix the problem below.'), { errors: { [field]: [message] } });

/** Client-side mirrors of the server rules, used for fast feedback. The server stays authoritative. */
export function validateScale(v) {
  if (!/^[A-Z][A-Z0-9_]{0,39}$/.test(v.code ?? '')) throw invalid('code', 'Use capital letters, digits and underscores, starting with a letter.');
  const min = Number(v.min);
  const max = Number(v.max);
  if (Number.isNaN(min) || Number.isNaN(max) || max <= min) throw invalid('max', 'The maximum must be greater than the minimum.');
  const labels = String(v.labels ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [value, ...rest] = l.split('=');
      return { value: Number(value), label: rest.join('=').trim() };
    });
  if (labels.length < 2 || labels.length > 10) throw invalid('labels', 'Give between 2 and 10 labels, one per line, like 3=Meets expectations.');
  if (labels.some((l) => Number.isNaN(l.value) || !l.label)) throw invalid('labels', 'Each line must look like 3=Meets expectations.');
  if (labels.some((l) => l.value < min || l.value > max)) throw invalid('labels', 'Every label must sit inside the scale range.');
  return { code: v.code, name: v.name, min, max, labels };
}

export const reviewerTotal = (w) => ['manager', 'self', 'peer', 'skip'].reduce((a, k) => a + (Number(w?.[k]) || 0), 0);

export function validateTemplate(v) {
  if (!v.scale_code) throw invalid('scale_code', 'Choose a rating scale.');
  const sections = v.sections ?? [];
  if (!sections.length) throw invalid('sections', 'Add at least one section.');
  const keys = sections.map((s) => s.key);
  if (keys.some((k) => !/^[a-z][a-z0-9_]{0,39}$/.test(k ?? ''))) throw invalid('sections', 'Section keys use lowercase letters, digits and underscores.');
  if (new Set(keys).size !== keys.length) throw invalid('sections', 'Section keys must be unique.');
  if (sections.some((s) => !(Number(s.weight) > 0 && Number(s.weight) <= 100))) throw invalid('sections', 'Every section needs a weight between 0.01 and 100.');
  if (Math.abs(reviewerTotal(v.reviewer_weights) - 100) > 0.001) throw invalid('reviewer_weights', `Reviewer weights must total 100 (now ${reviewerTotal(v.reviewer_weights)}).`);
  return {
    name: v.name,
    scale_code: v.scale_code,
    sections: sections.map((s) => ({ key: s.key, title: s.title, type: s.type, weight: Number(s.weight), mandatory: Boolean(s.mandatory) })),
    reviewer_weights: Object.fromEntries(['manager', 'self', 'peer', 'skip'].map((k) => [k, Number(v.reviewer_weights?.[k]) || 0])),
  };
}

export function validateCycle(v) {
  if (!v.template_uuid) throw invalid('template_uuid', 'Choose a review template.');
  if (!v.start_date || !v.end_date || v.end_date <= v.start_date) throw invalid('end_date', 'The end date must be after the start date.');
  const body = clean({ name: v.name, kind: v.kind, template_uuid: v.template_uuid, start_date: v.start_date, end_date: v.end_date, self_due: v.self_due, manager_due: v.manager_due, peer_due: v.peer_due, calibration_due: v.calibration_due });
  for (const k of ['self_due', 'manager_due', 'peer_due', 'calibration_due']) {
    if (body[k] && body[k] < v.start_date) throw invalid(k, 'Due dates cannot be before the cycle starts.');
  }
  const tenure = v.min_tenure_days === '' || v.min_tenure_days == null ? null : Number(v.min_tenure_days);
  if (tenure !== null && (!Number.isInteger(tenure) || tenure < 0 || tenure > 3650)) throw invalid('min_tenure_days', 'Minimum tenure must be a whole number of days between 0 and 3650.');
  const peers = Number(v.min_peer_responses || 1);
  if (!Number.isInteger(peers) || peers < 1 || peers > 10) throw invalid('min_peer_responses', 'Minimum peer responses must be between 1 and 10.');
  body.eligibility = { ...(tenure === null ? {} : { min_tenure_days: tenure }), exclude_probation: Boolean(v.exclude_probation) };
  body.settings = { min_peer_responses: peers, peer_anonymous: v.peer_anonymous !== false, share_peer_feedback: Boolean(v.share_peer_feedback) };
  return body;
}

export function validatePip(v) {
  if (!v.employee_uuid) throw invalid('employee_uuid', 'Choose the employee.');
  if (String(v.reason ?? '').trim().length < 10) throw invalid('reason', 'Explain the reason in at least 10 characters.');
  if (!v.start_date || !v.end_date || v.end_date < v.start_date) throw invalid('end_date', 'The end date must not be before the start date.');
  const checkpoints = String(v.checkpoints ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [due_on, ...rest] = l.split('|');
      return { due_on: due_on.trim(), expectation: rest.join('|').trim() };
    });
  if (checkpoints.some((c) => !/^\d{4}-\d{2}-\d{2}$/.test(c.due_on) || !c.expectation)) throw invalid('checkpoints', 'Each checkpoint line must look like 2026-11-15 | What good looks like.');
  if (checkpoints.some((c) => c.due_on < v.start_date || c.due_on > v.end_date)) throw invalid('checkpoints', 'Checkpoints must fall inside the plan period.');
  return clean({ employee_uuid: v.employee_uuid, reason: v.reason.trim(), support_plan: v.support_plan, start_date: v.start_date, end_date: v.end_date, checkpoints: checkpoints.length ? checkpoints : undefined });
}

/** PIP workflow gating: which actions the plan status allows. */
export const pipActions = (status) => ({ activate: status === 'draft', checkpoint: status === 'active', complete: status === 'active' });

/** Maker-checker gating for a calibration change as seen by the current user. */
export const changeGate = (change, canApprove) => ({
  canDecide: Boolean(canApprove) && change.status === 'pending' && !change.proposed_by_me,
  waitingForOther: change.status === 'pending' && Boolean(change.proposed_by_me),
});

/** What stops a cycle from finalizing, from the calibration workspace payload. */
export function finalizeBlockers(ws) {
  const pending = (ws?.changes ?? []).filter((c) => c.status === 'pending').length;
  const notReady = (ws?.reviews ?? []).filter((r) => r.status === 'calibration' && !r.manager_submitted);
  return { pending, notReady, blocked: pending > 0 };
}
