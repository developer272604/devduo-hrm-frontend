import { useState } from 'react';
import { api } from '../../lib/api';
import { useResource, useDebounced } from '../../lib/hooks';
import { Button, Checkbox, FormError, Input, Resource, Select, useToast } from '../ui';

const label = (key) => String(key).replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
const grid = 'grid gap-x-5 sm:grid-cols-2';
const muted = 'text-xs text-slate-500 dark:text-slate-400';

/* ---------- validation (pure, unit tested) ---------- */

export function validateNumberingPattern(pattern) {
  if (!pattern || !pattern.trim()) return 'Enter a number pattern.';
  if (pattern.length > 60) return 'The pattern can be at most 60 characters.';
  const seq = pattern.match(/\{SEQ(?::\d+)?\}/g) || [];
  if (seq.length !== 1) return 'The pattern needs exactly one {SEQ} or {SEQ:n} token.';
  const rest = pattern.replace(/\{(SEQ(:\d+)?|LE|LOC|TYPE|COUNTRY|YYYY|YY)\}/g, '');
  if (/[{}]/.test(rest)) return 'The pattern contains an unknown token.';
  if (!/^[A-Za-z0-9\-_/. ]*$/.test(rest))
    return 'Fixed text may only use letters, numbers, spaces and - _ / .';
  return '';
}

const intInRange = (value, min, max, name) => {
  if (value === '' || value === null || value === undefined) return '';
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? '' : `${name} must be a whole number from ${min} to ${max}.`;
};

export function validateGeneral(v) {
  const e = {};
  if (v.default_country && !/^[A-Za-z]{2}$/.test(v.default_country)) e.default_country = 'Use a 2-letter country code, for example IN.';
  const p = intInRange(v.probation_days, 0, 730, 'Probation days');
  if (p) e.probation_days = p;
  const d = intInRange(v.document_expiry_days, 1, 365, 'The reminder window');
  if (d) e.document_expiry_days = d;
  return e;
}

export function validateNumbering(v) {
  const e = {},
    pattern = validateNumberingPattern(v.pattern);
  if (pattern) e.pattern = pattern;
  if (!Number.isInteger(Number(v.start)) || Number(v.start) < 1) e.start = 'The starting number must be 1 or more.';
  return e;
}

/** Sensitive widenings must be explicitly confirmed. */
export function needsSensitiveConfirm(section, before, after) {
  if (section === 'edit_rules')
    return ['bank', 'identity'].some((g) => after[g] === 'direct' && before[g] !== 'direct');
  if (section === 'directory_privacy')
    return ['personal_phone', 'date_of_birth'].some((k) => after[k] && !before[k]);
  return false;
}

/* ---------- shared save plumbing ---------- */

