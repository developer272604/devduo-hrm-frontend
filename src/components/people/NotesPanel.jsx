import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { useResource } from '../../lib/hooks';
import { label } from '../../lib/peopleApi';
import { Badge, Button, EmptyState, FormError, Resource, Select, Textarea, useToast } from '../ui';

export default function NotesPanel({ uuid }) {
  const { can } = useAuth(),
    toast = useToast();
  const resource = useResource(`/v1/employees/${uuid}/notes`);
  const [body, setBody] = useState(''),
    [visibility, setVisibility] = useState(''),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function add(levels) {
    const level = visibility || levels[0];
    if (!body.trim()) {
      setError({ message: 'Write a note first.', errors: {} });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/employees/${uuid}/notes`, { method: 'POST', body: { body: body.trim(), visibility: level } });
      setBody('');
      toast('Note added.');
      resource.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function remove(note) {
    try {
      await api(`/v1/employees/${uuid}/notes/${note.uuid}`, { method: 'DELETE' });
      toast('Note deleted.');
      resource.reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  }
  return (
    <Resource resource={resource}>
      {(data) => {
        const levels = data.viewer?.creatable_visibilities || [];
        const canWrite = can('people.notes.manage') && levels.length > 0;
        return (
          <section aria-label="Notes" className="p-5">
            <h2 className="mb-4 mt-0 text-sm">Notes</h2>
            {canWrite && (
              <form
                className="mb-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  add(levels);
                }}
              >
                <FormError error={error} />
                <Textarea label="Add a note" value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} />
                <div className="flex flex-wrap items-end gap-3">
                  <Select
                    label="Who can read it"
                    value={visibility || levels[0]}
                    onChange={(e) => setVisibility(e.target.value)}
                    options={levels.map((value) => ({ value, label: label(value) }))}
                  />
                  <Button type="submit" className="mb-5" loading={busy}>Add note</Button>
                </div>
              </form>
            )}
            {(data.data || []).length === 0 ? (
              <EmptyState title="No notes" description="Notes you are allowed to read appear here." />
            ) : (
              <ul className="m-0 list-none space-y-4 p-0">
                {data.data.map((n) => (
                  <li key={n.uuid} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        {n.author?.name} · {n.created_at?.slice(0, 10)} <Badge>{label(n.visibility)}</Badge>
                      </span>
                      {n.is_mine && can('people.notes.manage') && (
                        <Button variant="ghost" aria-label="Delete note" onClick={() => remove(n)}>
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </div>
                    <p className="m-0 whitespace-pre-wrap wrap-break-word text-sm">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      }}
    </Resource>
  );
}
