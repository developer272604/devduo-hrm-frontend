import { useState } from 'react';
import { Columns3, Bookmark } from 'lucide-react';
import { Button, Checkbox, ConfirmationDialog, FormError, Input, Modal, Select, useToast } from '../ui';
import { useResource } from '../../lib/hooks';
import { cleanFilters, deleteView, saveView } from '../../lib/peopleApi';

export function ColumnPicker({ columns, visible, onChange }) {
  const [open, setOpen] = useState(false);
  const toggle = (key) =>
    onChange(visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key]);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Columns3 size={16} /> Columns
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Customize columns">
        <fieldset className="space-y-3 border-0 p-0">
          <legend className="sr-only">Visible columns</legend>
          {columns.map((c) => (
            <Checkbox
              key={c.key}
              label={c.label}
              checked={visible.includes(c.key)}
              disabled={visible.length === 1 && visible.includes(c.key)}
              onChange={() => toggle(c.key)}
            />
          ))}
        </fieldset>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => setOpen(false)}>Done</Button>
        </div>
      </Modal>
    </>
  );
}

/** Saved views: apply, save the current filters/columns/sort, and delete your own. */
export function SavedViews({ filters, columns, sort, currentId, onApply, canShare }) {
  const resource = useResource('/v1/people/views');
  const toast = useToast();
  const [open, setOpen] = useState(false),
    [name, setName] = useState(''),
    [shared, setShared] = useState(false),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [toDelete, setToDelete] = useState(null);
  const views = Array.isArray(resource.data) ? resource.data : resource.data?.data || [];
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveView({ name: name.trim(), filters: cleanFilters(filters), columns, sort, shared });
      toast('View saved.');
      setOpen(false);
      setName('');
      resource.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await deleteView(toDelete.uuid);
      toast('View deleted.');
      setToDelete(null);
      resource.reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  const current = views.find((v) => v.uuid === currentId);
  return (
    <>
      {views.length > 0 && (
        <Select
          label="Saved views"
          value={currentId || ''}
          onChange={(e) => {
            const view = views.find((v) => v.uuid === e.target.value);
            if (view) onApply(view);
            else onApply(null);
          }}
          options={[
            { value: '', label: 'Default view' },
            ...views.map((v) => ({ value: v.uuid, label: v.owned === false ? `${v.name} (shared)` : v.name })),
          ]}
        />
      )}
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Bookmark size={16} /> Save view
      </Button>
      {current?.owned && (
        <Button variant="secondary" onClick={() => setToDelete(current)}>
          Delete view
        </Button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Save current view">
        <form onSubmit={save}>
          <FormError error={error} />
          <Input label="View name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          {canShare && (
            <Checkbox label="Share with everyone (read-only)" checked={shared} onChange={(e) => setShared(e.target.checked)} />
          )}
          <div className="mt-6 flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!name.trim()}>
              Save view
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmationDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        loading={busy}
        title={`Delete view "${toDelete?.name}"?`}
      />
    </>
  );
}
