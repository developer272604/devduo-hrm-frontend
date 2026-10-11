import { useState } from 'react';
import { Button, Card, Input, Select, useToast } from '../../components/ui';
import { Amount, Banner, ConfirmDialog, ConfirmPreview, FormModal, ListCard, Page, Section, StatusBadge, Tiles, useDo, withEmpty } from '../../components/payroll/kit';
import { useAuth } from '../../lib/auth';
import { api, download } from '../../lib/api';
import { paths, query, send, today, unwrap, useList } from '../../lib/payrollApi';
import { periodOf } from './RunsPage';

const ACCESS = 'payroll.accounting.manage|payroll.accounting.export';
const LOCKED = ['locked', 'outputs', 'payment', 'closed'];

function Journal({ data }) {
  return (
    <>
      {!data.balanced && <Banner tone="error">The journal does not balance. Do not export it.</Banner>}
      <Tiles
        items={[
          { label: 'Total debit', value: <Amount value={data.total_debit} /> },
          { label: 'Total credit', value: <Amount value={data.total_credit} /> },
          { label: 'Balanced', value: data.balanced ? 'Yes' : 'No' },
          { label: 'Reconciles to payments', value: data.reconciliation?.ok ? 'Yes' : 'No' },
        ]}
      />
      <ListCard
        title="Lines"
        list={{ loading: false, error: null, rows: data.lines ?? [] }}
        rowKey={(r) => `${r.account}-${r.component_code}-${r.debit}-${r.credit}`}
        columns={[
          { key: 'account', label: 'Account' },
          { key: 'component_code', label: 'Component', render: (r) => r.component_code ?? '—' },
          { key: 'debit', label: 'Debit', render: (r) => <Amount value={r.debit} currency={r.currency} /> },
          { key: 'credit', label: 'Credit', render: (r) => <Amount value={r.credit} currency={r.currency} /> },
        ]}
        mobile={{ title: 'account', subtitle: (r) => r.component_code, facts: [{ label: 'Debit', value: (r) => <Amount value={r.debit} currency={r.currency} /> }, { label: 'Credit', value: (r) => <Amount value={r.credit} currency={r.currency} /> }] }}
        empty={{ title: 'No journal lines' }}
      />
    </>
  );
}

