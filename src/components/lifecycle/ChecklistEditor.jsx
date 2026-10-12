import { Button, Input, Textarea, Select, Checkbox } from '../ui';
import { useList } from '../../lib/lifecycleApi';
import { useState } from 'react';

const owners = ['manager', 'hr', 'it', 'finance', 'employee', 'user'].map((value) => ({ value, label: value }));
export default function ChecklistEditor({ value, onChange }) {
  const [search, setSearch] = useState('');
  const users = useList(`/v1/lifecycle/task-owners?q=${encodeURIComponent(search)}`);
  let rows;
  try { rows = JSON.parse(value || '[]'); } catch { rows = []; }
  const update = (index, patch) => onChange(JSON.stringify(rows.map((row, i) => i === index ? { ...row, ...patch } : row)));
  const remove = (index) => onChange(JSON.stringify(rows.filter((_, i) => i !== index).map((row) => ({ ...row, depends_on: (row.depends_on ?? []).filter((n) => n !== index + 1).map((n) => n > index + 1 ? n - 1 : n) }))));
  return <section className="space-y-4">
    <Input label="Search named task owners" value={search} onChange={(e) => setSearch(e.target.value)} />
    {rows.map((row, index) => <fieldset key={index} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <legend className="px-2 font-semibold">Task {index + 1}</legend>
      <Input label="Task title" required maxLength={200} value={row.title ?? ''} onChange={(e) => update(index, { title: e.target.value })} />
      <Input label="Group" value={row.group_name ?? row.group ?? ''} onChange={(e) => update(index, { group_name: e.target.value })} />
      <Textarea label="Instructions" value={row.description ?? ''} onChange={(e) => update(index, { description: e.target.value })} />
      <Select label="Owner" options={owners} value={row.owner_type ?? 'hr'} onChange={(e) => update(index, { owner_type: e.target.value })} />
      {row.owner_type === 'user' && <Select label="Assigned user" required value={String(row.owner_user_id ?? '')} options={[{ value: '', label: users.loading ? 'Loading owners…' : 'Choose an owner' }, ...(Array.isArray(users.data) ? users.data : users.data?.data ?? []).map((user) => ({ value: String(user.id), label: user.name }))]} onChange={(e) => update(index, { owner_user_id: e.target.value ? Number(e.target.value) : null })} />}
      <Input label="Days from case date (negative means before)" type="number" min={-365} max={365} value={row.due_offset_days ?? 0} onChange={(e) => update(index, { due_offset_days: Number(e.target.value) })} />
      <Checkbox label="Mandatory" checked={Boolean(row.mandatory)} onChange={(e) => update(index, { mandatory: e.target.checked })} />
      <Input label="Remind owner this many days before due date" type="number" min={0} max={365} value={row.remind_before_days ?? 2} onChange={(e) => update(index, { remind_before_days: Number(e.target.value) })} />
      <Input label="Escalate this many days after due date" type="number" min={1} max={365} value={row.escalate_after_days ?? 1} onChange={(e) => update(index, { escalate_after_days: Number(e.target.value) })} />
      <Checkbox label="Document reference required" checked={Boolean(row.requires_document)} onChange={(e) => update(index, { requires_document: e.target.checked })} />
      <Textarea label="Acknowledgment statement (optional; only the assigned owner can acknowledge)" maxLength={5000} value={row.acknowledgment_text ?? ''} onChange={(e) => update(index, { acknowledgment_text: e.target.value || null })} />
      {index > 0 && <div className="space-y-2"><p className="text-sm">Complete these tasks first:</p>{rows.slice(0, index).map((previous, p) => <Checkbox key={p} label={`${p + 1}. ${previous.title || 'Untitled task'}`} checked={(row.depends_on ?? []).includes(p + 1)} onChange={(e) => update(index, { depends_on: e.target.checked ? [...(row.depends_on ?? []), p + 1] : (row.depends_on ?? []).filter((n) => n !== p + 1) })} />)}</div>}
      <Button variant="secondary" disabled={rows.length === 1} onClick={() => remove(index)}>Remove task {index + 1}</Button>
    </fieldset>)}
    <Button variant="secondary" disabled={rows.length >= 200} onClick={() => onChange(JSON.stringify([...rows, { title: '', owner_type: 'hr', mandatory: true, due_offset_days: 0, depends_on: [] }]))}>Add checklist task</Button>
  </section>;
}
