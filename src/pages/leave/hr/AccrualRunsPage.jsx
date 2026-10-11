import { useState } from 'react';
import { Download, Play } from 'lucide-react';
import { Button, ErrorState, Modal, Skeleton, useToast } from '../../../components/ui';
import ResponsiveList from '../../../components/ResponsiveList';
import { FormDialog } from '../../../components/timeoffice/CrudPanel';
import { Banner, PartialFailure, ProcessingBanner, Screen, StatusBadge, guarded } from '../../../components/timeoffice/parts';
import { ConfirmPreview, ListCard, Tiles } from '../../../components/leave/hr/kit';
import { useAuth } from '../../../lib/auth';
import { api, download } from '../../../lib/api';
import { addDays, dateOnly, listOf, paths, query, send, splitIds, titleCase, today, unwrap, units, usePoll, useAction, useList } from '../../../lib/leaveHrApi';

const BUSY = ['queued', 'running'];
const rid = (r) => r.id ?? r.uuid;
const win = (r) => (r.window ? `${dateOnly(r.window.from)} to ${dateOnly(r.window.to)}` : `${dateOnly(r.from)} to ${dateOnly(r.to)}`);

function ItemsTable({ items }) {
  return (
    <ResponsiveList
      label="Run items"
      rows={items}
      rowKey={(i) => `${i.employee?.uuid ?? i.employee?.id ?? i.employee}-${i.leave_type?.code ?? i.leave_type}-${i.status}`}
      columns={[
        { key: 'employee', label: 'Employee', render: (i) => i.employee?.name ?? i.employee?.employee_number ?? String(i.employee ?? '—') },
        { key: 'leave_type', label: 'Type', render: (i) => i.leave_type?.code ?? String(i.leave_type ?? '—') },
        { key: 'units', label: 'Units', render: (i) => units(i.units) },
        { key: 'status', label: 'Result', render: (i) => <StatusBadge status={i.status} /> },
        { key: 'reason', label: 'Reason', priority: 'md', render: (i) => i.reason ?? '—' },
      ]}
      mobile={{ title: (i) => i.employee?.name ?? i.employee?.employee_number ?? 'Employee', subtitle: (i) => i.leave_type?.code ?? String(i.leave_type ?? ''), badge: (i) => <StatusBadge status={i.status} />, facts: [{ label: 'Units', value: (i) => units(i.units) }, { label: 'Reason', value: (i) => i.reason ?? '—' }] }}
      empty={{ title: 'Nothing to show', description: 'No items in this run.' }}
    />
  );
}

function RunDetail({ run, onClose, onChanged }) {
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const errors = useList(`${paths.accrualRun(rid(run), 'errors')}?v=${version}`);
  const act = useAction();
  const c = run.counts ?? {};
  return (
    <Modal open onClose={onClose} title={`Accrual run ${win(run)}`}>
      <Tiles items={[{ label: 'Total', value: c.total }, { label: 'Posted', value: c.posted }, { label: 'Skipped', value: c.skipped }, { label: 'Failed', value: c.failed, tone: c.failed > 0 ? 'warn' : undefined }]} />
      {run.error && <Banner tone="error" title="Run error">{run.error}</Banner>}
      <PartialFailure failed={c.failed} total={c.total} />
      {act.error && <Banner tone="error">{act.error.message}</Banner>}
      <h3 className="mb-2 text-sm">Failed and skipped items</h3>
      {errors.loading ? <Skeleton rows={2} /> : errors.error ? <ErrorState error={errors.error} onRetry={errors.reload} /> : <ItemsTable items={errors.rows} />}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => download(`${paths.accrualRun(rid(run), 'errors')}?format=csv`, 'accrual-errors.csv').catch((e) => toast(e.message, 'error'))}><Download size={14} /> Error file</Button>
        {c.failed > 0 && (
          <Button
            loading={act.busy}
            onClick={async () => {
              if (await act.run(() => send('POST', paths.accrualRun(rid(run), 'retry')))) {
                toast('Retrying failed items only');
                setVersion((v) => v + 1);
                onChanged();
              }
            }}
          >
            Retry failed items
          </Button>
        )}
      </div>
    </Modal>
  );
}

