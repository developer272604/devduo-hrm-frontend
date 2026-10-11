import { useState } from 'react';
import { Button, Checkbox, FormError, Input, Select, Textarea } from '../ui';
import { fieldErrors } from '../../lib/peopleApi';
import { useOptions } from './lookups';

function FieldControl({ field, value, error, onChange, id }) {
  const remote = useOptions(field.optionsPath || null);
  const common = { label: field.label, error, required: field.required, id };
  if (field.type === 'checkbox')
    return <Checkbox label={field.label} checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
  if (field.type === 'select')
    return (
      <Select
        {...common}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        options={[{ value: '', label: 'Choose…' }, ...(field.options || remote)]}
      />
    );
  if (field.type === 'textarea')
    return <Textarea {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  return (
    <Input
      {...common}
      type={field.type || 'text'}
      maxLength={field.maxLength}
      placeholder={field.placeholder}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Convert form state to an API body: drop blanks, coerce numeric selects. */
export function toBody(fields, values, { editing }) {
  const body = {};
  fields.forEach((f) => {
    if (editing && f.createOnly) return;
    const v = values[f.key];
    if (f.type === 'checkbox') body[f.key] = Boolean(v);
    else if (v !== '' && v !== undefined && v !== null) body[f.key] = f.numeric ? Number(v) : v;
    else if (editing && v === '') body[f.key] = null;
  });
  return body;
}

/** Client-side required-field check; returns {key: message}. */
export function validateRequired(fields, values, editing) {
  const errors = {};
  fields.forEach((f) => {
    if (editing && f.createOnly) return;
    if (f.required && (values[f.key] === '' || values[f.key] == null))
      errors[f.key] = `${f.label} is required.`;
  });
  return errors;
}

/**
 * Generic field form. `onSubmit(body)` should throw an ApiError to surface server validation inline.
 */
export default function RecordForm({ fields, initial = {}, editing, onSubmit, onCancel, submitLabel = 'Save' }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.key, initial[f.key] ?? (f.type === 'checkbox' ? false : '')])),
  );
  const [errors, setErrors] = useState({}),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const local = validateRequired(fields, values, editing);
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(toBody(fields, values, { editing }));
    } catch (e) {
      setError(e);
      setErrors(fieldErrors(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} noValidate>
      <FormError error={error} />
      <div className="grid gap-x-4 sm:grid-cols-2">
        {fields
          .filter((f) => !(editing && f.createOnly))
          .map((f) => (
            <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
              <FieldControl
                field={f}
                value={values[f.key]}
                error={errors[f.key]}
                onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
              />
            </div>
          ))}
      </div>
      <div className="mt-4 flex justify-end gap-2.5">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