function useSave(section, reload) {
  const toast = useToast(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  async function save(body) {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/people/settings/${section}`, { method: 'PUT', body });
      reload();
      toast('People settings saved.');
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { save, busy, error, setError };
}

const Footer = ({ busy }) => (
  <Button type="submit" loading={busy}>
    Save settings
  </Button>
);

/* ---------- forms ---------- */

export function GeneralForm({ data, reload }) {
  const { save, busy, error } = useSave('general', reload),
    [v, setV] = useState({
      default_country: data.default_country || '',
      probation_days: data.probation_days ?? '',
      document_expiry_days: data.document_expiry_days ?? '',
    }),
    [errors, setErrors] = useState({}),
    set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    const found = validateGeneral(v);
    setErrors(found);
    if (Object.keys(found).length) return;
    save({
      default_country: v.default_country ? v.default_country.toUpperCase() : null,
      probation_days: v.probation_days === '' ? null : Number(v.probation_days),
      document_expiry_days: v.document_expiry_days === '' ? null : Number(v.document_expiry_days),
    });
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4 p-4 sm:p-6">
      <FormError error={error} />
      <div className={grid}>
        <Input label="Default country code" value={v.default_country} onChange={set('default_country')} maxLength={2} error={errors.default_country} />
        <Input label="Default probation days" type="number" value={v.probation_days} onChange={set('probation_days')} error={errors.probation_days} />
        <Input label="Document expiry reminder window (days)" type="number" value={v.document_expiry_days} onChange={set('document_expiry_days')} error={errors.document_expiry_days} />
      </div>
      <Footer busy={busy} />
    </form>
  );
}

function NumberingPreview({ pattern, start }) {
  const resource = useResource(
    `/v1/people/settings/preview-numbering?pattern=${encodeURIComponent(pattern)}&start=${encodeURIComponent(start)}&count=3`,
  );
  return (
    <div className="mb-5 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-950" aria-live="polite">
      <strong>Preview</strong>
      {resource.loading ? (
        <p className={muted}>Calculating…</p>
      ) : resource.error ? (
        <p className="text-rose-700 dark:text-rose-300">{resource.error.errors?.pattern?.join(' ') || resource.error.message}</p>
      ) : (
        <p>{(resource.data.samples || []).join(' · ') || 'No samples'}</p>
      )}
    </div>
  );
}

export function NumberingForm({ data, reload }) {
  const n = data.numbering || {},
    { save, busy, error } = useSave('numbering', reload),
    [v, setV] = useState({ mode: n.mode || 'auto', pattern: n.pattern || '', scope: n.scope || 'tenant', start: n.start ?? 1 }),
    [errors, setErrors] = useState({}),
    pattern = useDebounced(v.pattern, 400),
    start = useDebounced(v.start, 400),
    liveError = validateNumberingPattern(pattern);
  const submit = (e) => {
    e.preventDefault();
    const found = validateNumbering(v);
    setErrors(found);
    if (Object.keys(found).length) return;
    save({ ...v, start: Number(v.start) });
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4 p-4 sm:p-6">
      <FormError error={error} />
      <div className={grid}>
        <Select label="Numbering mode" value={v.mode} onChange={(e) => setV({ ...v, mode: e.target.value })} options={[{ value: 'auto', label: 'Automatic' }, { value: 'manual', label: 'Manual' }]} />
        <Input label="Number pattern" value={v.pattern} onChange={(e) => setV({ ...v, pattern: e.target.value })} error={errors.pattern} hint="Example: EMP-{SEQ:4}" />
        <Select label="Sequence scope" value={v.scope} onChange={(e) => setV({ ...v, scope: e.target.value })} options={data.catalogue?.numbering_scopes || ['tenant']} />
        <Input label="Starting number" type="number" min="1" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} error={errors.start} />
      </div>
      <p className={muted}>
        Tokens: {(data.catalogue?.numbering_tokens || []).map((t) => t.token || t).join(' · ')}. Existing employee numbers stay unchanged.
      </p>
      {!liveError && Number(start) >= 1 && <NumberingPreview pattern={pattern} start={start} />}
      <Footer busy={busy} />
    </form>
  );
}

export function EditRulesForm({ data, reload }) {
  const { save, busy, error } = useSave('edit_rules', reload),
    [rules, setRules] = useState(data.edit_rules || {}),
    [confirm, setConfirm] = useState(false),
    [problem, setProblem] = useState('');
  const sensitive = needsSensitiveConfirm('edit_rules', data.edit_rules || {}, rules);
  const submit = (e) => {
    e.preventDefault();
    if (sensitive && !confirm) {
      setProblem('Confirm the increased risk of direct edits to bank or identity information.');
      return;
    }
    setProblem('');
    save({ rules, confirm_sensitive: confirm });
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4 p-4 sm:p-6">
      <FormError error={error} />
      <p className={muted}>Decide whether employees edit each group of fields themselves, request approval, or cannot edit.</p>
      <div className={grid}>
        {(data.catalogue?.field_groups || []).map((g) => (
          <Select
            key={g.key}
            label={label(g.key)}
            value={rules[g.key] || g.default}
            onChange={(e) => setRules({ ...rules, [g.key]: e.target.value })}
            options={[
              ...(!g.never_direct ? [{ value: 'direct', label: 'Employee may edit directly' }] : []),
              { value: 'request', label: 'Employee must request approval' },
              { value: 'none', label: 'Read only' },
            ]}
          />
        ))}
      </div>
      {sensitive && <Checkbox label="I confirm allowing direct edits to bank or identity information." checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />}
      {problem && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{problem}</p>}
      <Footer busy={busy} />
    </form>
  );
}

export function PrivacyForm({ data, reload }) {
  const { save, busy, error } = useSave('directory_privacy', reload),
    [privacy, setPrivacy] = useState(data.directory_privacy || {}),
    [confirm, setConfirm] = useState(false),
    [problem, setProblem] = useState('');
  const sensitive = needsSensitiveConfirm('directory_privacy', data.directory_privacy || {}, privacy);
  const submit = (e) => {
    e.preventDefault();
    if (sensitive && !confirm) {
      setProblem('Confirm the increased visibility of personal phone numbers or birthdays.');
      return;
    }
    setProblem('');
    save({ privacy, confirm_sensitive: confirm });
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4 p-4 sm:p-6">
      <FormError error={error} />
      <p className={muted}>Select the fields coworkers can see in the company directory.</p>
      <div className={grid}>
        {(data.catalogue?.privacy_keys || []).map((f) => (
          <Checkbox key={f.key || f} label={label(f.key || f)} checked={!!privacy[f.key || f]} onChange={(e) => setPrivacy({ ...privacy, [f.key || f]: e.target.checked })} />
        ))}
      </div>
      {sensitive && <Checkbox label="I confirm the increased visibility of personal phone numbers or birthdays." checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />}
      {problem && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{problem}</p>}
      <Footer busy={busy} />
    </form>
  );
}

export function ClassificationForm({ data, reload }) {
  const { save, busy, error } = useSave('field_policies', reload),
    fields = data.catalogue?.fields || [],
    [policies, setPolicies] = useState({});
  const current = (f) => policies[f.key] ?? f.classification ?? f.default_classification;
  const changed = Object.entries(policies).filter(([k, v]) => v !== (fields.find((f) => f.key === k)?.classification));
  const submit = (e) => {
    e.preventDefault();
    if (!changed.length) return;
    const body = Object.fromEntries(
      changed.map(([k, v]) => [k, v === fields.find((f) => f.key === k)?.default_classification ? null : v]),
    );
    save({ policies: body }).then((ok) => ok && setPolicies({}));
  };
  const classes = data.catalogue?.classifications || [];
  return (
    <form onSubmit={submit} noValidate className="space-y-4 p-4 sm:p-6">
      <FormError error={error} />
      <p className={muted}>Classification controls who can view each field. Highly sensitive fields cannot be lowered below HR confidential.</p>
      <div className={grid}>
        {fields.map((f) => {
          const allowed = f.allowed_classifications?.length ? f.allowed_classifications : classes.map((c) => c.value);
          return (
            <Select
              key={f.key}
              label={label(f.key.replace('.', ' · '))}
              value={current(f)}
              onChange={(e) => setPolicies({ ...policies, [f.key]: e.target.value })}
              options={classes.filter((c) => allowed.includes(c.value)).map((c) => ({ value: c.value, label: c.label }))}
            />
          );
        })}
      </div>
      <Button type="submit" loading={busy} disabled={!changed.length}>
        Save {changed.length ? `${changed.length} change${changed.length === 1 ? '' : 's'}` : 'classification'}
      </Button>
    </form>
  );
}

export function CompletenessForm({ data, reload }) {
  const { save, busy, error } = useSave('completeness', reload),
    [required, setRequired] = useState(data.completeness?.required || []);
  return (
    <form
      noValidate
      className="space-y-4 p-4 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        save({ required });
      }}
    >
      <FormError error={error} />
      <p className={muted}>These items determine whether a profile counts as complete.</p>
      <div className={grid}>
        {(data.catalogue?.completeness_rules || []).map((rule) => (
          <div key={rule.key} className="mb-3">
            <Checkbox label={rule.label} checked={required.includes(rule.key)} onChange={(e) => setRequired(e.target.checked ? [...required, rule.key] : required.filter((k) => k !== rule.key))} />
            <p className={`mt-1 ${muted}`}>{rule.description}</p>
          </div>
        ))}
      </div>
      <Footer busy={busy} />
    </form>
  );
}

export const SETTINGS_FORMS = {
  general: GeneralForm,
  numbering: NumberingForm,
  edit_rules: EditRulesForm,
  directory_privacy: PrivacyForm,
  field_policies: ClassificationForm,
  completeness: CompletenessForm,
};

export function SettingsSection({ section }) {
  const resource = useResource('/v1/people/settings'),
    Form = SETTINGS_FORMS[section];
  return <Resource resource={resource}>{(data) => <Form key={section} data={data} reload={resource.reload} />}</Resource>;
}
