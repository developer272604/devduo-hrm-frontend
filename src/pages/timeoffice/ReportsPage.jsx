import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button, Card, ErrorState, FilterBar, Input, Pagination, Select, Skeleton, useToast } from '../../components/ui';
import ResponsiveList from '../../components/ResponsiveList';
import { Banner, Panel, ProcessingBanner, Screen, StatusBadge, guarded } from '../../components/timeoffice/parts';
import { api, download, query } from '../../lib/api';
import { useResource } from '../../lib/hooks';
import { addDays, listOf, pageOf, paths, send, titleCase, today, useAction, useList } from '../../lib/timeOfficeApi';

const catalogueOf = (data) => {
  const r = data?.reports ?? data?.data ?? [];
  return (Array.isArray(r) ? r : Object.entries(r).map(([key, v]) => ({ key, ...(typeof v === 'object' ? v : { title: v }) }))).map((x) => ({ key: x.key ?? x.id, title: x.title ?? titleCase(x.key ?? x.id) }));
};
const cell = (v) => (v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function Exports() {
  const list = useList(paths.exports);
  const toast = useToast();
  const pending = list.rows.some((x) => ['queued', 'running'].includes(x.status));
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(list.reload, 4000);
    return () => clearTimeout(t);
  }, [pending, list.data]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Panel title="Your exports">
      {pending && <div className="px-6"><ProcessingBanner>Exports are being prepared.</ProcessingBanner></div>}
      {list.loading ? (
        <Skeleton rows={1} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : (
        <ResponsiveList
          label="Exports"
          rows={list.rows}
          rowKey={(r) => r.uuid ?? r.id}
          columns={[
            { key: 'report', label: 'Report', render: (r) => titleCase(r.report) },
            { key: 'format', label: 'Format', priority: 'md', render: (r) => String(r.format).toUpperCase() },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'created_at', label: 'Requested', priority: 'md', render: (r) => String(r.created_at ?? '').slice(0, 16).replace('T', ' ') },
            {
              key: 'download',
              label: 'File',
              render: (r) =>
                r.download ? (
                  <Button variant="secondary" onClick={() => download(r.download.replace(/^\/api/, ''), `attendance-${r.report}.${r.format}`).catch((e) => toast(e.message, 'error'))}>
                    <Download size={14} /> Download
                  </Button>
                ) : r.status === 'failed' ? 'Failed' : '—',
            },
          ]}
          mobile={{ title: (r) => titleCase(r.report), subtitle: (r) => String(r.format).toUpperCase(), badge: (r) => <StatusBadge status={r.status} /> }}
          empty={{ title: 'No exports yet', description: 'Exports you request appear here for a limited time.' }}
        />
      )}
    </Panel>
  );
}

function ReportsPagePage() {
  const toast = useToast();
  const catalogue = useResource(paths.reportCatalogue);
  const [report, setReport] = useState('daily');
  const [f, setF] = useState({ from: addDays(today(), -7), to: today(), status: '' });
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true });
  const [version, setVersion] = useState(0);
  const exporting = useAction();
  const reports = catalogue.data ? catalogueOf(catalogue.data) : [];
  useEffect(() => {
    if (!report) return;
    const controller = new AbortController();
    setState({ loading: true });
    api(`${paths.report(report)}?${query({ ...f, page })}`, { signal: controller.signal })
      .then((data) => setState({ data }))
      .catch((error) => error.name !== 'AbortError' && setState({ error }));
    return () => controller.abort();
  }, [report, f.from, f.to, f.status, page, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = state.data ? listOf(state.data) : [];
  const keys = Object.keys(rows[0] ?? {}).filter((k) => typeof rows[0][k] !== 'object' || rows[0][k] === null);
  const columns = keys.map((k, i) => ({ key: k, label: titleCase(k), priority: i < 3 ? 'always' : i < 6 ? 'md' : 'lg', render: (r) => cell(r[k]) }));
  const set = (k) => (e) => {
    setF((s) => ({ ...s, [k]: e.target.value }));
    setPage(1);
  };
  async function exportIt(format) {
    const ok = await exporting.run(() => send('POST', paths.reportExport(report), { format, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) }));
    if (ok) toast(`${format.toUpperCase()} export queued. It will appear under Your exports.`);
  }
  return (
    <Screen title="Reports" description="Run an attendance report, then export it." permission="attendance.reports.view|attendance.manage">
      <Card className="mb-5">
        <FilterBar>
          <Select label="Report" value={report} options={reports.length ? reports.map((r) => ({ value: r.key, label: r.title })) : [{ value: 'daily', label: 'Daily attendance' }]} onChange={(e) => { setReport(e.target.value); setPage(1); }} />
          <Input label="From" type="date" value={f.from} onChange={set('from')} />
          <Input label="To" type="date" value={f.to} min={f.from} onChange={set('to')} />
          <Input label="Status" value={f.status} onChange={set('status')} placeholder="Any" />
          <Button variant="secondary" loading={exporting.busy} onClick={() => exportIt('csv')}><Download size={14} /> CSV</Button>
          <Button variant="secondary" loading={exporting.busy} onClick={() => exportIt('xlsx')}><Download size={14} /> XLSX</Button>
        </FilterBar>
        {exporting.error && <div className="px-5 pt-3"><Banner tone="error" title="Export failed">{exporting.error.message}</Banner></div>}
        {catalogue.error && <div className="px-5 pt-3"><Banner tone="warn" title="Report list unavailable">Showing the default report. {catalogue.error.message}</Banner></div>}
        {state.loading ? (
          <Skeleton />
        ) : state.error ? (
          <ErrorState error={state.error} onRetry={() => setVersion((v) => v + 1)} />
        ) : (
          <>
            <ResponsiveList
              label="Report results"
              columns={columns}
              rows={rows}
              rowKey={(r) => JSON.stringify(r)}
              mobile={{ title: (r) => cell(r[keys[0]]), subtitle: (r) => cell(r[keys[1]]), facts: keys.slice(2, 6).map((k) => ({ label: titleCase(k), value: (r) => cell(r[k]) })) }}
              empty={{ title: 'No rows', description: 'Nothing matches these filters. Widen the dates.' }}
            />
            <Pagination data={pageOf(state.data)} onChange={setPage} />
          </>
        )}
      </Card>
      <Exports />
    </Screen>
  );
}

export default guarded(ReportsPagePage, { title: 'Reports', permission: 'attendance.reports.view|attendance.manage' });
