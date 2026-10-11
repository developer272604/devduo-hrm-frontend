import { useState } from 'react';
import { api } from '../../lib/api';
import { useResource } from '../../lib/hooks';
import {
  Badge,
  Button,
  Checkbox,
  FormError,
  Input,
  Modal,
  Pagination,
  Resource,
  Select,
  Textarea,
  useToast,
} from '../ui';
import ResponsiveList from '../ResponsiveList';

/** Validates a field spec list against values. Returns {name: message}. */
export function validateFields(fields, values) {
  const errors = {};
  for (const f of fields) {
    const v = values[f.name];
    const empty = v === undefined || v === null || String(v).trim() === '';
    if (f.type === 'checkbox') continue;
    if (f.required && empty) errors[f.name] = `${f.label} is required.`;
    else if (!empty) {
      if (f.maxLength && String(v).length > f.maxLength)
        errors[f.name] = `${f.label} can be at most ${f.maxLength} characters.`;
      else if (f.pattern && !f.pattern.test(String(v)))
        errors[f.name] = f.patternMessage || `${f.label} is not valid.`;
      else if (f.type === 'number' && !Number.isFinite(Number(v)))
        errors[f.name] = `${f.label} must be a number.`;
      else if (f.type === 'number' && f.min !== undefined && Number(v) < f.min)
        errors[f.name] = `${f.label} must be at least ${f.min}.`;
    }
  }
  return errors;
}

const unwrap = (d) => (Array.isArray(d) ? d : d?.data || []);

function EditDialog({ spec, row, onClose, onSaved }) {
  const creating = !row,
    fields = spec.fields.filter((f) => creating || !f.createOnly || f.type === 'readonly'),
    toast = useToast(),
    [values, setValues] = useState(() =>
      Object.fromEntries(
        spec.fields.map((f) => [
          f.name,
          row
            ? ((spec.read ? spec.read(row, f.name) : row[f.name]) ??
              (f.type === 'checkbox' ? false : ''))
            : (f.default ?? (f.type === 'checkbox' ? false : '')),
        ]),
      ),
    ),
    [errors, setErrors] = useState({}),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const found = validateFields(fields, values);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setError(null);
    try {
      const body = Object.fromEntries(
        fields.map((f) => [
          f.name,
          f.type === 'number'
            ? values[f.name] === ''
              ? null
              : Number(values[f.name])
            : f.type === 'checkbox'
              ? !!values[f.name]
              : values[f.name] === ''
                ? null
                : values[f.name],
        ]),
      );
      await api(creating ? spec.createPath : spec.updatePath(row), {
        method: creating ? 'POST' : spec.updateMethod || 'PUT',
        body: spec.toBody ? spec.toBody(body, row) : body,
      });
      toast(`${spec.noun} saved.`);
      onSaved();
    } catch (e) {
      setError(e);
      setErrors(
        Object.fromEntries(Object.entries(e.errors || {}).map(([k, v]) => [k, v.join(' ')])),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={`${creating ? 'Add' : 'Edit'} ${spec.noun.toLowerCase()}`}>
      <form onSubmit={submit} noValidate>
        <FormError error={error} />
        {fields.map((f) => {
          const common = { label: f.label, error: errors[f.name], hint: f.hint },
            set = (e) => setValues({ ...values, [f.name]: e.target.value });
          if (f.type === 'checkbox')
            return (
              <div key={f.name} className="mb-5">
                <Checkbox
                  label={f.label}
                  checked={!!values[f.name]}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })}
                />
              </div>
            );
          if (f.type === 'select')
            return (
              <Select
                key={f.name}
                label={f.label}
                error={errors[f.name]}
                value={values[f.name]}
                onChange={set}
                options={f.options}
              />
            );
          if (f.type === 'textarea')
            return <Textarea key={f.name} {...common} value={values[f.name]} onChange={set} />;
          return (
            <Input
              key={f.name}
              {...common}
              type={f.type === 'number' ? 'number' : 'text'}
              value={values[f.name]}
              onChange={set}
              maxLength={f.maxLength}
            />
          );
        })}
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Generic list + create/edit/delete panel for the simple admin catalogues.
 * spec: { noun, listPath, columns:[{key,label,render?}], fields, createPath?, updatePath(row)?, deletePath(row)?,
 *         canDelete?(row), rowKey?(row), deleteLabel?, paged? }
 */
