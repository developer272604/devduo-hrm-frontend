import { useEffect, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button, ErrorState, FormError, Input, Modal, Select, Skeleton, useToast } from '../../../components/ui';
import ResponsiveList from '../../../components/ResponsiveList';
import { Banner, PartialFailure, ProcessingBanner, Progress, Screen, StatusBadge, guarded } from '../../../components/timeoffice/parts';
import { ConfirmPreview, ListCard, Tiles } from '../../../components/leave/hr/kit';
import { useAuth } from '../../../lib/auth';
import { api, download } from '../../../lib/api';
import { listOf, paths, query, send, titleCase, unwrap, usePoll, useAction, useList } from '../../../lib/leaveHrApi';

const BUSY = ['queued', 'importing', 'validating'];
const KINDS = [
  { value: 'opening_balance', label: 'Opening balances' },
  { value: 'historical_requests', label: 'Historical leave requests' },
];
const FIELDS = {
  opening_balance: ['employee_number', 'work_email', 'leave_type_code', 'units', 'as_of', 'expires_on', 'note'],
  historical_requests: ['employee_number', 'work_email', 'leave_type_code', 'start_date', 'end_date', 'units', 'reason', 'external_ref'],
};
const STEPS = ['Upload', 'Match columns', 'Review', 'Import'];
const stepOf = (status) => ({ uploaded: 1, mapped: 2, validating: 2, validated: 2 })[status] ?? 3;
const colOpt = (c) => (typeof c === 'object' ? { value: c.key ?? c.name, label: c.label ?? c.key ?? c.name } : { value: c, label: c });

