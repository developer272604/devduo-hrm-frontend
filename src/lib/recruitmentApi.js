import { ApiError, query } from './api';

/**
 * Recruitment API helpers (docs/api/recruitment.md). Every endpoint is named here, so a backend path change is a one-line edit.
 * Paths are relative to `/api`. Lists are Laravel paginators (`data`, `current_page`, `last_page`, `total`).
 */
export { listOf, pageOf, send, today, unwrap, useAction, useList, useLookup } from './timeOfficeApi';
export { query };

/** 'strong_yes' -> 'Strong yes'. */
export const titleCase = (s) => {
  const t = String(s ?? '').replace(/[_-]+/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const R = '/v1/recruitment';
export const paths = {
  jobs: `${R}/jobs`,
  requisitions: `${R}/requisitions`,
  requisition: (uuid, part) => `${R}/requisitions/${uuid}/${part}`,
  postings: `${R}/postings`,
  posting: (uuid, part) => `${R}/postings/${uuid}/${part}`,
  candidates: `${R}/candidates`,
  importPreview: `${R}/imports/candidates`,
  importCommit: (uuid) => `${R}/imports/candidates/${uuid}/commit`,
  anonymize: (uuid) => `${R}/candidates/${uuid}/anonymize`,
  applications: `${R}/applications`,
  transition: (uuid) => `${R}/applications/${uuid}/transition`,
  history: (uuid) => `${R}/applications/${uuid}/history`,
  interviews: `${R}/interviews`,
  interview: (uuid, part) => `${R}/interviews/${uuid}/${part}`,
  resumes: (uuid) => `${R}/candidates/${uuid}/resumes`,
  resume: (uuid, version) => `${R}/candidates/${uuid}/resumes/${version}`,
  resumeDownload: (uuid, version) => `${R}/candidates/${uuid}/resumes/${version}/download`,
  offerTemplates: `${R}/offer-templates`,
  offerDocuments: (uuid) => `${R}/offers/${uuid}/documents`,
  offerDocumentPrint: (uuid, version) => `${R}/offers/${uuid}/documents/${version}/print`,
  offers: `${R}/offers`,
  offer: (uuid, part) => `${R}/offers/${uuid}/${part}`,
  pipelines: `${R}/pipelines`,
  pipeline: (uuid, part) => `${R}/pipelines/${uuid}${part ? `/${part}` : ''}`,
  requisitionVersions: (uuid) => `${R}/requisitions/${uuid}/versions`,
  requisitionAmend: (uuid) => `${R}/requisitions/${uuid}/amend`,
  requisitionDecision: (uuid, version) => `${R}/requisitions/${uuid}/versions/${version}/decision`,
  analytics: `${R}/analytics`,
  users: `${R}/users`,
};

/** Candidate CSV template columns, in CandidateService::rules() order. `phone` is the only optional one. */
export const IMPORT_HEADERS = ['name', 'email', 'phone', 'source', 'privacy_notice_version', 'consent_reference', 'consented_at', 'retention_until'];
export const IMPORT_MAX_BYTES = 1024 * 1024;

export const STAGES = ['applied', 'screening', 'assessment', 'interview', 'offer'];

/** Section navigation. `permission` is an any-of list; the nav shows only what the user may open. */
export const NAV = [
  { to: '/recruitment/analytics', label: 'Analytics', permission: 'recruitment.reports.view' },
  { to: '/recruitment/requisitions', label: 'Requisitions', permission: 'recruitment.view' },
  { to: '/recruitment/postings', label: 'Job postings', permission: 'recruitment.view' },
  { to: '/recruitment/candidates', label: 'Candidates', permission: 'recruitment.view' },
  { to: '/recruitment/pipeline', label: 'Pipeline', permission: 'recruitment.view' },
  { to: '/recruitment/pipelines', label: 'Pipeline setup', permission: 'recruitment.view' },
  { to: '/recruitment/interviews', label: 'Interviews', permission: 'recruitment.view' },
  { to: '/recruitment/offers', label: 'Offers', permission: 'recruitment.offer.manage|recruitment.offer.approve' },
  { to: '/recruitment/offer-templates', label: 'Offer templates', permission: 'recruitment.offer.manage' },
];
export const RECRUITMENT_ACCESS = [...new Set(NAV.flatMap((n) => n.permission.split('|')))].join('|');

export const newKey = () => globalThis.crypto.randomUUID();
/** Drops empty optional form values before sending. */
export const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined));
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** Loads every page of a list (capped) for views that group client-side, such as the pipeline board. */
export async function fetchAll(api, path, cap = 10) {
  const rows = [];
  let page = 1;
  let last = 1;
  do {
    const r = await api(`${path}${path.includes('?') ? '&' : '?'}page=${page}`);
    rows.push(...(Array.isArray(r?.data) ? r.data : []));
    last = r?.last_page ?? 1;
    page += 1;
  } while (page <= last && page <= cap);
  return rows;
}


