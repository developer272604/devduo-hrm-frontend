import { useState } from 'react';
import { useResource } from '../../lib/hooks';
import { Badge, Button, Drawer, FormError, Pagination, Resource } from '../ui';
import ResponsiveList from '../ResponsiveList';
import { usePoll, bulkDone } from './ImportExportPoll';

const tone = { completed: 'green', partial: 'amber', failed: 'amber' };
const when = (v) => (v ? new Date(v).toLocaleString() : '—');
const label = (r) => String(r.action || r.type || 'Bulk run').replaceAll('_', ' ');

function RunDetail({ run }) {
  const { data, error } = usePoll(`/v1/people/bulk/runs/${run.uuid}`, bulkDone),
    d = data || run;
  return (
    <div className="space-y-4" aria-live="polite">
      <FormError error={error} />
      <Badge tone={tone[d.status]}>{d.status}</Badge>
      <progress className="h-3 w-full accent-brand-500" max={d.total || 1} value={(d.applied ?? 0) + (d.skipped ?? 0) + (d.failed_count ?? 0)} aria-label="Bulk run progress" />
      <p className="text-sm">
        {d.applied ?? 0} applied · {d.skipped ?? 0} skipped · {d.failed_count ?? 0} failed of {d.total ?? 0}
      </p>
      {d.failed?.length > 0 && (
        <ul className="m-0 list-disc space-y-1 pl-5 text-xs">
          {d.failed.map((f) => (
            <li key={f.uuid}>
              {f.name} ({f.employee_number}): {f.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ImportExportBulk() {
  const [page, setPage] = useState(1),
    [open, setOpen] = useState(null),
    resource = useResource(`/v1/people/bulk/runs?page=${page}`);
  const badge = (r) => <Badge tone={tone[r.status]}>{r.status}</Badge>;
  return (
    <>
      <div className="flex justify-end px-4 pt-4 sm:px-6">
        <Button variant="secondary" onClick={resource.reload}>Refresh</Button>
      </div>
      <Resource resource={resource}>
        {(data) => (
          <>
            <ResponsiveList
              label="Bulk runs"
              rows={(data.data || []).map((r) => ({ ...r, id: r.uuid }))}
              onRowClick={setOpen}
              columns={[
                { key: 'action', label: 'Action', priority: 'always', render: (r) => <span className="capitalize">{label(r)}</span> },
                { key: 'created_at', label: 'Started', priority: 'lg', render: (r) => when(r.created_at) },
                { key: 'status', label: 'Status', priority: 'always', render: badge },
                { key: 'total', label: 'Employees', priority: 'md' },
                { key: 'applied', label: 'Applied', priority: 'md' },
                { key: 'failed_count', label: 'Failed', priority: 'md' },
              ]}
              mobile={{
                title: label,
                subtitle: (r) => when(r.created_at),
                badge,
                facts: [{ label: 'Applied', value: (r) => `${r.applied ?? 0}/${r.total ?? 0}` }, { label: 'Failed', value: (r) => r.failed_count ?? 0 }],
              }}
              empty={{ title: 'No bulk runs', description: 'Bulk actions started from the directory are listed here.' }}
            />
            <Pagination data={data} onChange={setPage} />
          </>
        )}
      </Resource>
      <Drawer open={!!open} onClose={() => setOpen(null)} title="Bulk run">
        {open && <RunDetail run={open} />}
      </Drawer>
    </>
  );
}
