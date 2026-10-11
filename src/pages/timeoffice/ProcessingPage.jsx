import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, Card, ErrorState, Skeleton, useToast } from '../../components/ui';
import ResponsiveList from '../../components/ResponsiveList';
import { Banner, PartialFailure, ProcessingBanner, Progress, Screen, StatusBadge, guarded } from '../../components/timeoffice/parts';
import { PreviewConfirm } from '../../components/timeoffice/dialogs';
import { FormDialog } from '../../components/timeoffice/CrudPanel';
import { useAuth } from '../../lib/auth';
import { paths, send, time, titleCase, toOptions, useList, useLookup, addDays, today } from '../../lib/timeOfficeApi';

const ACTIVE = ['queued', 'running', 'processing'];

function ProcessingPagePage() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useList(paths.processRuns);
  const departments = useLookup('/organization/departments?per_page=100');
  const locations = useLookup('/organization/locations?per_page=100');
  const [form, setForm] = useState(false);
  const [request, setRequest] = useState(null);
  const [selected, setSelected] = useState(null);
  const running = list.rows.some((r) => ACTIVE.includes(r.status));
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(list.reload, 3000);
    return () => clearTimeout(t);
  }, [running, list.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const fields = [
    { name: 'who', label: 'Who', type: 'select', default: 'tenant', options: [{ value: 'tenant', label: 'Everyone I can see' }, { value: 'department', label: 'One department' }, { value: 'location', label: 'One location' }, { value: 'employees', label: 'Specific employees' }] },
    { name: 'department_id', label: 'Department', type: 'select', options: toOptions(departments, 'Choose…'), showIf: (v) => v.who === 'department' },
    { name: 'location_id', label: 'Location', type: 'select', options: toOptions(locations, 'Choose…'), showIf: (v) => v.who === 'location' },
    { name: 'employees', label: 'Employee IDs', hint: 'Separate with commas or spaces.', showIf: (v) => v.who === 'employees' },
    { name: 'from', label: 'From', type: 'date', required: true, default: addDays(today(), -7) },
    { name: 'to', label: 'To', type: 'date', required: true, default: today() },
  ];
  const toRequest = (b) => ({
    from: b.from,
    to: b.to || b.from,
    scope:
      b.who === 'department' ? { department_id: Number(b.department_id) } : b.who === 'location' ? { location_id: Number(b.location_id) } : b.who === 'employees' ? { employee_uuids: String(b.employees ?? '').split(/[\s,]+/).filter(Boolean) } : { tenant: true },
  });
  const columns = [
    { key: 'created_at', label: 'Started', render: (r) => `${String(r.created_at ?? '').slice(0, 10)} ${time(r.created_at)}` },
    { key: 'trigger', label: 'Trigger', priority: 'md', render: (r) => titleCase(r.trigger) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'progress', label: 'Progress', render: (r) => (<span className="block min-w-28"><Progress value={r.processed_days + r.failed_days + (r.skipped_locked ?? 0)} max={r.total_days} label={`Run progress ${r.processed_days} of ${r.total_days}`} /><span className="text-[11px]">{r.processed_days} of {r.total_days} days</span></span>) },
    { key: 'failed_days', label: 'Failed', priority: 'md' },
    { key: 'skipped_locked', label: 'Locked, skipped', priority: 'lg' },
  ];
  const mobile = { title: (r) => `${String(r.created_at ?? '').slice(0, 10)} ${time(r.created_at)}`, subtitle: (r) => titleCase(r.trigger), badge: (r) => <StatusBadge status={r.status} />, facts: [{ label: 'Done', value: (r) => `${r.processed_days}/${r.total_days}` }, { label: 'Failed', value: 'failed_days' }, { label: 'Skipped (locked)', value: 'skipped_locked' }] };
  return (
    <Screen
      title="Processing"
      description="Attendance calculation runs. Recalculate a date range after fixing punches, rosters or policies."
      permission="attendance.process|attendance.manage"
      action={can('attendance.process') && <Button onClick={() => setForm(true)}><RefreshCw size={14} /> Recalculate</Button>}
    >
      {running && <ProcessingBanner>A run is in progress. This list refreshes automatically.</ProcessingBanner>}
      <Card>
        {list.loading ? (
          <Skeleton />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : (
          <ResponsiveList label="Processing runs" columns={columns} rows={list.rows} mobile={mobile} rowKey={(r) => r.uuid} onRowClick={setSelected} empty={{ title: 'No runs yet', description: 'Runs appear here when attendance is calculated.' }} />
        )}
      </Card>
      {selected && (
        <div className="mt-5">
          <Card title={`Run ${String(selected.created_at ?? '').slice(0, 10)}`} action={<Button variant="ghost" aria-label="Close run details" onClick={() => setSelected(null)}>Close</Button>}>
            <div className="px-6 pb-5">
              <PartialFailure failed={selected.failed_days} total={selected.total_days} items={selected.errors ?? []} />
              {selected.skipped_locked > 0 && <Banner tone="warn" title="Locked days were skipped">{selected.skipped_locked} locked day(s) were not recalculated. Unlock the period first if they must change.</Banner>}
              {!selected.failed_days && !selected.skipped_locked && <Banner tone="success" title="Run completed without problems" />}
            </div>
          </Card>
        </div>
      )}
      <FormDialog open={form} onClose={() => setForm(false)} title="Recalculate attendance" fields={fields} submitLabel="Preview impact" onSubmit={async (b) => setRequest(toRequest(b))} />
      <PreviewConfirm
        open={Boolean(request)}
        onClose={() => setRequest(null)}
        title="Confirm recalculation"
        intro="Recalculation replaces calculated results with new ones. Locked days are skipped. Nothing runs until you confirm."
        load={() => send('POST', paths.processPreview, request)}
        onConfirm={async () => {
          await send('POST', paths.process, request);
          toast('Recalculation started');
          list.reload();
        }}
        confirmLabel="Start recalculation"
      />
    </Screen>
  );
}

export default guarded(ProcessingPagePage, { title: 'Processing', permission: 'attendance.process|attendance.manage' });
