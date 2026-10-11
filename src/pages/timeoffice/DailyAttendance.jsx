import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bookmark, Download, RefreshCw } from 'lucide-react';
import { Button, Card, Drawer, ErrorState, FilterBar, Input, Pagination, Search, Select, Skeleton, useToast } from '../../components/ui';
import ResponsiveList from '../../components/ResponsiveList';
import { Banner, LockedBanner, ProcessingBanner, Screen, StatusBadge, guarded } from '../../components/timeoffice/parts';
import { PreviewConfirm } from '../../components/timeoffice/dialogs';
import { FormDialog } from '../../components/timeoffice/CrudPanel';
import { useAuth } from '../../lib/auth';
import { useDebounced } from '../../lib/hooks';
import { api, query } from '../../lib/api';
import { listOf, loadViews, minutes, pageOf, paths, send, storeViews, time, titleCase, today, toOptions, useLookup, useAction } from '../../lib/timeOfficeApi';

const STATUSES = ['', 'present', 'absent', 'late', 'half_day', 'missing_punch', 'weekly_off', 'holiday', 'leave', 'on_duty', 'not_scheduled'];
const SOURCES = ['', 'web', 'mobile', 'biometric', 'import', 'api', 'admin', 'kiosk'];
const EXCEPTIONS = ['', 'missing_in', 'missing_out', 'late_arrival', 'early_departure', 'insufficient_hours', 'unexpected_punch', 'outside_geofence', 'unscheduled_work', 'no_shift', 'no_policy'];
const opt = (list, empty) => list.map((v) => ({ value: v, label: v ? titleCase(v) : empty }));

const ADJUST_FIELDS = [
  { name: 'type', label: 'Adjustment', type: 'select', required: true, default: 'status_override', options: [{ value: 'add_punch', label: 'Add a punch' }, { value: 'void_punch', label: 'Void a punch' }, { value: 'status_override', label: 'Override day status' }] },
  { name: 'status', label: 'New status', type: 'select', options: opt(STATUSES.filter(Boolean), ''), showIf: (v) => v.type === 'status_override' },
  { name: 'direction', label: 'Direction', type: 'select', options: [{ value: 'IN', label: 'In' }, { value: 'OUT', label: 'Out' }], showIf: (v) => v.type === 'add_punch' },
  { name: 'at', label: 'Punch time', type: 'datetime-local', showIf: (v) => v.type === 'add_punch' },
  { name: 'event_uuid', label: 'Punch ID to void', showIf: (v) => v.type === 'void_punch' },
  { name: 'reason', label: 'Reason (required, kept in the audit trail)', type: 'textarea', required: true },
];

