import { useState } from 'react';
import { Button, Card, Select, useToast } from '../../components/ui';
import { Amount, Banner, ListCard, Page, PurposeModal, Section, StatusBadge, useDo, withEmpty } from '../../components/payroll/kit';
import { useAuth } from '../../lib/auth';
import { api, download } from '../../lib/api';
import { listOf, paths, query, send, titleCase, unwrap, useList } from '../../lib/payrollApi';
import { periodOf } from './RunsPage';

const ACCESS = 'payroll.reports.view|payroll.export';
const isMoneyKey = (k) => /(gross|net|amount|total|tax|deduction|pay|cost|earning|reimbursement|contribution)/i.test(k);

export default function ReportsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const catalogue = useList(paths.reports);
  const runs = useList(`${paths.runs}?per_page=100`);
  const exportsList = useList(paths.exports);
  const [report, setReport] = useState('');
  const [runUuid, setRunUuid] = useState('');
  const [result, setResult] = useState(null);
  const [format, setFormat] = useState('csv');
  const [asking, setAsking] = useState(false);
  const { busy, run: act } = useDo();
  const rows = result ? listOf(result) : [];
  const keys = rows[0] ? Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== 'object') : [];
  const cell = (k, r) => (isMoneyKey(k) && r[k] !== null && r[k] !== undefined && /^-?[\d.]+$|^\*+$/.test(String(r[k])) ? <Amount value={r[k]} masked={result?.amounts_masked && /^\*+$/.test(String(r[k]))} /> : String(r[k] ?? '—'));
  return (
    <Page permission={ACCESS} title="Payroll reports" description="Reports follow the same masking and data scope as the screens. Exports are logged with a purpose.">
      <Card title="Report" className="mb-5">
        <Section>
          <div className="grid gap-x-4 sm:grid-cols-3">
            <Select label="Report" options={withEmpty((catalogue.rows ?? []).map((r) => ({ value: r.key ?? r.code, label: r.label ?? r.name ?? titleCase(r.key ?? r.code) })), 'Choose a report')} value={report} onChange={(e) => setReport(e.target.value)} />
            <Select label="Payroll run" options={withEmpty(runs.rows.map((r) => ({ value: r.uuid, label: `${periodOf(r)} (${titleCase(r.status)})` })), 'Choose a run')} value={runUuid} onChange={(e) => setRunUuid(e.target.value)} />
            {can('payroll.export') && <Select label="Export format" options={[{ value: 'csv', label: 'CSV' }, { value: 'xlsx', label: 'Excel (xlsx)' }]} value={format} onChange={(e) => setFormat(e.target.value)} />}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!report || !runUuid}
              loading={busy === 'view'}
              onClick={async () => setResult(await act('view', () => api(`${paths.report(report)}?${query({ run: runUuid, per_page: 100 })}`)))}
            >
              Show report
            </Button>
            {can('payroll.export') && (
              <Button variant="secondary" disabled={!report || !runUuid} onClick={() => setAsking(true)}>
                Export
              </Button>
            )}
          </div>
        </Section>
      </Card>
      {result && result !== true && (
        <>
          {result.amounts_masked && <Banner tone="info">Amount columns are hidden for your role.</Banner>}
          <ListCard
            title={titleCase(report)}
            list={{ loading: false, error: null, rows }}
            rowKey={(r) => r.uuid ?? r.employee_uuid ?? JSON.stringify(r)}
            columns={keys.map((k) => ({ key: k, label: titleCase(k), render: (r) => cell(k, r) }))}
            mobile={{ title: (r) => r[keys[0]], subtitle: (r) => r[keys[1]], facts: keys.slice(2, 6).map((k) => ({ label: titleCase(k), value: (r) => cell(k, r) })) }}
            empty={{ title: 'No rows', description: 'This report has no data for the chosen run.' }}
          />
        </>
      )}
      {can('payroll.export') && (
        <ListCard
          title="My exports"
          list={exportsList}
          columns={[
            { key: 'report', label: 'Report', render: (r) => titleCase(r.report) },
            { key: 'format', label: 'Format' },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
            { key: 'expires_at', label: 'Expires', priority: 'md', render: (r) => r.expires_at?.slice(0, 10) ?? '—' },
            { key: 'act', label: '', render: (r) => r.status === 'ready' && <Button variant="secondary" className="min-h-8! px-2! py-1!" onClick={() => act(`dl-${r.uuid}`, () => download(paths.exportDownload(r.uuid), `${r.report}.${r.format}`))}>Download</Button> },
          ]}
          mobile={{ title: (r) => titleCase(r.report), badge: (r) => <StatusBadge value={r.status} />, facts: [{ label: 'Format', value: 'format' }] }}
          empty={{ title: 'No exports', description: 'Exports you request appear here while they are available.' }}
        />
      )}
      <PurposeModal
        open={asking}
        onClose={() => setAsking(false)}
        title="Export purpose"
        submitLabel="Request export"
        onSubmit={async (purpose) => {
          unwrap(await send('POST', paths.reportExport(report), { format, run: runUuid, ...purpose }));
          toast('Export queued. It appears under My exports when ready.');
          exportsList.reload();
        }}
      />
    </Page>
  );
}