export default function AccountingPage() {
  const { can } = useAuth();
  const toast = useToast();
  const mappings = useList(paths.accMappings);
  const runs = useList(`${paths.runs}?per_page=100`);
  const [create, setCreate] = useState(false);
  const [deactivate, setDeactivate] = useState(null);
  const [run, setRun] = useState('');
  const [posting, setPosting] = useState(today());
  const [preview, setPreview] = useState(null);
  const [exporting, setExporting] = useState(false);
  const exportsList = useList(run ? paths.journalExports(run) : '/v1/payroll/runs/none/journal/exports');
  const { busy, run: act } = useDo();
  const manage = can('payroll.accounting.manage');
  const runOptions = runs.rows.filter((r) => LOCKED.includes(r.status)).map((r) => ({ value: r.uuid, label: `${periodOf(r)} (${r.run_type})` }));
  return (
    <Page permission={ACCESS} title="Accounting" description="Map components to ledger accounts, preview the journal and export it.">
      {manage && (
        <ListCard
          title="Account mappings"
          list={mappings}
          action={<Button variant="secondary" onClick={() => setCreate(true)}>Add mapping</Button>}
          columns={[
            { key: 'target', label: 'Applies to', render: (r) => r.component_code ?? `All ${r.kind}` },
            { key: 'debit_account', label: 'Debit' },
            { key: 'credit_account', label: 'Credit' },
            { key: 'effective_from', label: 'From', priority: 'md' },
            { key: 'active', label: 'Status', render: (r) => <StatusBadge value={r.active === false ? 'inactive' : 'active'} /> },
            { key: 'act', label: '', render: (r) => r.active !== false && <Button variant="secondary" className="min-h-8! px-2! py-1!" onClick={() => setDeactivate(r)}>Deactivate</Button> },
          ]}
          mobile={{ title: (r) => r.component_code ?? `All ${r.kind}`, badge: (r) => <StatusBadge value={r.active === false ? 'inactive' : 'active'} />, facts: [{ label: 'Debit', value: 'debit_account' }, { label: 'Credit', value: 'credit_account' }] }}
          empty={{ title: 'No mappings', description: 'Add mappings so every component posts to an account.' }}
        />
      )}
      <Card title="Journal" className="mb-5">
        <Section>
          <div className="grid gap-x-4 sm:grid-cols-3">
            <Select label="Payroll run" options={withEmpty(runOptions, 'Choose a locked run')} value={run} onChange={(e) => { setRun(e.target.value); setPreview(null); }} />
            <Input label="Posting date" type="date" value={posting} onChange={(e) => setPosting(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={!run}
              loading={busy === 'preview'}
              onClick={async () => setPreview(unwrap(await act('preview', () => api(`${paths.journalPreview(run)}?${query({ posting_date: posting })}`))))}
            >
              Preview journal
            </Button>
            {can('payroll.accounting.export') && (
              <Button disabled={!run} onClick={() => setExporting(true)}>
                Export journal
              </Button>
            )}
          </div>
          {preview && preview !== true && <div className="mt-4"><Journal data={preview} /></div>}
        </Section>
      </Card>
      {run && can('payroll.accounting.export') && (
        <ListCard
          title="Previous exports"
          list={exportsList}
          columns={[
            { key: 'version', label: 'Version' },
            { key: 'posting_date', label: 'Posting date' },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
            { key: 'act', label: '', render: (r) => <Button variant="secondary" className="min-h-8! px-2! py-1!" onClick={() => act(`dl-${r.uuid}`, () => download(paths.accDownload(r.uuid), `journal-v${r.version}.csv`))}>Download</Button> },
          ]}
          mobile={{ title: (r) => `Version ${r.version}`, badge: (r) => <StatusBadge value={r.status} />, facts: [{ label: 'Posting date', value: 'posting_date' }] }}
          empty={{ title: 'No exports yet' }}
        />
      )}
      <FormModal
        open={create}
        onClose={() => setCreate(false)}
        title="Add account mapping"
        initial={{ effective_from: today() }}
        fields={[
          { name: 'component_code', label: 'Component code (leave empty to map a whole type)', required: false },
          { name: 'kind', label: 'Component type (when no code)', required: false, hint: 'For example earning, deduction, tax.' },
          { name: 'debit_account', label: 'Debit account' },
          { name: 'credit_account', label: 'Credit account' },
          { name: 'effective_from', label: 'Effective from', type: 'date' },
        ]}
        onSubmit={async (v) => {
          await send('POST', paths.accMappings, Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '')));
          mappings.reload();
        }}
        success="Mapping added"
      />
      <ConfirmDialog
        open={Boolean(deactivate)}
        onClose={() => setDeactivate(null)}
        title="Deactivate mapping?"
        intro="Future journal previews will no longer use this mapping. Past exports are unchanged."
        confirmLabel="Deactivate"
        danger
        onConfirm={async () => {
          await send('POST', paths.accMappingDeactivate(deactivate.uuid), {});
          toast('Mapping deactivated');
          mappings.reload();
        }}
      />
      <ConfirmPreview
        open={exporting}
        onClose={() => setExporting(false)}
        title="Export journal"
        intro="A versioned export is created. Earlier versions are kept."
        load={() => api(`${paths.journalPreview(run)}?${query({ posting_date: posting })}`)}
        blocked={(d) => (d.balanced === false ? 'The journal does not balance.' : null)}
        confirmLabel="Export"
        onConfirm={async () => {
          await send('POST', paths.journalExport(run), { posting_date: posting });
          toast('Journal exported');
          exportsList.reload();
        }}
      >
        {(d) => <Journal data={d} />}
      </ConfirmPreview>
    </Page>
  );
}
