import { useEffect, useState } from 'react';
import { Badge, Button, Checkbox, ErrorState, FormError, Input, Modal, PageHeader, Select, Textarea, useToast } from '../ui';
import Access from '../Access';
import { api } from '../../lib/api';
import { titleCase, useAction, listOf } from '../../lib/payrollApi';

export { ListCard, Tiles, Tile, KeyValues, Section, Pill, CountMap, ConfirmPreview, ConfirmDialog } from '../leave/hr/kit';
export { Banner, Progress, Impact } from '../timeoffice/parts';

/** Amounts arrive as decimal strings. The API sends null / "***" when the viewer may not see money. */
export const isMasked = (v) => v === null || v === undefined || v === '' || (typeof v === 'string' && /^\*+$/.test(v));

export function Amount({ value, currency, masked }) {
  if (masked || isMasked(value))
    return (
      <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-400">
        <span aria-hidden="true">••••</span>
        <span className="sr-only">Hidden: you do not have permission to view amounts</span>
      </span>
    );
  return (
    <span className="tabular-nums">
      {currency ? `${currency} ` : ''}
      {value}
    </span>
  );
}

const tones = {
  green: ['approved', 'paid', 'published', 'locked', 'ready', 'active', 'applied', 'calculated', 'verified', 'closed', 'accepted', 'resolved', 'enabled'],
  amber: ['pending', 'review', 'approval', 'warning', 'blocked', 'review_required', 'failed', 'rejected', 'reopened', 'blocking', 'critical', 'withdrawn', 'mismatch', 'held', 'excluded', 'open'],
  purple: ['processing', 'calculating', 'validating', 'inputs', 'submitted', 'queued', 'running', 'generated', 'prepared', 'draft'],
};
export function StatusBadge({ value }) {
  if (!value) return <span>—</span>;
  const key = String(value).toLowerCase();
  const tone = Object.keys(tones).find((t) => tones[t].includes(key));
  return <Badge tone={tone || 'neutral'}>{titleCase(value)}</Badge>;
}

/** Runs a mutation, toasting success or the error (403 becomes "Access restricted"). Returns the result or undefined. */
export function useDo() {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const run = async (key, fn, ok) => {
    setBusy(key);
    try {
      const r = await fn();
      if (ok) toast(ok);
      return r ?? true;
    } catch (e) {
      toast(e.status === 403 ? `Access restricted: ${e.message}` : e.message || 'Something went wrong.', 'error');
      return undefined;
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

/** Page chrome plus permission gate. */
export function Page({ permission, title, description, action, children }) {
  return (
    <Access permission={permission} module="payroll">
      <PageHeader title={title} description={description} action={action} />
      {children}
    </Access>
  );
}

/** Generic modal form. fields: [{name,label,type?,options?,required?,hint?,textarea?}]. */
export function FormModal({ open, onClose, title, intro, fields = [], initial = {}, submitLabel = 'Save', onSubmit, extra, children, success }) {
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const { busy, error, run, clear } = useAction();
  useEffect(() => {
    if (open) {
      setValues(initial);
      clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = (name, v) => setValues((x) => ({ ...x, [name]: v }));
  async function submit(e) {
    e.preventDefault();
    if (await run(() => onSubmit(values))) {
      if (success) toast(success);
      onClose();
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit}>
        {intro && <p className="mt-0 text-sm">{intro}</p>}
        <FormError error={error} />
        {fields.map((f) => {
          const required = f.required !== false && f.type !== 'checkbox';
          if (f.options)
            return <Select key={f.name} label={f.label} required={required} options={f.options} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} />;
          if (f.type === 'checkbox')
            return (
              <div key={f.name} className="mb-5">
                <Checkbox label={f.label} checked={Boolean(values[f.name])} onChange={(e) => set(f.name, e.target.checked)} />
              </div>
            );
          const Comp = f.textarea ? Textarea : Input;
          return (
            <Comp
              key={f.name}
              label={f.label}
              hint={f.hint}
              required={required}
              error={error?.errors?.[f.name]?.[0]}
              minLength={f.minLength}
              type={f.textarea ? undefined : f.type || 'text'}
              value={values[f.name] ?? ''}
              onChange={(e) => set(f.name, e.target.value)}
            />
          );
        })}
        {extra?.(values, set)}
        {children}
        <div className="mt-4 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const PURPOSES = ['payroll_processing', 'compensation_review', 'approval', 'audit', 'employee_query', 'investigation', 'other'];
/** Asks for the access purpose the API requires before revealing figures or exporting. onSubmit({purpose_code, purpose_note?}). */
export function PurposeModal({ open, onClose, title = 'Why do you need this?', onSubmit, submitLabel = 'Continue' }) {
  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={title}
      intro="Viewing or exporting payroll figures is logged with a purpose. Amounts are never written to the log."
      initial={{ purpose_code: 'payroll_processing', purpose_note: '' }}
      fields={[{ name: 'purpose_code', label: 'Purpose', options: PURPOSES.map((p) => ({ value: p, label: titleCase(p) })) }]}
      extra={(v, set) =>
        v.purpose_code === 'other' ? (
          <Textarea label="Explain the purpose (at least 10 characters)" required minLength={10} value={v.purpose_note ?? ''} onChange={(e) => set('purpose_note', e.target.value)} />
        ) : null
      }
      submitLabel={submitLabel}
      onSubmit={(v) => onSubmit({ purpose_code: v.purpose_code, ...(v.purpose_code === 'other' ? { purpose_note: v.purpose_note } : {}) })}
    />
  );
}

export const Restricted = ({ error, onRetry }) => <ErrorState error={error} onRetry={onRetry} />;

/** Loads employees for a select. Shape assumed: rows with uuid and name/full_name. */
export function useEmployees() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let live = true;
    api('/v1/payroll/employees?per_page=100')
      .then((r) => live && setRows(listOf(r)))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, []);
  return rows.map((e) => ({ value: e.uuid, label: [e.name ?? e.full_name, e.employee_number ?? e.number].filter(Boolean).join(' · ') || e.uuid }));
}
export const optionsOf = (rows, label = (r) => r.name ?? r.label ?? r.code, value = (r) => r.uuid) => rows.map((r) => ({ value: value(r), label: label(r) }));
export const withEmpty = (opts, label = 'All') => [{ value: '', label }, ...opts];
