import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useResource } from '../lib/hooks';
import { Button, Card, Input, Select, Resource, Pagination, Modal, EmptyState } from './ui';

export function RemoteSelect({ label, path, value, onChange, display = (r) => r.name || r.title, valueKey = 'uuid', filter = () => true }) {
  const [rows, setRows] = useState([]), [page, setPage] = useState(1), [last, setLast] = useState(1), [error, setError] = useState(null), [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    api(`${path}${path.includes('?') ? '&' : '?'}page=${page}`, { signal: controller.signal }).then((result) => {
      const items = Array.isArray(result) ? result : result.data || [];
      setRows((old) => page === 1 ? items : [...old, ...items]); setLast(result.last_page || 1);
    }).catch((e) => { if (e.name !== 'AbortError') setError(e); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, page, retry]);
  return <div><Select label={label} value={value || ''} onChange={onChange} required options={[{ value: '', label: loading ? 'Loading…' : 'Choose…' }, ...rows.filter(filter).map((r) => ({ value: String(r[valueKey]), label: display(r) }))]} />
    {error && <p role="alert" className="mb-3 text-sm text-rose-600 dark:text-rose-300">{error.message} <Button type="button" variant="secondary" onClick={() => setRetry((x) => x + 1)}>Retry</Button></p>}
    {page < last && <Button type="button" variant="secondary" disabled={loading} onClick={() => setPage((p) => p + 1)}>Load more options</Button>}
  </div>;
}

export function RecordForm({ title, fields, initial = {}, onSave, onClose, submit = 'Save' }) {
  const [values, setValues] = useState(initial), [error, setError] = useState(null), [busy, setBusy] = useState(false);
  const update = (name) => (event) => setValues((v) => ({ ...v, [name]: event.target.value }));
  return <Modal open title={title} onClose={onClose}><form onSubmit={async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { await onSave(values); onClose(); } catch (e) { setError(e); } finally { setBusy(false); }
  }}>
    {error && <div role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">{Object.values(error.errors || {}).flat().join(' ') || error.message}</div>}
    <div className="grid gap-x-4 sm:grid-cols-2">{fields.map((field) => field.path ? <RemoteSelect key={field.name} {...field} value={values[field.name]} onChange={update(field.name)} /> : field.options ? <Select key={field.name} label={field.label} value={values[field.name] || ''} onChange={update(field.name)} options={field.options} required={field.required !== false} /> : <Input key={field.name} label={field.label} type={field.type || 'text'} hint={field.hint} value={values[field.name] || ''} onChange={update(field.name)} required={field.required !== false} maxLength={field.maxLength} min={field.min} step={field.step} />)}</div>
    <div className="mt-4 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : submit}</Button></div>
  </form></Modal>;
}

export function RecordPanel({ title, path, fields, initial, transform = (x) => x, canCreate, render, action }) {
  const [page, setPage] = useState(1), [creating, setCreating] = useState(false), [selected, setSelected] = useState(null);
  const resource = useResource(`${path}?page=${page}`);
  return <>
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{title}</h2>{canCreate && <Button onClick={() => setCreating(true)}>Add {title.toLowerCase()}</Button>}</div>
    <Resource resource={resource}>{() => resource.data?.data?.length ? <div className="grid gap-4 lg:grid-cols-2">{resource.data.data.map((row) => <Card key={row.uuid}><div className="space-y-3 p-5">{render(row)}{action && action(row, () => setSelected(row), resource.reload)}</div></Card>)}</div> : <EmptyState title={`No ${title.toLowerCase()} yet`} description="Records you are permitted to access will appear here." />}</Resource>
    <Pagination data={resource.data} onChange={setPage} />
    {creating && <RecordForm title={`Add ${title.toLowerCase()}`} fields={fields} initial={typeof initial === 'function' ? initial() : initial} onClose={() => setCreating(false)} onSave={async (values) => { await api(path, { method: 'POST', body: transform(values) }); resource.reload(); }} />}
    {selected && action?.dialog?.(selected, () => setSelected(null), resource.reload)}
  </>;
}

export const choices = (values) => values.map((value) => ({ value, label: value.replaceAll('_', ' ') }));
export const KeyValue = ({ label, children }) => <p className="text-sm"><span className="text-slate-500 dark:text-slate-400">{label}: </span>{children}</p>;
