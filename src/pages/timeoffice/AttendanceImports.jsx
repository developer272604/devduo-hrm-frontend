import { useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button, Card, ErrorState, FormError, Modal, Select, Skeleton, useToast } from '../../components/ui';
import ResponsiveList from '../../components/ResponsiveList';
import { Banner, PartialFailure, Panel, ProcessingBanner, Progress, Screen, StatusBadge, guarded } from '../../components/timeoffice/parts';
import { PreviewConfirm } from '../../components/timeoffice/dialogs';
import { useAuth } from '../../lib/auth';
import { api, download } from '../../lib/api';
import { listOf, paths, send, titleCase, toOptions, unwrap, useAction, useList, useLookup } from '../../lib/timeOfficeApi';

const FIELDS = ['employee_number', 'work_email', 'device_employee_id', 'timestamp', 'date', 'time', 'direction', 'external_ref', 'device', 'location', 'timezone'];
const BUSY = ['queued', 'importing', 'validating'];

function UploadDialog({ open, onClose, onUploaded }) {
  const devices = useLookup(paths.devices);
  const [kind, setKind] = useState('punches');
  const [device, setDevice] = useState('');
  const file = useRef(null);
  const { busy, error, run } = useAction();
  return (
    <Modal open={open} onClose={onClose} title="Upload punches">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = file.current?.files?.[0];
          if (!f) return;
          const body = new FormData();
          body.append('file', f);
          body.append('kind', kind);
          if (device) body.append('device_id', device);
          const r = await run(() => send('POST', paths.imports, body));
          if (r) {
            onUploaded(r);
            onClose();
          }
        }}
      >
        <FormError error={error} />
        <div className="mb-5">
          <label htmlFor="import-file" className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">File (CSV or XLSX, up to 10 MB)</label>
          <input id="import-file" ref={file} type="file" required accept=".csv,.xlsx" className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" />
        </div>
        <Select label="Kind" value={kind} options={[{ value: 'punches', label: 'Punches (one row per punch)' }, { value: 'device_events', label: 'Raw device events' }]} onChange={(e) => setKind(e.target.value)} />
        <Select label="Device (optional)" value={device} options={devices.length ? toOptions(devices.map((d) => ({ id: d.id, name: d.name })), 'None') : [{ value: '', label: 'None' }]} onChange={(e) => setDevice(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Upload and preview</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Review one import: map columns, validate, inspect problem rows, then commit. */
function ImportDetail({ id, preview, onClose, onChanged }) {
  const toast = useToast();
  const [imp, setImp] = useState(null);
  const [error, setError] = useState(null);
  const [mapping, setMapping] = useState(preview?.suggested_mapping ?? {});
  const [commit, setCommit] = useState(false);
  const [rows, setRows] = useState(null);
  const act = useAction();
  const load = () =>
    api(`${paths.imports}/${id}`)
      .then((r) => setImp(unwrap(r)))
      .catch(setError);
  useEffect(() => {
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!imp || !BUSY.includes(imp.status)) return;
    const t = setTimeout(load, 3000);
    return () => clearTimeout(t);
  }, [imp]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (imp && imp.counts?.errors > 0 && !BUSY.includes(imp.status)) api(`${paths.imports}/${id}/rows?status=error`).then((r) => setRows(listOf(r))).catch(() => setRows([]));
  }, [imp?.status, imp?.counts?.errors]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = imp?.counts ?? {};
  const ready = (counts.valid ?? 0) + (counts.warnings ?? 0);
  const busy = imp && BUSY.includes(imp.status);
  const columns = preview?.columns ?? [];
  return (
    <Modal open onClose={() => { onChanged(); onClose(); }} title={imp?.filename ?? 'Import'}>
      {error && <ErrorState error={error} onRetry={load} />}
      {!imp && !error && <Skeleton rows={2} />}
      {imp && (
        <div className="space-y-4 text-xs">
          {busy && <ProcessingBanner>{titleCase(imp.status)}. You can close this window; progress continues in the background.</ProcessingBanner>}
          <Progress value={imp.progress_percent ?? 0} max={100} label="Import progress" />
          <dl className="m-0 grid grid-cols-3 gap-2">
            {[['Rows', counts.total], ['Ready', ready], ['Errors', counts.errors], ['Imported', counts.imported], ['Duplicates', counts.duplicates], ['Status', titleCase(imp.status)]].map(([k, v]) => (
              <div key={k}><dt className="text-slate-500">{k}</dt><dd className="m-0 font-semibold">{v ?? 0}</dd></div>
            ))}
          </dl>
          {imp.message && <Banner tone={counts.errors ? 'warn' : 'info'}>{imp.message}</Banner>}
          {counts.errors > 0 && counts.imported > 0 && <PartialFailure failed={counts.errors} total={counts.total} />}
          <FormError error={act.error} />
          {columns.length > 0 && imp.status === 'uploaded' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act.run(() => send('PUT', `${paths.imports}/${id}/mapping`, { mapping, validate: true }))) {
                  toast('Mapping saved. Validating rows.');
                  load();
                }
              }}
            >
              <h3 className="mb-2 text-sm">Match your columns</h3>
              <div className="grid gap-x-4 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <Select key={f} label={titleCase(f)} value={mapping[f] ?? ''} options={[{ value: '', label: 'Not in file' }, ...columns.map((c) => ({ value: c.key, label: c.label }))]} onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value }))} />
                ))}
              </div>
              <Button type="submit" loading={act.busy}>Save mapping and validate</Button>
            </form>
          )}
          {rows?.length > 0 && (
            <ResponsiveList
              label="Rows with errors"
              rows={rows}
              rowKey={(r) => r.row}
              columns={[{ key: 'row', label: 'Row' }, { key: 'errors', label: 'Problem', render: (r) => (r.errors ?? []).map((x) => (typeof x === 'string' ? x : (x.message ?? JSON.stringify(x)))).join('; ') }]}
              mobile={{ title: (r) => `Row ${r.row}`, subtitle: (r) => (r.errors ?? []).map((x) => (typeof x === 'string' ? x : x.message)).join('; ') }}
            />
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {counts.errors > 0 && <Button variant="secondary" onClick={() => download(`${paths.imports}/${id}/errors.csv`, 'import-errors.csv').catch((e) => toast(e.message, 'error'))}><Download size={14} /> Error file</Button>}
            {['completed_with_errors', 'failed'].includes(imp.status) && (
              <Button variant="secondary" loading={act.busy} onClick={async () => (await act.run(() => send('POST', `${paths.imports}/${id}/retry`))) && (toast('Retrying failed rows'), load())}>Retry failed rows</Button>
            )}
            {['validated', 'completed_with_errors', 'failed'].includes(imp.status) && ready > 0 && <Button onClick={() => setCommit(true)}>Import {ready} rows</Button>}
          </div>
        </div>
      )}
      <PreviewConfirm
        open={commit}
        onClose={() => setCommit(false)}
        title="Import these punches"
        intro="Valid rows become punches and attendance is recalculated. Rows with errors are skipped and listed in the error file."
        load={async () => ({ will_import: ready, will_skip_with_errors: counts.errors ?? 0, duplicates_ignored: counts.duplicates ?? 0 })}
        onConfirm={async () => {
          await send('POST', `${paths.imports}/${id}/commit`);
          toast('Import started');
          load();
        }}
        confirmLabel="Start import"
      />
    </Modal>
  );
}

function AttendanceImportsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useList(paths.imports);
  const [upload, setUpload] = useState(false);
  const [open, setOpen] = useState(null); // {id, preview}
  const busy = list.rows.some((r) => BUSY.includes(r.status));
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(list.reload, 4000);
    return () => clearTimeout(t);
  }, [busy, list.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const columns = [
    { key: 'filename', label: 'File' },
    { key: 'kind', label: 'Kind', priority: 'md', render: (r) => titleCase(r.kind) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'progress', label: 'Progress', priority: 'md', render: (r) => <Progress value={r.progress_percent ?? 0} max={100} label={`${r.filename} progress`} /> },
    { key: 'counts', label: 'Rows', priority: 'lg', render: (r) => `${r.counts?.imported ?? 0} imported, ${r.counts?.errors ?? 0} errors of ${r.counts?.total ?? 0}` },
    { key: 'created_at', label: 'Uploaded', priority: 'lg', render: (r) => String(r.created_at ?? '').slice(0, 10) },
  ];
  return (
    <Screen
      title="Attendance imports"
      description="Bring punches in from a spreadsheet, review problems, then import."
      permission="attendance.import|attendance.manage"
      action={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => download(`${paths.imports}/template?format=csv`, 'punch-template.csv').catch((e) => toast(e.message, 'error'))}><Download size={14} /> Template</Button>
          {can('attendance.import') && <Button onClick={() => setUpload(true)}><Upload size={14} /> Upload</Button>}
        </div>
      }
    >
      {busy && <ProcessingBanner>An import is running. This list refreshes automatically.</ProcessingBanner>}
      <Panel>
        {list.loading ? (
          <Skeleton />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : (
          <ResponsiveList
            label="Imports"
            columns={columns}
            rows={list.rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => setOpen({ id: r.id })}
            mobile={{ title: 'filename', subtitle: (r) => titleCase(r.kind), badge: (r) => <StatusBadge status={r.status} />, facts: [{ label: 'Progress', value: (r) => `${r.progress_percent ?? 0}%` }, { label: 'Errors', value: (r) => r.counts?.errors ?? 0 }] }}
            empty={{ title: 'No imports yet', description: 'Download the template, fill it in and upload it.' }}
          />
        )}
      </Panel>
      <UploadDialog open={upload} onClose={() => setUpload(false)} onUploaded={(r) => { list.reload(); setOpen({ id: unwrap(r).id, preview: { columns: r.columns, suggested_mapping: r.suggested_mapping } }); }} />
      {open && <ImportDetail id={open.id} preview={open.preview} onClose={() => setOpen(null)} onChanged={list.reload} />}
    </Screen>
  );
}

export default guarded(AttendanceImportsPage, { title: 'Attendance imports', permission: 'attendance.import|attendance.manage' });
