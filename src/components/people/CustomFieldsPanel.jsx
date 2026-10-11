import { useState } from 'react';
import { api } from '../../lib/api';
import { useResource } from '../../lib/hooks';
import { fieldErrors } from '../../lib/peopleApi';
import { Button, Checkbox, EmptyState, FormError, Input, Resource, Select, useToast } from '../ui';

function Editor({ field, value, error, onChange }) {
  const common = { label: field.label, error, required: field.required, hint: field.description };
  if (field.type === 'boolean')
    return <Checkbox label={field.label} checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
  if (field.type === 'single_select')
    return (
      <Select
        {...common}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        options={[{ value: '', label: 'Choose…' }, ...(field.options || []).map((o) => ({ value: o.value, label: o.label }))]}
      />
    );
  const type = { date: 'date', number: 'number', currency: 'number', email: 'email', url: 'url', phone: 'tel' }[field.type] || 'text';
  return <Input {...common} type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
}

export default function CustomFieldsPanel({ uuid }) {
  const toast = useToast();
  const resource = useResource(`/v1/employees/${uuid}/custom-fields`);
  const [values, setValues] = useState(null), // null = read mode
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/employees/${uuid}/custom-fields`, { method: 'PUT', body: { values } });
      toast('Custom fields saved.');
      setValues(null);
      resource.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const errs = fieldErrors(error);
  return (
    <Resource resource={resource}>
      {(data) => {
        const sections = data.sections || [];
        const editable = sections.flatMap((s) => s.fields.filter((f) => f.editable));
        return (
          <section aria-label="Custom fields" className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="m-0 text-sm">Custom fields</h2>
              {editable.length > 0 && values === null && (
                <Button
                  variant="secondary"
                  onClick={() => setValues(Object.fromEntries(editable.map((f) => [f.key, f.value ?? ''])))}
                >
                  Edit
                </Button>
              )}
            </div>
            {sections.length === 0 ? (
              <EmptyState title="No custom fields" description="No additional fields apply to this profile." />
            ) : values === null ? (
              sections.map((s) => (
                <div key={s.key} className="mb-6">
                  <h3 className="mb-2 text-xs text-slate-500 dark:text-slate-400">{s.label}</h3>
                  <dl className="m-0 grid gap-4 sm:grid-cols-2">
                    {s.fields.map((f) => (
                      <div key={f.key}>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">{f.label}</dt>
                        <dd className="m-0 mt-1 wrap-break-word text-sm">{f.masked ? '••••' : (f.display ?? f.value ?? '—') || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))
            ) : (
              <form onSubmit={save}>
                <FormError error={error} />
                <div className="grid gap-x-4 sm:grid-cols-2">
                  {editable.map((f) => (
                    <Editor
                      key={f.key}
                      field={f}
                      value={values[f.key]}
                      error={errs[`values.${f.key}`]}
                      onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                    />
                  ))}
                </div>
                <div className="flex justify-end gap-2.5">
                  <Button variant="secondary" onClick={() => setValues(null)}>Cancel</Button>
                  <Button type="submit" loading={busy}>Save</Button>
                </div>
              </form>
            )}
          </section>
        );
      }}
    </Resource>
  );
}