/** Day detail: calculated figures, plain-language explanation, admin trace, recalculate and adjust. */
function DayDetail({ row, onClose, onChanged }) {
  const { can } = useAuth();
  const toast = useToast();
  const [day, setDay] = useState({ loading: true });
  const [mode, setMode] = useState(null);
  const admin = can('attendance.manage');
  const date = String(row.date ?? row.attendance_date ?? '').slice(0, 10);
  const employee = row.employee_uuid ?? row.employee?.uuid;
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (!employee || !date) throw new Error('No calculated attendance exists for this day yet.');
        const d = await api(`${paths.days}/${employee}/${date}`);
        if (live) setDay({ data: d?.data ?? d });
      } catch (error) {
        if (live) setDay({ error });
      }
    })();
    return () => {
      live = false;
    };
  }, [row, date, employee]);
  const d = day.data;
  const scope = { scope: { employee_uuids: [employee] }, from: date, to: date };
  const explanation = d?.explanation;
  return (
    <Drawer open onClose={onClose} title={`${row.employee_name ?? row.name ?? 'Employee'} · ${date}`}>
      {day.loading && <Skeleton rows={3} />}
      {day.error && <ErrorState error={day.error} />}
      {d && (
        <div className="space-y-4 text-xs">
          {d.finalization === 'locked' && <LockedBanner>Locked: adjustments need an approved unlock first.</LockedBanner>}
          {d.finalization === 'processing' && <ProcessingBanner />}
          <dl className="m-0 grid grid-cols-2 gap-2">
            {[
              ['Status', <StatusBadge key="s" status={d.status} />],
              ['First in', time(d.first_in)],
              ['Last out', time(d.last_out)],
              ['Worked', minutes(d.net_minutes)],
              ['Required', minutes(d.required_minutes)],
              ['Late', minutes(d.late_minutes)],
              ['Overtime', minutes(d.overtime_minutes)],
              ['Confidence', titleCase(d.confidence) || '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
                <dd className="m-0 font-medium text-slate-800 dark:text-slate-100">{v}</dd>
              </div>
            ))}
          </dl>
          <section aria-label="Why this result">
            <h3 className="mb-1 text-sm">Why this result</h3>
            {Array.isArray(explanation?.steps ?? explanation) ? (
              <ol className="m-0 list-decimal pl-4">
                {(explanation.steps ?? explanation).map((s, i) => (
                  <li key={i}>{typeof s === 'string' ? s : (s.text ?? s.message ?? JSON.stringify(s))}</li>
                ))}
              </ol>
            ) : explanation ? (
              <p className="m-0">{explanation.summary ?? explanation.message ?? 'See the calculation trace.'}</p>
            ) : (
              <p className="m-0 text-slate-500">No explanation has been recorded for this calculation.</p>
            )}
          </section>
          {admin && explanation && (
            <details>
              <summary className="cursor-pointer font-semibold">Calculation trace (version {d.calculation_version ?? '—'})</summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-50 p-2 text-[11px] dark:bg-slate-950">{JSON.stringify(explanation, null, 2)}</pre>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            {can('attendance.process|attendance.manage') && (
              <Button variant="secondary" onClick={() => setMode('recalc')}>
                <RefreshCw size={14} /> Recalculate
              </Button>
            )}
            {can('attendance.adjust') && <Button onClick={() => setMode('adjust')}>Adjust</Button>}
          </div>
        </div>
      )}
      <PreviewConfirm
        open={mode === 'recalc'}
        onClose={() => setMode(null)}
        title="Recalculate this day"
        intro="Recalculation re-runs the rules on the stored punches. Nothing changes until you confirm."
        load={() => send('POST', paths.processPreview, scope)}
        onConfirm={async () => {
          await send('POST', paths.process, scope);
          toast('Recalculation queued');
          onChanged();
        }}
        confirmLabel="Recalculate"
      />
      <FormDialog
        open={mode === 'adjust'}
        onClose={() => setMode(null)}
        title="Adjust attendance"
        fields={ADJUST_FIELDS}
        notice={<Banner tone="info">Sensitive adjustments are held until a second person with adjustment-approval rights approves them (maker-checker). Locked days cannot be adjusted.</Banner>}
        onSubmit={async (body) => {
          const r = await send('POST', paths.adjustments, { employee, date, ...Object.fromEntries(Object.entries(body).filter(([, v]) => v !== null)) });
          const status = (r?.data ?? r)?.status;
          toast(status === 'pending_approval' ? 'Submitted: waiting for a second approver' : 'Adjustment applied');
          onChanged();
        }}
        submitLabel="Submit adjustment"
      />
    </Drawer>
  );
}

const columns = [
  { key: 'employee', label: 'Employee', priority: 'always', render: (r) => r.employee_name ?? r.name ?? r.employee ?? '—' },
  { key: 'date', label: 'Date', priority: 'always', render: (r) => String(r.date ?? r.attendance_date ?? '').slice(0, 10) },
  { key: 'status', label: 'Status', priority: 'always', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'shift', label: 'Shift', priority: 'md' },
  { key: 'first_in', label: 'In', priority: 'md', render: (r) => time(r.first_in) },
  { key: 'last_out', label: 'Out', priority: 'md', render: (r) => time(r.last_out) },
  { key: 'net_minutes', label: 'Worked', priority: 'md', render: (r) => minutes(r.net_minutes) },
  { key: 'required_minutes', label: 'Required', priority: 'lg', render: (r) => minutes(r.required_minutes) },
  { key: 'late_minutes', label: 'Late', priority: 'lg', render: (r) => (r.late_minutes ? minutes(r.late_minutes) : '—') },
  { key: 'early_exit_minutes', label: 'Early exit', priority: 'lg', render: (r) => (r.early_exit_minutes ? minutes(r.early_exit_minutes) : '—') },
  { key: 'overtime_minutes', label: 'Overtime', priority: 'lg', render: (r) => (r.overtime_minutes ? minutes(r.overtime_minutes) : '—') },
  { key: 'open_exceptions', label: 'Exceptions', priority: 'lg' },
  { key: 'finalization', label: 'State', priority: 'lg', render: (r) => <StatusBadge status={r.finalization} /> },
];
const mobile = {
  title: (r) => r.employee_name ?? r.name ?? r.employee,
  subtitle: (r) => `${String(r.date ?? '').slice(0, 10)} · ${r.shift ?? 'No shift'}`,
  badge: (r) => <StatusBadge status={r.status} />,
  facts: [
    { label: 'In', value: (r) => time(r.first_in) },
    { label: 'Out', value: (r) => time(r.last_out) },
    { label: 'Worked', value: (r) => minutes(r.net_minutes) },
    { label: 'Late', value: (r) => (r.late_minutes ? minutes(r.late_minutes) : '—') },
  ],
};

