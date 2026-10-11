import { useState } from 'react';
import { Button, Modal, Select, Skeleton, ErrorState, useToast } from '../../components/ui';
import { Amount, Banner, ConfirmDialog, ConfirmPreview, FormModal, ListCard, Page, StatusBadge, Tiles, optionsOf, useEmployees, withEmpty } from '../../components/payroll/kit';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import { idem, listOf, newKey, paths, query, send, titleCase, unwrap, useList } from '../../lib/payrollApi';
import { api } from '../../lib/api';

const ACCESS = 'payroll.compensation.view|payroll.compensation.manage|payroll.compensation.approve';
const TYPES = ['increment', 'promotion', 'market_correction', 'adjustment', 'transfer', 'demotion', 'other'].map((t) => ({ value: t, label: titleCase(t) }));

function EmployeePanel({ employee }) {
  const current = useResource(paths.empCompensation(employee));
  const history = useResource(paths.empCompensation(employee, 'history'));
  const c = current.data ? unwrap(current.data) : null;
  const comp = c?.compensation;
  if (current.loading) return <Skeleton rows={2} />;
  if (current.error) return <ErrorState error={current.error} onRetry={current.reload} />;
  const s = comp?.summary;
  return (
    <>
      {comp?.masked && <Banner tone="info">Amounts are hidden for your role (compensation reveal permission is required).</Banner>}
      {comp ? (
        <Tiles
          items={[
            { label: 'Base pay', value: <Amount value={s?.base_pay} currency={comp.currency} masked={comp.masked} /> },
            { label: 'Gross reference', value: <Amount value={s?.gross_reference} currency={comp.currency} masked={comp.masked} /> },
            { label: 'Annual', value: <Amount value={s?.annual_compensation} currency={comp.currency} masked={comp.masked} /> },
            { label: 'Effective from', value: comp.effective_from },
          ]}
        />
      ) : (
        <p className="text-sm">No approved compensation is in force for this employee.</p>
      )}
      <ListCard
        title="History (newest first)"
        list={{ loading: history.loading, error: history.error, reload: history.reload, rows: history.data ? listOf(history.data) : [] }}
        columns={[
          { key: 'effective_from', label: 'From' },
          { key: 'effective_to', label: 'To', render: (r) => r.effective_to ?? 'Open' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          { key: 'gross', label: 'Gross reference', render: (r) => <Amount value={r.summary?.gross_reference} currency={r.currency} masked={r.masked} /> },
          { key: 'reason', label: 'Reason', priority: 'lg' },
        ]}
        mobile={{ title: (r) => `${r.effective_from} to ${r.effective_to ?? 'open'}`, badge: (r) => <StatusBadge value={r.status} />, facts: [{ label: 'Gross', value: (r) => <Amount value={r.summary?.gross_reference} currency={r.currency} masked={r.masked} /> }] }}
        empty={{ title: 'No history', description: 'Approved and pending compensation records appear here.' }}
      />
    </>
  );
}

function Preview({ p }) {
  return (
    <>
      {p.backdated && <Banner tone="warn">This revision is backdated. Retro-pay review is {p.retro_review_required ? 'required' : 'not required'}.</Banner>}
      <Tiles
        items={[
          { label: 'Current gross', value: <Amount value={p.current?.gross_reference} masked={p.current?.masked} /> },
          { label: 'Proposed gross', value: <Amount value={p.proposed?.gross_reference} masked={p.proposed?.masked} /> },
          { label: 'Change', value: <Amount value={p.change?.gross_reference} masked={p.proposed?.masked} />, detail: p.change?.percent != null && !p.proposed?.masked ? `${p.change.percent}%` : undefined },
          { label: 'Annual change', value: <Amount value={p.change?.annual} masked={p.proposed?.masked} /> },
        ]}
      />
    </>
  );
}

export default function CompensationPage() {
  const { can } = useAuth();
  const toast = useToast();
  const employees = useEmployees();
  const components = useList(`${paths.components}?per_page=100`);
  const [employee, setEmployee] = useState('');
  const [status, setStatus] = useState('pending');
  const revisions = useList(`${paths.revisions}?${query({ status })}`);
  const batches = useList(paths.revisionBatches);
  const [batchUuid, setBatchUuid] = useState('');
  const batchDetail = useResource(batchUuid ? paths.revisionBatch(batchUuid) : null);
  const pendingRecords = useList(`${paths.compensations}?status=pending`);
  const [form, setForm] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [decision, setDecision] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importType, setImportType] = useState('increment');
  const [importDate, setImportDate] = useState('');
  const [importReason, setImportReason] = useState('');
  const [importMapping, setImportMapping] = useState({ employee_number: 'employee_number', component_code: 'component_code', amount: 'amount' });
  const [importPreview, setImportPreview] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const manage = can('payroll.compensation.manage');
  const approve = can('payroll.compensation.approve');

  const actions = (r) =>
    r.status === 'pending' ? (
      <span className="flex gap-1">
        {approve && (
          <>
            <Button variant="secondary" className="min-h-8! px-2! py-1!" onClick={() => setDecision({ kind: 'revision', row: r, decision: 'approved' })}>Approve</Button>
            <Button variant="secondary" className="min-h-8! px-2! py-1!" onClick={() => setDecision({ kind: 'revision', row: r, decision: 'rejected' })}>Reject</Button>
          </>
        )}
        {manage && <Button variant="secondary" className="min-h-8! px-2! py-1!" onClick={() => setDecision({ kind: 'cancel', row: r })}>Cancel</Button>}
      </span>
    ) : null;

  return (
    <Page permission={ACCESS} title="Compensation" description="Employee pay history, proposed revisions and approvals. The approver must differ from the proposer." action={manage && <Button onClick={() => setForm(true)}>Propose revision</Button>}>
      <div className="mb-4 max-w-md">
        <Select label="Employee" options={withEmpty(employees, 'Choose an employee')} value={employee} onChange={(e) => setEmployee(e.target.value)} />
      </div>
      {manage && <section className="mb-6 rounded-xl border border-slate-200 p-4 dark:border-slate-700" aria-labelledby="comp-import-title">
        <h2 id="comp-import-title" className="mb-1 text-lg font-semibold">Import compensation revisions</h2>
        <p className="mb-4 text-sm text-slate-500">Map your CSV/XLSX headers to employee number, component code, and amount. Preview checks rows without submitting revisions.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">File<input className="mt-1 block w-full text-sm" type="file" accept=".csv,.xlsx" onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportPreview(null); setImportError(''); }} /></label>
          <label className="text-sm">Revision type<select className="mt-1 block min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900" value={importType} onChange={(e) => setImportType(e.target.value)}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
          <label className="text-sm">Effective date<input className="mt-1 block min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900" type="date" value={importDate} onChange={(e) => setImportDate(e.target.value)} /></label>
          <label className="text-sm">Reason<input className="mt-1 block min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900" value={importReason} onChange={(e) => setImportReason(e.target.value)} /></label>
        </div>
        <fieldset className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700 md:grid-cols-3">
          <legend className="px-1 text-xs font-semibold">Column mapping (case and spaces are normalized)</legend>
          {Object.entries({ employee_number: 'Employee number', component_code: 'Component code', amount: 'Amount' }).map(([field, label]) => <label key={field} className="text-xs">{label}
            <input aria-label={`${label} column`} className="mt-1 block min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900" value={importMapping[field]} onChange={(e) => setImportMapping((old) => ({ ...old, [field]: e.target.value }))} />
          </label>)}
        </fieldset>
        {importError && <p className="mt-3 text-sm text-rose-700 dark:text-rose-300" role="alert">{importError}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={!importFile || !importDate || !importReason || importBusy} onClick={async () => {
            setImportBusy(true); setImportError('');
            try { const body = new FormData(); body.append('file', importFile); body.append('type', importType); body.append('effective_date', importDate); body.append('reason', importReason); Object.entries(importMapping).forEach(([field, header]) => body.append(`mapping[${field}]`, header)); setImportPreview(await api(paths.compensationImportPreview, { method: 'POST', body })); }
            catch (e) { setImportError(Object.values(e.errors ?? {}).flat().join(' ') || e.message); }
            finally { setImportBusy(false); }
          }}>{importBusy ? 'Working…' : 'Preview import'}</Button>
          {importPreview?.status === 'previewed' && importPreview.rows_ok > 0 && <Button variant="secondary" disabled={importBusy} onClick={async () => {
            setImportBusy(true); setImportError('');
            try { const result = await api(paths.compensationImportCommit(importPreview.uuid), { method: 'POST', body: {} }); setImportPreview({ ...importPreview, status: result.status, batch_uuid: result.batch_uuid }); revisions.reload(); toast('Valid revisions submitted for independent approval'); }
            catch (e) { setImportError(Object.values(e.errors ?? {}).flat().join(' ') || e.message); }
            finally { setImportBusy(false); }
          }}>Commit {importPreview.rows_ok} valid rows</Button>}
        </div>
        {importPreview && <div className="mt-4" aria-live="polite"><p className="text-sm">{importPreview.status === 'committed' ? `Committed. Batch ${importPreview.batch_uuid} is awaiting independent approval.` : `${importPreview.rows_ok} valid · ${importPreview.rows_error} errors · ${importPreview.rows_duplicate} duplicates`}</p>
          <div className="max-h-56 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="py-2">Row</th><th>Status</th><th>Details</th></tr></thead><tbody>{importPreview.rows.map((row) => <tr key={row.row_number} className="border-t border-slate-200 dark:border-slate-700"><td className="py-2">{row.row_number}</td><td>{titleCase(row.status)}</td><td>{row.errors?.join(' ') || 'Ready'}</td></tr>)}</tbody></table></div>
        </div>}
      </section>}
      {employee && <EmployeePanel key={employee} employee={employee} />}
      <div className="mb-4 max-w-xs">
        <Select label="Revision status" options={withEmpty(['pending', 'applied', 'rejected', 'cancelled'].map((s) => ({ value: s, label: titleCase(s) })), 'Any status')} value={status} onChange={(e) => setStatus(e.target.value)} />
      </div>
      <ListCard
        title="Revisions"
        list={revisions}
        columns={[
          { key: 'employee_name', label: 'Employee' },
          { key: 'type', label: 'Type', priority: 'md', render: (r) => titleCase(r.type) },
          { key: 'effective_date', label: 'Effective' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          { key: 'act', label: '', render: actions },
        ]}
        card={(r) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <strong className="text-sm">{r.employee_name}</strong>
              <StatusBadge value={r.status} />
            </div>
            <p className="m-0 text-xs text-slate-500">
              {titleCase(r.type)} · effective {r.effective_date}
            </p>
            <div className="mt-2">{actions(r)}</div>
          </div>
        )}
        empty={{ title: 'No revisions', description: 'Proposed compensation revisions appear here.' }}
      />
      <ListCard title="Revision batches" list={batches} columns={[
        { key: 'name', label: 'Batch' },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
        { key: 'employees', label: 'Employees', render: (r) => `${r.employees.submitted} submitted / ${r.employees.total} total` },
        { key: 'effective_date', label: 'Effective' },
        { key: 'view', label: '', render: (r) => <Button variant="secondary" onClick={() => setBatchUuid(r.uuid)}>Details</Button> },
      ]} empty={{ title: 'No batches', description: 'Submitted mass revisions and file imports will appear here.' }} />
      <Modal open={Boolean(batchUuid)} onClose={() => setBatchUuid('')} title="Compensation revision batch">
        {batchDetail.loading ? <Skeleton rows={2} /> : batchDetail.error ? <ErrorState error={batchDetail.error} onRetry={batchDetail.reload} /> : batchDetail.data && <div className="space-y-4">
          <p className="text-sm">{batchDetail.data.name} · {titleCase(batchDetail.data.status)} · effective {batchDetail.data.effective_date}</p>
          <ListCard title="Revisions" list={{ loading: false, error: null, reload: batchDetail.reload, rows: batchDetail.data.revisions ?? [] }} columns={[{ key: 'employee_uuid', label: 'Employee reference' }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> }]} />
          {batchDetail.data.errors?.length > 0 && <ul className="list-disc pl-5 text-sm">{batchDetail.data.errors.map((e) => <li key={`${e.row}-${e.message}`}>Row {e.row}: {e.message}</li>)}</ul>}
        </div>}
      </Modal>
      <ListCard
        title="Pending compensation records"
        list={pendingRecords}
        columns={[
          { key: 'employee_name', label: 'Employee' },
          { key: 'effective_from', label: 'From' },
          { key: 'reason', label: 'Reason', priority: 'md' },
          { key: 'act', label: '', render: (r) => approve && r.can_review !== false && (
            <span className="flex gap-1">
              <Button variant="secondary" className="min-h-8! px-2! py-1!" onClick={() => setDecision({ kind: 'record', row: r, decision: 'approved' })}>Approve</Button>
              <Button variant="secondary" className="min-h-8! px-2! py-1!" onClick={() => setDecision({ kind: 'record', row: r, decision: 'rejected' })}>Reject</Button>
            </span>
          ) },
        ]}
        mobile={{ title: 'employee_name', subtitle: 'reason', facts: [{ label: 'From', value: 'effective_from' }] }}
        empty={{ title: 'Nothing pending', description: 'New compensation records awaiting review appear here.' }}
      />

      <FormModal
        open={form}
        onClose={() => setForm(false)}
        title="Propose compensation revision"
        intro="You will see a preview first. Nothing is saved until you confirm."
        initial={{ employee_uuid: employee, type: 'increment' }}
        submitLabel="Preview"
        fields={[
          { name: 'employee_uuid', label: 'Employee', options: employees },
          { name: 'type', label: 'Type', options: TYPES },
          { name: 'effective_date', label: 'Effective date', type: 'date' },
          { name: 'reason', label: 'Reason', textarea: true },
          { name: 'component_uuid', label: 'Component', options: optionsOf(components.rows.filter((c) => !c.formula), (c) => `${c.name} (${c.code})`) },
          { name: 'amount', label: 'Amount per pay period', hint: 'Decimal amount, for example 3500.00.' },
        ]}
        onSubmit={async (v) => {
          const { component_uuid, amount, ...rest } = v;
          setProposal({ ...rest, lines: [{ component_uuid, amount }], idempotency_key: newKey() });
        }}
      />
      <ConfirmPreview
        open={Boolean(proposal)}
        onClose={() => setProposal(null)}
        title="Confirm revision"
        intro="This is what the revision would do. It then goes to an independent approver."
        load={() => send('POST', paths.revisionPreview, (({ idempotency_key, ...b }) => b)(proposal))}
        confirmLabel="Submit for approval"
        onConfirm={async () => {
          await api(paths.revisions, { method: 'POST', body: proposal, headers: idem(proposal.idempotency_key) });
          toast('Revision submitted for approval');
          revisions.reload();
        }}
      >
        {(p) => <Preview p={p} />}
      </ConfirmPreview>
      <ConfirmDialog
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        title={decision ? `${decision.kind === 'cancel' ? 'Cancel' : titleCase(decision.decision)} for ${decision.row.employee_name ?? 'employee'}?` : ''}
        intro={decision?.kind === 'cancel' ? 'The revision will be withdrawn.' : 'Your decision is recorded. You cannot decide on a record you proposed.'}
        danger={decision?.decision === 'rejected' || decision?.kind === 'cancel'}
        confirmLabel={decision?.kind === 'cancel' ? 'Cancel revision' : titleCase(decision?.decision ?? 'Confirm')}
        onConfirm={async () => {
          if (decision.kind === 'cancel') await send('POST', paths.revision(decision.row.uuid, 'cancel'), {});
          else if (decision.kind === 'revision') await send('POST', paths.revision(decision.row.uuid, 'decision'), { decision: decision.decision });
          else await send('POST', paths.compensationDecision(decision.row.uuid), { decision: decision.decision });
          toast('Saved');
          revisions.reload();
          pendingRecords.reload();
        }}
      />
    </Page>
  );
}

