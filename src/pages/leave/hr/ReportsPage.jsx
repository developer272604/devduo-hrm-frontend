import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button, Card, ErrorState, FilterBar, Input, Pagination, Select, Skeleton, useToast } from '../../../components/ui';
import ResponsiveList from '../../../components/ResponsiveList';
import { Banner, ProcessingBanner, Screen, StatusBadge, guarded } from '../../../components/timeoffice/parts';
import { ListCard } from '../../../components/leave/hr/kit';
import { useAuth } from '../../../lib/auth';
import { api, download } from '../../../lib/api';
import { useResource } from '../../../lib/hooks';
import { addDays, listOf, pageOf, paths, query, send, titleCase, today, usePoll, useAction, useList } from '../../../lib/leaveHrApi';

const FALLBACK = ['balances', 'ledger', 'requests', 'utilization', 'adjustments', 'expiring', 'comp_off', 'encashment', 'payroll_lines'];
const catalogueOf = (data) => {
  const r = data?.reports ?? data?.data ?? data ?? [];
  const arr = Array.isArray(r) ? r : Object.entries(r).map(([key, v]) => ({ key, ...(typeof v === 'object' ? v : { title: v }) }));
  return arr.map((x) => (typeof x === 'string' ? { key: x, title: titleCase(x) } : { key: x.key ?? x.id ?? x.report, title: x.title ?? titleCase(x.key ?? x.id) }));
};
const cell = (v) => (v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
const HIDDEN = ['employee_uuid'];

function Exports() {
  const toast = useToast();
  const list = useList(paths.exports);
  const pending = list.rows.some((x) => ['queued', 'processing'].includes(x.status));
  usePoll(pending, list.reload, [list.data], 4000);
  return (
    <ListCard
      title="Your exports"
      list={list}
      extra={pending ? <div className="px-6"><ProcessingBanner>Exports are being prepared.</ProcessingBanner></div> : null}
      columns={[
        { key: 'report', label: 'Report', render: (r) => titleCase(r.report) },
        { key: 'format', label: 'Format', priority: 'md', render: (r) => String(r.format).toUpperCase() },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { key: 'row_count', label: 'Rows', priority: 'md', render: (r) => r.row_count ?? '—' },
        {
          key: 'download',
          label: 'File',
          render: (r) =>
            r.status === 'completed' && r.download ? (
              <Button variant="secondary" onClick={() => download(r.download.replace(/^\/api/, ''), `leave-${r.report}.${r.format}`).catch((e) => toast(e.status === 410 ? 'This export has expired. Request it again.' : e.message, 'error'))}>
                <Download size={14} /> Download
              </Button>
            ) : r.status === 'failed' ? r.error ?? 'Failed' : r.status === 'expired' ? 'Expired' : '—',
        },
      ]}
      mobile={{ title: (r) => titleCase(r.report), subtitle: (r) => String(r.format).toUpperCase(), badge: (r) => <StatusBadge status={r.status} /> }}
      empty={{ title: 'No exports yet', description: 'Exports are kept for 3 days.' }}
    />
  );
}

function ReportsPageInner() {
  const { can } = useAuth();
  const toast = useToast();
  const catalogue = useResource(paths.reports);
  const [report, setReport] = useState('balances');
  const [f, setF] = useState({ q: '', leave_type: '', status: '', from: addDays(today(), -30), to: today() });
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true });
  const [version, setVersion] = useState(0);
  const exporting = useAction();
  const canExport = can('leave.export');
  const reports = catalogue.data ? catalogueOf(catalogue.data) : FALLBACK.map((k) => ({ key: k, title: titleCase(k) }));
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true });
    api(`${paths.report(report)}?${query({ ...f, page })}`, { signal: controller.signal })
      .then((data) => setState({ data }))
      .catch((error) => error.name !== 'AbortError' && setState({ error }));
    return () => controller.abort();
  }, [report, f.q, f.leave_type, f.status, f.from, f.to, page, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = state.data ? listOf(state.data) : [];
  const keys = Object.keys(rows[0] ?? {}).filter((k) => !HIDDEN.includes(k) && (rows[0][k] === null || typeof rows[0][k] !== 'object'));
  const set = (k) => (e) => {
    setF((s) => ({ ...s, [k]: e.target.value }));
    setPage(1);
  };
  async function exportIt(format) {
    const filters = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
    if (await exporting.run(() => send('POST', paths.reportExport(report), { format, ...filters }))) toast(`${format.toUpperCase()} export queued. It appears under Your exports.`);
  }
  return (
    <Screen title="Leave reports" description="Balances come from the ledger, the same numbers employees see. Reasons and documents are never included." permission="leave.reports.view|leave.manage">
      <Card className="mb-5">
        <FilterBar>
          <Select label="Report" value={report} options={reports.map((r) => ({ value: r.key, label: r.title }))} onChange={(e) => { setReport(e.target.value); setPage(1); }} />
          <Input label="Search" value={f.q} onChange={set('q')} placeholder="Name or number" />
          <Input label="Leave type code" value={f.leave_type} onChange={set('leave_type')} />
          <Input label="Status" value={f.status} onChange={set('status')} />
          <Input label="From" type="date" value={f.from} onChange={set('from')} />
          <Input label="To" type="date" value={f.to} min={f.from} onChange={set('to')} />
          {canExport && (
            <>
              <Button variant="secondary" loading={exporting.busy} onClick={() => exportIt('csv')}><Download size={14} /> CSV</Button>
              <Button variant="secondary" loading={exporting.busy} onClick={() => exportIt('xlsx')}><Download size={14} /> XLSX</Button>
            </>
          )}
        </FilterBar>
        {exporting.error && <div className="px-5 pt-3"><Banner tone="error" title="Export failed">{exporting.error.message}</Banner></div>}
        {catalogue.error && <div className="px-5 pt-3"><Banner tone="warn" title="Report list unavailable">Showing the standard reports. {catalogue.error.message}</Banner></div>}
        {state.loading ? (
          <Skeleton />
        ) : state.error ? (
          <ErrorState error={state.error} onRetry={() => setVersion((v) => v + 1)} />
        ) : (
          <>
            <ResponsiveList
              label="Report results"
              rows={rows}
              rowKey={(r) => JSON.stringify(r)}
              columns={keys.map((k, i) => ({ key: k, label: titleCase(k), priority: i < 3 ? 'always' : i < 6 ? 'md' : 'lg', render: (r) => cell(r[k]) }))}
              mobile={{ title: (r) => cell(r[keys[0]]), subtitle: (r) => cell(r[keys[1]]), facts: keys.slice(2, 6).map((k) => ({ label: titleCase(k), value: (r) => cell(r[k]) })) }}
              empty={{ title: 'No rows', description: 'Nothing matches these filters. Widen the dates or clear a filter.' }}
            />
            <Pagination data={pageOf(state.data)} onChange={setPage} />
          </>
        )}
      </Card>
      {canExport && <Exports />}
    </Screen>
  );
}

export default guarded(ReportsPageInner, { title: 'Leave reports', permission: 'leave.reports.view|leave.manage' });