export const RESUME_MAX_BYTES = 5 * 1024 * 1024;
export const RESUME_EXTENSIONS = ['pdf', 'doc', 'docx'];
/** Client-side resume pre-check (the server re-checks the real content type). Returns an error message or ''. */
export function resumeError(file) {
  if (!file) return 'Choose a file to upload.';
  const parts = String(file.name ?? '').split('.');
  if (parts.length !== 2 || !RESUME_EXTENSIONS.includes(parts[1].toLowerCase())) return 'Only PDF, DOC or DOCX files without double extensions are accepted.';
  if (file.size > RESUME_MAX_BYTES) return 'The file is larger than 5 MB.';
  if (file.size === 0) return 'The file is empty.';
  return '';
}
export const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** The eight merge fields the backend accepts (OfferDocumentService::FIELDS); the templates endpoint returns the authoritative list. */
export const MERGE_FIELDS = ['candidate_name', 'job_title', 'start_date', 'valid_until', 'company_name', 'offer_version', 'currency', 'compensation_reference'];
/** Distinct `{{field}}` tokens that are not allowed. Mirrors the server regex. */
export function unknownMergeFields(body, allowed = MERGE_FIELDS) {
  const found = [...String(body ?? '').matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(found.filter((f) => !allowed.includes(f)))];
}
/** Tags the server sanitizer keeps; everything else is escaped to text. */
export const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'];
export function strippedTags(body) {
  const seen = [...String(body ?? '').matchAll(/<\/?\s*([a-z][a-z0-9]*)/gi)].map((m) => m[1].toLowerCase());
  return [...new Set(seen.filter((t) => !ALLOWED_TAGS.includes(t)))];
}
export const OFFER_DOC_STATUSES = ['approved', 'sent'];

/** Opens an offer letter print view. The window opens synchronously (popup blockers), then the authorized HTML is fetched with the session cookie. */
export async function openPrintView(uuid, version) {
  const win = window.open('', '_blank');
  try {
    const base = import.meta.env.VITE_API_BASE || '/api';
    const response = await fetch(`${base}${paths.offerDocumentPrint(uuid, version)}`, { credentials: 'include', headers: { Accept: 'text/html' } });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(data?.message || 'The document could not be opened.', response.status);
    }
    const url = URL.createObjectURL(new Blob([await response.text()], { type: 'text/html' }));
    if (win) {
      win.opener = null;
      win.location.href = url;
    } else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    win?.close();
    throw e;
  }
}


/* ---- Pipelines (P06-T11). Rules mirror PipelineController::rules() and PipelineService. ---- */
export const STAGE_KINDS = ['active', 'offer', 'hired', 'rejected'];
export const RECIPIENTS = ['recruiter', 'hiring_manager'];
export const blankStage = () => ({ code: '', label: '', kind: 'active', sla_hours: '', reminder_recipients: ['recruiter'] });
export const blankPipeline = () => ({
  code: '',
  name: '',
  allow_skip: false,
  feedback_reminder_hours: '',
  stages: [
    { code: 'applied', label: 'Applied', kind: 'active', sla_hours: '', reminder_recipients: ['recruiter'] },
    { code: 'offer', label: 'Offer', kind: 'offer', sla_hours: '', reminder_recipients: ['recruiter'] },
  ],
});
export const pipelineToForm = (p) => ({
  code: p.code,
  name: p.name,
  allow_skip: Boolean(p.allow_skip),
  feedback_reminder_hours: p.feedback_reminder_hours ?? '',
  stages: (p.stages ?? []).map((s) => ({ code: s.code, label: s.label, kind: s.kind, sla_hours: s.sla_hours ?? '', reminder_recipients: s.reminder_recipients ?? ['recruiter'] })),
});
const wholeIn = (v, min, max) => /^\d+$/.test(String(v)) && Number(v) >= min && Number(v) <= max;

