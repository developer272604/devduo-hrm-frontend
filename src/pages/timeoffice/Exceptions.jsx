import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, ErrorState, FilterBar, Input, Pagination, Select, Skeleton, useToast } from '../../components/ui';
import ResponsiveList from '../../components/ResponsiveList';
import { Screen, StatusBadge, guarded } from '../../components/timeoffice/parts';
import { ReasonDialog } from '../../components/timeoffice/dialogs';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import { paths, pageOf, listOf, send, titleCase, today, addDays } from '../../lib/timeOfficeApi';

const SEVERITIES = ['', 'critical', 'action_required', 'warning', 'info'];
const STATUS = ['open', 'acknowledged', 'resolved', 'dismissed', ''];
const DONE = { acknowledge: 'acknowledged', resolve: 'resolved', dismiss: 'dismissed', reopen: 'reopened' };
const opt = (list, empty) => list.map((v) => ({ value: v, label: v ? titleCase(v) : empty }));

function ExceptionsPage() {
  const [params] = useSearchParams();
  const { can } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ status: 'open', severity: '', from: addDays(today(), -14), to: today() });
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null); // {row, action}
  const types = (params.get('type') || '').split(',').filter(Boolean);
  const qs = new URLSearchParams();
  Object.entries({ ...f, page }).forEach(([k, v]) => v && qs.set(k, v));
  types.forEach((t) => qs.append('type[]', t));
  const resource = useResource(`${paths.exceptions}?${qs}`);
  const canAct = can('attendance.manage|attendance.approve');
  const act = async (row, action, resolution) => {
    await send('POST', `${paths.exceptions}/${row.uuid}/${action}`, resolution ? { resolution } : undefined);
    toast(`Exception ${DONE[action]}`);
    resource.reload();
  };
  const actions = (row) =>
    canAct ? (
      <span className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
        {row.status === 'open' && <Button variant="secondary" onClick={() => act(row, 'acknowledge')}>Acknowledge</Button>}
        {['open', 'acknowledged'].includes(row.status) && <Button variant="secondary" onClick={() => setDialog({ row, action: 'resolve' })}>Resolve</Button>}
        {['open', 'acknowledged'].includes(row.status) && <Button variant="secondary" onClick={() => setDialog({ row, action: 'dismiss' })}>Dismiss</Button>}
        {['resolved', 'dismissed', 'acknowledged'].includes(row.status) && <Button variant="secondary" onClick={() => act(row, 'reopen')}>Reopen</Button>}
      </span>
    ) : null;
  const columns = [
    { key: 'employee', label: 'Employee', render: (r) => r.employee?.name ?? '—' },
    { key: 'title', label: 'Exception', render: (r) => r.title ?? titleCase(r.type) },
    { key: 'attendance_date', label: 'Date', priority: 'md' },
    { key: 'severity', label: 'Severity', priority: 'md', render: (r) => <StatusBadge status={r.severity} /> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'priority_reason', label: 'Why it matters', priority: 'lg' },
    { key: 'actions', label: 'Actions', render: actions },
  ];
  const mobile = {
    title: (r) => r.employee?.name,
    subtitle: (r) => `${r.title ?? titleCase(r.type)} · ${r.attendance_date}`,
    badge: (r) => <StatusBadge status={r.severity} />,
    facts: [{ label: 'Status', value: (r) => titleCase(r.status) }, { label: 'Why', value: (r) => r.priority_reason }],
  };
  const set = (k) => (e) => {
    setF((s) => ({ ...s, [k]: e.target.value }));
    setPage(1);
  };
  return (
    <Screen title="Exceptions" description="Attendance issues ranked by severity. Resolve or dismiss each with a note." permission="attendance.manage|attendance.team.view">
      <Card>
        <FilterBar>
          <Select label="Status" options={opt(STATUS, 'All')} value={f.status} onChange={set('status')} />
          <Select label="Severity" options={opt(SEVERITIES, 'Any')} value={f.severity} onChange={set('severity')} />
          <Input label="From" type="date" value={f.from} onChange={set('from')} />
          <Input label="To" type="date" value={f.to} onChange={set('to')} />
          {types.length > 0 && <span className="text-xs text-slate-500">Filtered to {types.map(titleCase).join(', ')}</span>}
        </FilterBar>
        {resource.loading ? (
          <Skeleton />
        ) : resource.error ? (
          <ErrorState error={resource.error} onRetry={resource.reload} />
        ) : (
          <>
            <ResponsiveList label="Exceptions" columns={columns} rows={listOf(resource.data)} mobile={mobile} empty={{ title: 'No exceptions', description: 'Nothing needs attention for these filters.' }} />
            <Pagination data={pageOf(resource.data)} onChange={setPage} />
          </>
        )}
      </Card>
      <ReasonDialog
        open={Boolean(dialog)}
        onClose={() => setDialog(null)}
        title={dialog?.action === 'resolve' ? 'Resolve exception' : 'Dismiss exception'}
        label={dialog?.action === 'resolve' ? 'How was this resolved?' : 'Why does this need no action?'}
        confirmLabel={dialog?.action === 'resolve' ? 'Resolve' : 'Dismiss'}
        onConfirm={(text) => act(dialog.row, dialog.action, text)}
      />
    </Screen>
  );
}

export default guarded(ExceptionsPage, { title: 'Exceptions', permission: 'attendance.manage|attendance.team.view' });
