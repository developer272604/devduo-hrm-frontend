import { useState } from 'react';
import { api, download } from '../../lib/api';
import { useResource } from '../../lib/hooks';
import { Badge, Button, FormError, Modal, Pagination, Resource, useToast } from '../ui';
import ResponsiveList from '../ResponsiveList';

const tone = { completed: 'green', partial: 'amber', failed: 'amber', rolled_back: 'neutral' };
const when = (v) => (v ? new Date(v).toLocaleString() : '—');

export default function ImportExportHistory({ canImport = true }) {
  const [page, setPage] = useState(1),
    resource = useResource(`/v1/people/imports?page=${page}`),
    toast = useToast(),
    [target, setTarget] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [blocked, setBlocked] = useState([]);

  async function rollback() {
    setBusy(true);
    setError(null);
    setBlocked([]);
    try {
      await api(`/v1/people/imports/${target.uuid}/rollback`, { method: 'POST' });
      toast('Import rolled back.');
      setTarget(null);
      resource.reload();
    } catch (e) {
      setError(e);
      // 409 rollback_blocked lists employees with later activity; nothing was changed.
      setBlocked(e.blocked || []);
    } finally {
      setBusy(false);
    }
  }
  const errorsCsv = (r) =>
    download(`/v1/people/imports/${r.uuid}/errors.csv`, 'import-errors.csv').catch((e) => toast(e.message, 'error'));
  const actions = (r) => (
    <div className="flex flex-wrap gap-2">
      {r.counts?.error > 0 && (
        <Button variant="secondary" aria-label={`Download errors for ${r.filename}`} onClick={() => errorsCsv(r)}>
          errors.csv
        </Button>
      )}
      {canImport && ['completed', 'partial'].includes(r.status) && r.counts?.imported > 0 && (
        <Button variant="secondary" aria-label={`Roll back ${r.filename}`} onClick={() => { setError(null); setBlocked([]); setTarget(r); }}>
          Roll back
        </Button>
      )}
    </div>
  );
  const result = (r) => `${r.counts?.imported ?? 0} imported · ${r.counts?.error ?? 0} errors · ${r.counts?.skipped ?? 0} skipped`;
  return (
    <>
      <div className="flex justify-end px-4 pt-4 sm:px-6">
        <Button variant="secondary" onClick={resource.reload}>Refresh</Button>
      </div>
      <Resource resource={resource}>
        {(data) => (
          <>
            <ResponsiveList
              label="Import history"
              rows={(data.data || []).map((r) => ({ ...r, id: r.uuid }))}
              columns={[
                { key: 'filename', label: 'File', priority: 'always' },
                { key: 'created_at', label: 'Started', priority: 'lg', render: (r) => when(r.created_at) },
                { key: 'status', label: 'Status', priority: 'always', render: (r) => <Badge tone={tone[r.status]}>{String(r.status).replaceAll('_', ' ')}</Badge> },
                { key: 'counts', label: 'Result', priority: 'md', render: result },
                { key: 'actions', label: 'Actions', priority: 'always', render: actions },
              ]}
              card={(r) => (
                <div className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="flex items-start justify-between gap-3">
                    <strong className="break-all text-sm">{r.filename}</strong>
                    <Badge tone={tone[r.status]}>{String(r.status).replaceAll('_', ' ')}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{result(r)}</p>
                  {r.error && <p className="text-xs text-rose-700 dark:text-rose-300">{r.error}</p>}
                  {actions(r)}
                </div>
              )}
              empty={{ title: 'No imports yet', description: 'Imports you start will be listed here with their results.' }}
            />
            <Pagination data={data} onChange={setPage} />
          </>
        )}
      </Resource>
      <Modal open={!!target} onClose={() => setTarget(null)} title="Roll back this import?">
        <FormError error={error} />
        {blocked.length > 0 && (
          <ul className="mb-4 list-disc pl-5 text-xs">
            {blocked.map((b) => (
              <li key={b.employee_uuid}>
                {b.name} ({b.employee_number}): {(b.reasons || []).join(', ')}
              </li>
            ))}
          </ul>
        )}
        <p className="mb-5 text-sm">
          This removes the employees created by {target?.filename}. It is refused if any of them has had later activity.
        </p>
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={rollback}>Roll back import</Button>
        </div>
      </Modal>
    </>
  );
}