/** Client-side check matching the API. Returns a list of messages (empty = valid). */
export function validatePipeline(f, { withCode = true } = {}) {
  const e = [];
  if (withCode && !/^[A-Z][A-Z0-9_]{0,39}$/.test(f.code ?? '')) e.push('Code must start with a capital letter and use only capital letters, digits and underscores (max 40).');
  if (!String(f.name ?? '').trim() || f.name.length > 120) e.push('Name is required (max 120 characters).');
  if (f.feedback_reminder_hours !== '' && f.feedback_reminder_hours != null && !wholeIn(f.feedback_reminder_hours, 1, 8760)) e.push('Feedback reminder hours must be a whole number from 1 to 8760.');
  const st = f.stages ?? [];
  if (st.length < 2 || st.length > 20) e.push('A pipeline needs 2 to 20 stages.');
  const seen = new Set();
  st.forEach((s, i) => {
    const n = `Stage ${i + 1}`;
    if (!/^[a-z][a-z0-9_]{0,23}$/.test(s.code ?? '')) e.push(`${n}: code must start with a lowercase letter and use only lowercase letters, digits and underscores (max 24).`);
    else if (seen.has(s.code)) e.push(`${n}: code "${s.code}" is used more than once.`);
    seen.add(s.code);
    if (!String(s.label ?? '').trim() || s.label.length > 80) e.push(`${n}: label is required (max 80 characters).`);
    if (!STAGE_KINDS.includes(s.kind)) e.push(`${n}: choose a kind.`);
    if (s.sla_hours !== '' && s.sla_hours != null) {
      if (!wholeIn(s.sla_hours, 1, 8760)) e.push(`${n}: SLA hours must be a whole number from 1 to 8760.`);
      else if (['hired', 'rejected'].includes(s.kind)) e.push(`${n}: hired and rejected stages cannot have an SLA.`);
    }
  });
  if (st.length && st[0].kind !== 'active') e.push('The first stage must be of kind active.');
  if (st.filter((s) => s.kind === 'offer').length !== 1) e.push('Exactly one stage must be of kind offer.');
  ['hired', 'rejected'].forEach((k) => {
    if (st.filter((s) => s.kind === k).length > 1) e.push(`At most one stage can be of kind ${k}.`);
  });
  const firstTerminal = st.findIndex((s) => ['hired', 'rejected'].includes(s.kind));
  if (firstTerminal >= 0 && st.slice(firstTerminal).some((s) => !['hired', 'rejected'].includes(s.kind))) e.push('Hired and rejected stages must come last.');
  return e;
}

/** API body for create / update / new version. */
export function pipelinePayload(f, { withCode = true } = {}) {
  const num = (v) => (v === '' || v == null ? undefined : Number(v));
  return clean({
    ...(withCode ? { code: f.code } : {}),
    name: f.name.trim(),
    allow_skip: Boolean(f.allow_skip),
    feedback_reminder_hours: num(f.feedback_reminder_hours),
    stages: f.stages.map((s) => clean({ code: s.code, label: s.label.trim(), kind: s.kind, sla_hours: num(s.sla_hours), reminder_recipients: s.reminder_recipients?.length ? s.reminder_recipients : undefined })),
  });
}

/** Stages for a requisition's board: its own pipeline version when the API says which, else the active version of its code, else the fixed defaults. */
export function stagesFor(req, pipelines) {
  if (Array.isArray(req?.pipeline_stages) && req.pipeline_stages.length) return req.pipeline_stages;
  const same = (pipelines ?? []).filter((p) => p.code === req?.pipeline_code);
  const pick = same.find((p) => req?.pipeline_uuid && p.uuid === req.pipeline_uuid) ?? same.find((p) => req?.pipeline_version && p.version === req.pipeline_version) ?? same.find((p) => p.status === 'active') ?? same[0];
  return pick?.stages?.length ? pick.stages : STAGES.map((code) => ({ code, label: titleCase(code), kind: code === 'offer' ? 'offer' : 'active' }));
}

/** Money string -> integer minor units, exact (no floats). */
export const cents = (v) => {
  if (v === '' || v == null) return 0;
  const [i, f = ''] = String(v).split('.');
  return Number(i || 0) * 100 + Number(`${f}00`.slice(0, 2));
};
/** True when an amendment of an open requisition needs an independent approver (mirrors RequisitionVersionService). */
export function needsReapproval(req, changes) {
  if (req?.status !== 'open') return false;
  if (changes.openings != null && Number(changes.openings) > Number(req.openings)) return true;
  const hadBudget = req.budget_amount != null && req.budget_amount !== '';
  if (changes.budget_amount != null && cents(changes.budget_amount) > cents(req.budget_amount)) return true;
  if (hadBudget && changes.budget_currency != null && changes.budget_currency.toUpperCase() !== String(req.budget_currency ?? '').toUpperCase()) return true;
  return false;
}