function DailyAttendancePage() {
  const [params] = useSearchParams();
  const toast = useToast();
  const start = params.get('date') || today();
  const blank = { from: start, to: start, q: '', department_id: '', location_id: '', shift_id: '', status: params.get('status') || '', exception_type: '', source: '' };
  const [f, setF] = useState(blank);
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true });
  const [detail, setDetail] = useState(null);
  const [views, setViews] = useState(() => loadViews('daily'));
  const [version, setVersion] = useState(0);
  const exporting = useAction();
  const q = useDebounced(f.q);
  const departments = useLookup('/organization/departments?per_page=100');
  const locations = useLookup('/organization/locations?per_page=100');
  const shifts = useLookup(`${paths.shifts}`);
  const set = (k) => (e) => {
    setF((s) => ({ ...s, [k]: e.target.value }));
    setPage(1);
  };
  useEffect(() => {
    api(paths.views).then((r) => listOf(r).length && setViews(listOf(r).filter((v) => v.report === 'daily'))).catch(() => {});
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true });
    api(`${paths.report('daily')}?${query({ ...f, q, page })}`, { signal: controller.signal })
      .then((data) => setState({ data }))
      .catch((error) => error.name !== 'AbortError' && setState({ error }));
    return () => controller.abort();
  }, [f.from, f.to, q, f.department_id, f.location_id, f.shift_id, f.status, f.exception_type, f.source, page, version]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveView() {
    const name = window.prompt('Name this view');
    if (!name) return;
    const view = { name, report: 'daily', filters: { ...f, q: undefined } };
    try {
      const saved = await send('POST', paths.views, view);
      setViews((v) => [...v, saved?.data ?? saved]);
    } catch {
      const next = [...views, view];
      setViews(next);
      storeViews('daily', next);
    }
    toast('View saved');
  }
  async function exportIt() {
    const ok = await exporting.run(() => send('POST', paths.reportExport('daily'), { format: 'csv', ...Object.fromEntries(Object.entries({ ...f, q }).filter(([, v]) => v)) }));
    ok && toast('Export queued. Download it from Reports when it is ready.');
  }
  const rows = state.data ? listOf(state.data) : [];
  const pg = state.data && pageOf(state.data);
  return (
    <Screen
      title="Daily attendance"
      description="Calculated attendance per employee per day."
      permission="attendance.manage|attendance.reports.view|attendance.team.view"
      action={
        <Button variant="secondary" onClick={exportIt} loading={exporting.busy}>
          <Download size={14} /> Export CSV
        </Button>
      }
    >
      <Card>
        <FilterBar>
          <Search value={f.q} onChange={(v) => { setF((s) => ({ ...s, q: v })); setPage(1); }} placeholder="Search name or number" />
          <Input label="From" type="date" value={f.from} onChange={set('from')} />
          <Input label="To" type="date" value={f.to} min={f.from} onChange={set('to')} />
          <Select label="Department" options={toOptions(departments)} value={f.department_id} onChange={set('department_id')} />
          <Select label="Location" options={toOptions(locations)} value={f.location_id} onChange={set('location_id')} />
          <Select label="Shift" options={toOptions(shifts)} value={f.shift_id} onChange={set('shift_id')} />
          <Select label="Status" options={opt(STATUSES, 'All')} value={f.status} onChange={set('status')} />
          <Select label="Exception" options={opt(EXCEPTIONS, 'Any')} value={f.exception_type} onChange={set('exception_type')} />
          <Select label="Source" options={opt(SOURCES, 'Any')} value={f.source} onChange={set('source')} />
          <Select
            label="Saved view"
            options={[{ value: '', label: 'Choose…' }, ...views.map((v, i) => ({ value: String(i), label: v.name }))]}
            value=""
            onChange={(e) => {
              const v = views[Number(e.target.value)];
              if (v) {
                setF({ ...blank, ...v.filters });
                setPage(1);
              }
            }}
          />
          <Button variant="secondary" onClick={saveView}>
            <Bookmark size={14} /> Save view
          </Button>
        </FilterBar>
        {exporting.error && <div className="px-5 pt-3"><Banner tone="error" title="Export failed">{exporting.error.message}</Banner></div>}
        {state.loading ? (
          <Skeleton />
        ) : state.error ? (
          <ErrorState error={state.error} onRetry={() => setVersion((v) => v + 1)} />
        ) : (
          <>
            <ResponsiveList
              label="Daily attendance"
              columns={columns}
              rows={rows}
              mobile={mobile}
              rowKey={(r) => r.uuid ?? `${r.employee_uuid ?? r.employee_name}-${r.date}`}
              onRowClick={setDetail}
              empty={{ title: 'No attendance for these filters', description: 'Widen the date range or clear a filter. Days appear once attendance is processed.' }}
            />
            <Pagination data={pg} onChange={setPage} />
          </>
        )}
      </Card>
      {detail && <DayDetail row={detail} onClose={() => setDetail(null)} onChanged={() => { setDetail(null); setVersion((v) => v + 1); }} />}
    </Screen>
  );
}

export default guarded(DailyAttendancePage, { title: 'Daily attendance', permission: 'attendance.manage|attendance.reports.view|attendance.team.view' });