export default function PeopleSettingsCrud({ spec }) {
  const [page, setPage] = useState(1),
    [edit, setEdit] = useState(null),
    [removing, setRemoving] = useState(null),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    toast = useToast(),
    path = spec.paged
      ? `${spec.listPath}${spec.listPath.includes('?') ? '&' : '?'}page=${page}`
      : spec.listPath,
    resource = useResource(path),
    rowKey = spec.rowKey || ((r) => r.id ?? r.uuid ?? r.code);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api(spec.deletePath(removing), { method: 'DELETE' });
      toast(`${spec.noun} ${spec.deleteLabel || 'deleted'}.`);
      setRemoving(null);
      resource.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const rowActions = (r) => (
    <div className="flex flex-wrap gap-2">
      {spec.extraActions?.(r)}
      {spec.updatePath && (
        <Button
          variant="secondary"
          aria-label={`Edit ${r.label || r.name || r.code || ''}`}
          onClick={() => setEdit({ row: r })}
        >
          Edit
        </Button>
      )}
      {spec.deletePath && (spec.canDelete ? spec.canDelete(r) : true) && (
        <Button
          variant="secondary"
          aria-label={`${spec.deleteLabel === 'reset' ? 'Reset' : 'Delete'} ${r.label || r.name || r.code || ''}`}
          onClick={() => {
            setError(null);
            setRemoving(r);
          }}
        >
          {spec.deleteLabel === 'reset' ? 'Reset' : 'Delete'}
        </Button>
      )}
    </div>
  );
  const columns = [
    ...spec.columns.map((c, i) => ({ priority: i < 2 ? 'always' : 'md', ...c })),
    { key: '_actions', label: 'Actions', priority: 'always', render: rowActions },
  ];
  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {spec.intro && (
          <p className="m-0 max-w-xl text-xs text-slate-500 dark:text-slate-400">{spec.intro}</p>
        )}
        {spec.createPath && (
          <Button onClick={() => setEdit({ row: null })}>Add {spec.noun.toLowerCase()}</Button>
        )}
      </div>
      <Resource resource={resource}>
        {(data) => {
          const rows = unwrap(data).map((r) => ({ ...r, id: rowKey(r) }));
          return (
            <>
              <ResponsiveList
                label={spec.noun}
                rows={rows}
                rowKey={(r) => r.id}
                columns={columns}
                mobile={{
                  title: spec.columns[0].render
                    ? (r) => spec.columns[0].render(r)
                    : spec.columns[0].key,
                  subtitle: spec.columns[1]
                    ? spec.columns[1].render || spec.columns[1].key
                    : undefined,
                  facts: spec.columns
                    .slice(2, 5)
                    .map((c) => ({ label: c.label, value: c.render || c.key })),
                }}
                card={(r) => (
                  <div className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    {spec.columns.map((c) => (
                      <div key={c.key} className="flex justify-between gap-3 text-xs">
                        <span className="text-slate-500 dark:text-slate-400">{c.label}</span>
                        <span className="text-right">
                          {c.render ? c.render(r) : String(r[c.key] ?? '—')}
                        </span>
                      </div>
                    ))}
                    {rowActions(r)}
                  </div>
                )}
                empty={{
                  title: `No ${spec.noun.toLowerCase()} entries`,
                  description: spec.createPath
                    ? 'Add the first entry to get started.'
                    : 'Nothing is configured yet.',
                }}
              />
              {spec.paged && <Pagination data={data} onChange={setPage} />}
            </>
          );
        }}
      </Resource>
      {edit && (
        <EditDialog
          spec={spec}
          row={edit.row}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            resource.reload();
          }}
        />
      )}
      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`${spec.deleteLabel === 'reset' ? 'Reset' : 'Delete'} ${spec.noun.toLowerCase()}?`}
      >
        <FormError error={error} />
        <p className="mb-5 text-sm">
          {spec.deleteLabel === 'reset'
            ? 'The built-in defaults will be used again.'
            : 'This cannot be undone. Entries that are in use must be deactivated instead.'}
        </p>
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={() => setRemoving(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} onClick={remove}>
            {spec.deleteLabel === 'reset' ? 'Reset' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export const activeBadge = (r) => (
  <Badge tone={r.active === false ? 'neutral' : 'green'}>
    {r.active === false ? 'Inactive' : 'Active'}
  </Badge>
);