export function Stepper({ current }) {
  return (
    <ol className="m-0 mb-4 flex list-none gap-2 p-0 text-xs" aria-label="Import steps">
      {STEPS.map((s, i) => (
        <li
          key={s}
          aria-current={i === current ? 'step' : undefined}
          className={`flex-1 rounded-lg border px-2 py-1.5 text-center ${i === current ? 'border-brand-500 font-semibold text-brand-700 dark:text-brand-300' : i < current ? 'border-emerald-300 text-emerald-700 dark:text-emerald-300' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}
        >
          {i + 1}. {s}
          {i < current && <span className="sr-only"> (done)</span>}
        </li>
      ))}
    </ol>
  );
}

function UploadStep({ onUploaded, onClose }) {
  const [kind, setKind] = useState('opening_balance');
  const file = useRef(null);
  const toast = useToast();
  const { busy, error, run } = useAction();
  return (
    <Modal open onClose={onClose} title="Import leave data">
      <Stepper current={0} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = file.current?.files?.[0];
          if (!f) return;
          const body = new FormData();
          body.append('file', f);
          body.append('kind', kind);
          const r = await run(() => send('POST', paths.imports, body));
          if (r) onUploaded(r);
        }}
      >
        <FormError error={error} />
        <Select label="What are you importing?" value={kind} options={KINDS} onChange={(e) => setKind(e.target.value)} />
        <p className="mt-0 text-xs text-slate-500 dark:text-slate-400">
          {kind === 'opening_balance' ? 'One credit per employee, leave type and period. The same value again is a duplicate; a different value is an error (use an adjustment).' : 'Rows become approved requests whose days are posted as consumption.'}
        </p>
        <Button variant="secondary" onClick={() => download(`${paths.importsTemplate}?${query({ kind, format: 'csv' })}`, `${kind}-template.csv`).catch((e) => toast(e.message, 'error'))}>
          <Download size={14} /> Download template
        </Button>
        <div className="my-4">
          <label htmlFor="leave-import-file" className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">File (CSV or XLSX)</label>
          <input id="leave-import-file" ref={file} type="file" required accept=".csv,.xlsx" className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" />
        </div>
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}><Upload size={14} /> Upload</Button>
        </div>
      </form>
    </Modal>
  );
}

function ImportWizard({ id, preview, onClose, onChanged }) {
  const toast = useToast();
  const [imp, setImp] = useState(null);
  const [error, setError] = useState(null);
  const [mapping, setMapping] = useState(preview?.suggested_mapping ?? {});
  const [dateFormat, setDateFormat] = useState('Y-m-d');
  const [rows, setRows] = useState(null);
  const [commit, setCommit] = useState(false);
  const act = useAction();
  const load = () => api(paths.importItem(id)).then((r) => setImp(unwrap(r))).catch(setError);
  useEffect(() => {
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const busy = imp && BUSY.includes(imp.status);
  usePoll(busy, load, [imp]);
  const c = imp?.counts ?? {};
  const ready = (c.valid ?? 0) + (c.warnings ?? 0);
  useEffect(() => {
    if (imp && (c.errors > 0 || c.warnings > 0) && !BUSY.includes(imp.status))
      api(`${paths.importItem(id, 'rows')}?${query({ status: c.errors > 0 ? 'error' : 'warning' })}`).then((r) => setRows(listOf(r))).catch(() => setRows([]));
  }, [imp?.status, c.errors, c.warnings]); // eslint-disable-line react-hooks/exhaustive-deps
  const columns = (preview?.columns ?? imp?.columns ?? []).map(colOpt);
  const fields = FIELDS[imp?.kind] ?? FIELDS.opening_balance;
  const step = imp ? stepOf(imp.status) : 1;
  return (
    <Modal open onClose={() => { onChanged(); onClose(); }} title={imp?.filename ?? 'Import'}>
      {error && <ErrorState error={error} onRetry={load} />}
      {!imp && !error && <Skeleton rows={2} />}
      {imp && (
        <div className="space-y-4 text-xs">
          <Stepper current={step} />
          {busy && <ProcessingBanner>{titleCase(imp.status)}. You can close this window; progress continues in the background.</ProcessingBanner>}
          <Progress value={imp.progress_percent ?? 0} max={100} label="Import progress" />
          <Tiles items={[{ label: 'Rows', value: c.total ?? 0 }, { label: 'Ready', value: ready }, { label: 'Errors', value: c.errors ?? 0, tone: c.errors > 0 ? 'warn' : undefined }, { label: 'Duplicates', value: c.duplicates ?? 0 }, { label: 'Imported', value: c.imported ?? 0 }, { label: 'Status', value: titleCase(imp.status) }]} />
          {imp.message && <Banner tone={c.errors ? 'warn' : 'info'}>{imp.message}</Banner>}
          {c.errors > 0 && c.imported > 0 && <PartialFailure failed={c.errors} total={c.total} />}
          <FormError error={act.error} />
          {imp.status === 'uploaded' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act.run(() => send('PUT', paths.importItem(id, 'mapping'), { mapping, options: { date_format: dateFormat }, validate: true }))) {
                  toast('Mapping saved. Validating rows.');
                  load();
                }
              }}
            >
              <h3 className="mb-2 text-sm">Match your columns</h3>
              <div className="grid gap-x-4 sm:grid-cols-2">
                {fields.map((f) => (
                  <Select key={f} label={titleCase(f)} value={mapping[f] ?? ''} options={[{ value: '', label: 'Not in file' }, ...columns]} onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value }))} />
                ))}
              </div>
              <Input label="Date format in the file" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} hint="PHP style, for example Y-m-d or d/m/Y." />
              <Button type="submit" loading={act.busy}>Save mapping and validate</Button>
            </form>
          )}
          {imp.status === 'mapped' && (
            <Button loading={act.busy} onClick={async () => (await act.run(() => send('POST', paths.importItem(id, 'validate')))) && (toast('Validating rows'), load())}>Validate rows</Button>
          )}
          {rows?.length > 0 && (
            <ResponsiveList
              label="Rows needing attention"
              rows={rows}
              rowKey={(r) => r.row ?? r.id}
              columns={[{ key: 'row', label: 'Row' }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { key: 'errors', label: 'Problem', render: (r) => [...(r.errors ?? []), ...(r.warnings ?? [])].map((x) => (typeof x === 'string' ? x : (x.message ?? JSON.stringify(x)))).join('; ') || '—' }]}
              mobile={{ title: (r) => `Row ${r.row}`, subtitle: (r) => [...(r.errors ?? []), ...(r.warnings ?? [])].map((x) => (typeof x === 'string' ? x : x.message)).join('; ') }}
            />
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {c.errors > 0 && <Button variant="secondary" onClick={() => download(paths.importItem(id, 'errors'), 'import-errors.csv').catch((e) => toast(e.message, 'error'))}><Download size={14} /> Error file</Button>}
            {['completed_with_errors', 'failed'].includes(imp.status) && (
              <Button variant="secondary" loading={act.busy} onClick={async () => (await act.run(() => send('POST', paths.importItem(id, 'retry')))) && (toast('Retrying failed rows'), load())}>Retry failed rows</Button>
            )}
            {imp.status === 'validated' && ready > 0 && <Button onClick={() => setCommit(true)}>Import {ready} rows</Button>}
          </div>
        </div>
      )}
      <ConfirmPreview
        open={commit}
        onClose={() => setCommit(false)}
        title="Import these rows"
        intro="Valid rows are written to the ledger. Rows with errors are skipped and listed in the error file. Imports cannot be undone; correct mistakes with adjustments."
        load={async () => ({ will_import: ready, will_skip_with_errors: c.errors ?? 0, duplicates_ignored: c.duplicates ?? 0 })}
        confirmLabel="Start import"
        onConfirm={async () => {
          await send('POST', paths.importItem(id, 'commit'));
          toast('Import started');
          load();
        }}
      >
        {(d) => <Tiles items={Object.entries(d).map(([k, v]) => ({ label: titleCase(k), value: String(v) }))} />}
      </ConfirmPreview>
    </Modal>
  );
}

function ImportsPageInner() {
  const { can } = useAuth();
  const list = useList(paths.imports);
  const [upload, setUpload] = useState(false);
  const [open, setOpen] = useState(null);
  const busy = list.rows.some((r) => BUSY.includes(r.status));
  usePoll(busy, list.reload, [list.data], 4000);
  const columns = [
    { key: 'filename', label: 'File' },
    { key: 'kind', label: 'Kind', priority: 'md', render: (r) => titleCase(r.kind) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'progress', label: 'Progress', priority: 'md', render: (r) => <Progress value={r.progress_percent ?? 0} max={100} label={`${r.filename} progress`} /> },
    { key: 'counts', label: 'Rows', priority: 'lg', render: (r) => `${r.counts?.imported ?? 0} imported, ${r.counts?.errors ?? 0} errors of ${r.counts?.total ?? 0}` },
  ];
  return (
    <Screen
      title="Leave imports"
      description="Load opening balances or historical leave from a spreadsheet, review problems, then import."
      permission="leave.import|leave.manage"
      action={can('leave.import|leave.manage') && <Button onClick={() => setUpload(true)}><Upload size={14} /> New import</Button>}
    >
      {busy && <ProcessingBanner>An import is running. This list refreshes automatically.</ProcessingBanner>}
      <ListCard
        title="Imports"
        list={list}
        columns={columns}
        rowKey={(r) => r.id ?? r.uuid}
        onRowClick={(r) => setOpen({ id: r.id ?? r.uuid })}
        mobile={{ title: 'filename', subtitle: (r) => titleCase(r.kind), badge: (r) => <StatusBadge status={r.status} />, facts: [{ label: 'Progress', value: (r) => `${r.progress_percent ?? 0}%` }, { label: 'Errors', value: (r) => r.counts?.errors ?? 0 }] }}
        empty={{ title: 'No imports yet', description: 'Download the template, fill it in and upload it.' }}
      />
      {upload && (
        <UploadStep
          onClose={() => setUpload(false)}
          onUploaded={(r) => {
            setUpload(false);
            list.reload();
            setOpen({ id: unwrap(r).id ?? unwrap(r).uuid, preview: { columns: r.columns, suggested_mapping: r.suggested_mapping ?? r.mapping } });
          }}
        />
      )}
      {open && <ImportWizard id={open.id} preview={open.preview} onClose={() => setOpen(null)} onChanged={list.reload} />}
    </Screen>
  );
}

export default guarded(ImportsPageInner, { title: 'Leave imports', permission: 'leave.import|leave.manage' });
