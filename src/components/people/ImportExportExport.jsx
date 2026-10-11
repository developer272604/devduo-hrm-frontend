import { useState } from 'react';
import { api, download } from '../../lib/api';
import { useResource } from '../../lib/hooks';
import { Badge, Button, Checkbox, FormError, Input, Pagination, Resource, Select, useToast } from '../ui';
import ResponsiveList from '../ResponsiveList';
import { usePoll, exportDone } from './ImportExportPoll';

const tone = { completed: 'green', failed: 'amber', expired: 'neutral' };
const when = (v) => (v ? new Date(v).toLocaleString() : '—');
const list = (d) => (Array.isArray(d) ? d : d?.data || d?.columns || []);

export function ExportBuilder({ onCreated }) {
  const columns = useResource('/v1/people/exports/columns'),
    toast = useToast(),
    [format, setFormat] = useState('csv'),
    [picked, setPicked] = useState(null),
    [q, setQ] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [colError, setColError] = useState('');

  async function submit(all, selected) {
    if (!selected.length) {
      setColError('Choose at least one column.');
      return;
    }
    setColError('');
    setBusy(true);
    setError(null);
    try {
      const created = await api('/v1/people/exports', {
        method: 'POST',
        body: { format, columns: selected, ...(q.trim() ? { filters: { q: q.trim() } } : {}) },
      });
      toast('Export requested.');
      onCreated(created);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Resource resource={columns}>
      {(data) => {
        const all = list(data),
          defaults = data.defaults || all.filter((c) => c.default).map((c) => c.key),
          selected = picked ?? defaults;
        const toggle = (key, on) => setPicked(on ? [...selected, key] : selected.filter((k) => k !== key));
        return (
          <form
            noValidate
            className="space-y-5 p-4 sm:p-6"
            onSubmit={(e) => {
              e.preventDefault();
              submit(all, selected);
            }}
          >
            <FormError error={error} />
            <div className="grid gap-x-5 sm:grid-cols-2">
              <Select label="Format" value={format} onChange={(e) => setFormat(e.target.value)} options={['csv', 'xlsx']} />
              <Input label="Only people matching (name or number)" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <fieldset className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <legend className="px-1 text-xs font-semibold">Columns</legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {all.map((c) => (
                  <Checkbox
                    key={c.key}
                    label={`${c.label}${c.sensitive ? ' (sensitive)' : ''}`}
                    checked={selected.includes(c.key)}
                    onChange={(e) => toggle(c.key, e.target.checked)}
                  />
                ))}
              </div>
              {colError && <p role="alert" className="mt-3 text-xs text-rose-700 dark:text-rose-300">{colError}</p>}
            </fieldset>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Only columns you are allowed to export are listed. Identity, bank and salary data is never exported. Files expire after 24 hours.
            </p>
            <Button type="submit" loading={busy}>Create export</Button>
          </form>
        );
      }}
    </Resource>
  );
}

function ExportProgress({ uuid, onDone }) {
  const { data, error } = usePoll(`/v1/people/exports/${uuid}`, exportDone);
  const done = exportDone(data);
  return (
    <div className="mx-4 mb-4 rounded-lg border border-brand-200 p-4 text-sm dark:border-brand-800 sm:mx-6" aria-live="polite">
      <FormError error={error} />
      {!done ? 'Preparing your export…' : data.status === 'completed' ? `Export ready: ${data.row_count ?? 0} rows.` : `Export ${data.status}.`}
      {done && <Button variant="secondary" className="ml-3" onClick={onDone}>Dismiss</Button>}
    </div>
  );
}

export default function ImportExportExport() {
  const [page, setPage] = useState(1),
    [active, setActive] = useState(null),
    resource = useResource(`/v1/people/exports?page=${page}`),
    toast = useToast();
  const get = (r) =>
    download(`/v1/people/exports/${r.uuid}/download`, `employees.${r.format}`).catch((e) =>
      toast(e.status === 410 ? 'This export has expired. Create a new one.' : e.message, 'error'),
    );
  const action = (r) => r.status === 'completed' && <Button variant="secondary" aria-label={`Download export from ${when(r.created_at)}`} onClick={() => get(r)}>Download</Button>;
  return (
    <>
      <ExportBuilder
        onCreated={(c) => {
          setActive(c.uuid);
          resource.reload();
        }}
      />
      {active && <ExportProgress key={active} uuid={active} onDone={() => { setActive(null); resource.reload(); }} />}
      <h3 className="px-4 text-sm font-semibold sm:px-6">Export history</h3>
      <Resource resource={resource}>
        {(data) => (
          <>
            <ResponsiveList
              label="Export history"
              rows={(data.data || []).map((r) => ({ ...r, id: r.uuid }))}
              columns={[
                { key: 'created_at', label: 'Requested', priority: 'always', render: (r) => when(r.created_at) },
                { key: 'format', label: 'Format', priority: 'md' },
                { key: 'status', label: 'Status', priority: 'always', render: (r) => <Badge tone={tone[r.status]}>{r.status}</Badge> },
                { key: 'row_count', label: 'Rows', priority: 'md' },
                { key: 'expires_at', label: 'Expires', priority: 'lg', render: (r) => when(r.expires_at) },
                { key: 'file', label: 'File', priority: 'always', render: action },
              ]}
              mobile={{
                title: (r) => `${String(r.format).toUpperCase()} export`,
                subtitle: (r) => when(r.created_at),
                badge: (r) => <Badge tone={tone[r.status]}>{r.status}</Badge>,
                facts: [{ label: 'Rows', value: (r) => r.row_count ?? '—' }, { label: 'File', value: action }],
              }}
              empty={{ title: 'No exports yet', description: 'Exports you create are kept here until they expire.' }}
            />
            <Pagination data={data} onChange={setPage} />
          </>
        )}
      </Resource>
    </>
  );
}