function AccrualRunsPageInner() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useList(paths.accrualRuns);
  const types = useList(`${paths.types}?active_only=1`);
  const [form, setForm] = useState(false);
  const [request, setRequest] = useState(null);
  const [selected, setSelected] = useState(null);
  const run = can('leave.accrual.run|leave.manage');
  const busy = list.rows.some((r) => BUSY.includes(r.status));
  usePoll(busy, list.reload, [list.data]);
  const fields = [
    { name: 'from', label: 'From', type: 'date', required: true, default: addDays(today(), -30) },
    { name: 'to', label: 'To', type: 'date', required: true, default: today() },
    { name: 'leave_types', label: 'Leave types (none selected means all)', type: 'multi', options: types.rows.map((t) => ({ value: t.uuid, label: t.name })) },
    { name: 'employees', label: 'Employee IDs (optional)', type: 'textarea', hint: 'Employee uuids separated by commas or spaces. Empty means everyone in scope.' },
  ];
  const toRequest = (b) => ({ from: b.from, to: b.to, ...(b.leave_types?.length ? { leave_types: b.leave_types } : {}), ...(splitIds(b.employees).length ? { employees: splitIds(b.employees) } : {}) });
  const columns = [
    { key: 'window', label: 'Window', render: win },
    { key: 'mode', label: 'Mode', priority: 'md', render: (r) => titleCase(r.mode) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'counts', label: 'Posted / failed / total', render: (r) => `${r.counts?.posted ?? 0} / ${r.counts?.failed ?? 0} / ${r.counts?.total ?? 0}` },
    { key: 'skipped', label: 'Skipped', priority: 'lg', render: (r) => r.counts?.skipped ?? 0 },
  ];
  return (
    <Screen
      title="Accrual runs"
      description="Credit entitlements for a window. Always preview first: a preview writes nothing to the ledger."
      permission="leave.accrual.run|leave.manage"
      action={run && <Button onClick={() => setForm(true)}><Play size={14} /> New accrual run</Button>}
    >
      {busy && <ProcessingBanner>A run is in progress. This list refreshes automatically.</ProcessingBanner>}
      <ListCard
        title="Runs"
        list={list}
        columns={columns}
        rowKey={(r) => rid(r)}
        onRowClick={setSelected}
        mobile={{ title: win, subtitle: (r) => titleCase(r.mode), badge: (r) => <StatusBadge status={r.status} />, facts: [{ label: 'Posted', value: (r) => r.counts?.posted ?? 0 }, { label: 'Failed', value: (r) => r.counts?.failed ?? 0 }] }}
        empty={{ title: 'No runs yet', description: 'Nightly accrual runs and manual runs appear here.' }}
      />
      <FormDialog open={form} onClose={() => setForm(false)} title="New accrual run" fields={fields} submitLabel="Preview run" onSubmit={async (b) => setRequest(toRequest(b))} />
      <ConfirmPreview
        open={Boolean(request)}
        onClose={() => setRequest(null)}
        title="Confirm accrual run"
        intro="This posts credits to employee ledgers. Re-running the same window never double-credits."
        load={async () => {
          const r = unwrap(await send('POST', paths.accrualPreview, request));
          const items = listOf(await api(`${paths.accrualRun(rid(r), 'items')}?${query({ status: '' })}`).catch(() => ({ data: [] })));
          return { run: r, items };
        }}
        blocked={(d) => (d.run.counts?.total === 0 ? 'Nothing would be accrued for this window.' : null)}
        confirmLabel="Run accrual"
        onConfirm={async (d) => {
          await send('POST', paths.accrualRun(rid(d.run), 'execute'));
          toast('Accrual run started');
          list.reload();
        }}
      >
        {(d) => (
          <>
            <Tiles items={[{ label: 'Will post', value: d.run.counts?.total ?? d.items.length }, { label: 'Window', value: win(d.run) }, { label: 'Skipped', value: d.run.counts?.skipped ?? 0 }, { label: 'Failed', value: d.run.counts?.failed ?? 0, tone: d.run.counts?.failed > 0 ? 'warn' : undefined }]} />
            <div className="max-h-64 overflow-y-auto"><ItemsTable items={d.items.slice(0, 50)} /></div>
            {d.items.length > 50 && <p className="text-xs">Showing the first 50 of {d.items.length} items.</p>}
          </>
        )}
      </ConfirmPreview>
      {selected && <RunDetail run={selected} onClose={() => setSelected(null)} onChanged={list.reload} />}
    </Screen>
  );
}

export default guarded(AccrualRunsPageInner, { title: 'Accrual runs', permission: 'leave.accrual.run|leave.manage' });
