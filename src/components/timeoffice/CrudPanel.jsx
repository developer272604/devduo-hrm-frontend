import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Button,
  Checkbox,
  ErrorState,
  FormError,
  Input,
  Modal,
  MultiSelect,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '../ui';
import ResponsiveList from '../ResponsiveList';
import { Panel } from './parts';
import { send, useAction, useList } from '../../lib/timeOfficeApi';
import { EmployeePicker } from '../people/lookups';

const initial = (fields, row) =>
  Object.fromEntries(
    fields.map((f) => {
      const v = row?.[f.name];
      if (f.type === 'json') return [f.name, v == null ? '' : JSON.stringify(v, null, 2)];
      if (f.type === 'checkbox') return [f.name, Boolean(v ?? f.default ?? false)];
      if (f.type === 'multi') return [f.name, Array.isArray(v) ? v : (f.default ?? [])];
      return [f.name, v ?? f.default ?? ''];
    }),
  );

function toBody(fields, values) {
  const out = {};
  for (const f of fields) {
    if (f.showIf && !f.showIf(values)) continue;
    const v = values[f.name];
    if (f.type === 'json') out[f.name] = v ? JSON.parse(v) : null;
    else if (f.type === 'number') out[f.name] = v === '' ? null : Number(v);
    else if (v === '' && !f.keepEmpty) out[f.name] = null;
    else out[f.name] = v;
  }
  return out;
}

/** Form fields from a config list: text/number/date/time/textarea/select/checkbox/multi/json. */
export function FieldSet({ fields, values, setValues, errors = {} }) {
  return fields
    .filter((f) => !f.showIf || f.showIf(values))
    .map((f) => {
      const set = (v) => setValues((s) => ({ ...s, [f.name]: v }));
      const err = errors[f.name]?.join?.(' ');
      if (f.type === 'employee')
        return (
          <EmployeePicker
            key={f.name}
            label={f.label}
            value={values[f.name]}
            onChange={set}
            required={f.required}
            error={err}
          />
        );
      if (f.type === 'select')
        return (
          <Select
            key={f.name}
            label={f.label}
            options={f.options}
            value={values[f.name]}
            required={f.required}
            error={err}
            onChange={(e) => set(e.target.value)}
          />
        );
      if (f.type === 'checkbox')
        return (
          <div key={f.name} className="mb-5">
            <Checkbox
              label={f.label}
              checked={values[f.name]}
              onChange={(e) => set(e.target.checked)}
            />
          </div>
        );
      if (f.type === 'multi')
        return (
          <MultiSelect
            key={f.name}
            label={f.label}
            options={f.options}
            value={values[f.name]}
            onChange={set}
          />
        );
      if (f.type === 'textarea' || f.type === 'json')
        return (
          <Textarea
            key={f.name}
            label={f.label}
            value={values[f.name]}
            required={f.required}
            error={err}
            onChange={(e) => set(e.target.value)}
          />
        );
      return (
        <Input
          key={f.name}
          label={f.label}
          hint={f.hint}
          error={err}
          type={f.type || 'text'}
          required={f.required}
          value={values[f.name]}
          min={f.min}
          max={f.max}
          disabled={f.disabled?.(values)}
          onChange={(e) => set(e.target.value)}
        />
      );
    });
}

/** Create/edit dialog around FieldSet. Server field errors are shown inline; success closes and calls onSaved. */
export function FormDialog({
  open,
  onClose,
  title,
  fields,
  row,
  onSubmit,
  submitLabel = 'Save',
  children,
  notice,
}) {
  const [values, setValues] = useState(() => initial(fields, row));
  const { busy, error, run, clear } = useAction();
  useEffect(() => {
    if (open) {
      setValues(initial(fields, row));
      clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row]);
  async function submit(e) {
    e.preventDefault();
    let body;
    try {
      body = toBody(fields, values);
    } catch {
      return run(async () => {
        throw Object.assign(new Error('One of the JSON fields is not valid JSON.'), { errors: {} });
      });
    }
    if (await run(() => onSubmit(body, values))) onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit}>
        {notice}
        <FormError error={error} />
        <FieldSet fields={fields} values={values} setValues={setValues} errors={error?.errors} />
        {children?.(values)}
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

/**
 * Generic list + create/edit panel for configuration catalogues (shifts, work weeks, devices ...).
 * props: title, listPath, fields, columns, mobile, createPath, itemPath(row) (edit target, sent with `method`, PATCH by default), pick(response) -> rows, canEdit, empty, rowActions(row, reload)
 */
export default function CrudPanel({
  title,
  listPath,
  fields,
  columns,
  mobile,
  createPath = listPath.split('?')[0],
  itemPath,
  canEdit = true,
  noun = 'record',
  empty,
  extra,
  onSaved,
  rowActions,
  formChildren,
  toPayload,
  fromRow,
  method = 'PATCH',
  pick,
}) {
  const fetched = useList(listPath);
  const list = pick ? { ...fetched, rows: fetched.data ? pick(fetched.data) : [] } : fetched;
  const toast = useToast();
  const [editing, setEditing] = useState(null); // null | {} (new) | row
  async function save(body) {
    const editingRow = editing && Object.keys(editing).length > 0 ? editing : null;
    const payload = toPayload ? toPayload(body, editingRow) : body;
    const r = editingRow
      ? await send(method, itemPath(editingRow), payload)
      : await send('POST', createPath, payload);
    toast(editingRow ? `${noun} updated` : `${noun} created`);
    list.reload();
    onSaved?.(r);
    return r;
  }
  const cols = rowActions
    ? [
        ...columns,
        { key: '_actions', label: 'Actions', render: (row) => rowActions(row, list.reload) },
      ]
    : columns;
  return (
    <Panel
      title={title}
      action={
        canEdit && (
          <Button onClick={() => setEditing({})}>
            <Plus size={15} /> New {noun}
          </Button>
        )
      }
    >
      {extra}
      {list.loading ? (
        <Skeleton />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : (
        <ResponsiveList
          label={title}
          columns={cols}
          rows={list.rows}
          mobile={mobile}
          rowKey={(r) => r.uuid ?? r.id}
          onRowClick={canEdit && itemPath ? setEditing : undefined}
          empty={
            empty ?? {
              title: `No ${noun}s yet`,
              description: canEdit
                ? `Create the first ${noun} to get started.`
                : 'Nothing has been set up yet.',
            }
          }
        />
      )}
      <FormDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing && Object.keys(editing).length ? `Edit ${noun}` : `New ${noun}`}
        fields={fields}
        row={editing && Object.keys(editing).length ? (fromRow ? fromRow(editing) : editing) : null}
        onSubmit={save}
      >
        {formChildren}
      </FormDialog>
    </Panel>
  );
}
