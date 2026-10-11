import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button, Card, ErrorState, FormError, Input, Skeleton, useToast } from '../../../components/ui';
import ResponsiveList from '../../../components/ResponsiveList';
import { Banner, Screen, StatusBadge, guarded } from '../../../components/timeoffice/parts';
import { ConfirmPreview, Section, Tiles } from '../../../components/leave/hr/kit';
import { useAuth } from '../../../lib/auth';
import { useResource } from '../../../lib/hooks';
import { api } from '../../../lib/api';
import { dateOnly, paths, query, send, titleCase, unwrap, units, useAction } from '../../../lib/leaveHrApi';

const monthRange = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: from.toLocaleDateString('en-CA'), to: to.toLocaleDateString('en-CA') };
};
const LIMIT = 100;

function Lines({ lines }) {
  return (
    <ResponsiveList
      label="Payroll lines"
      rows={lines.slice(0, LIMIT)}
      rowKey={(l, i) => `${l.employee_uuid}-${l.leave_type_code}-${l.pay_class}-${l.request_id}`}
      columns={[
        { key: 'employee_number', label: 'Employee' },
        { key: 'leave_type_code', label: 'Type' },
        { key: 'pay_class', label: 'Pay class', render: (l) => titleCase(l.pay_class) },
        { key: 'units', label: 'Units', render: (l) => units(l.units) },
        { key: 'late_adjustment', label: 'Late', priority: 'md', render: (l) => (l.late_adjustment ? 'Late adjustment' : '—') },
        { key: 'period', label: 'Period', priority: 'lg', render: (l) => `${dateOnly(l.period_start)} to ${dateOnly(l.period_end)}` },
      ]}
      mobile={{ title: 'employee_number', subtitle: (l) => `${l.leave_type_code} · ${titleCase(l.pay_class)}`, badge: (l) => (l.late_adjustment ? <StatusBadge status="warning">Late</StatusBadge> : null), facts: [{ label: 'Units', value: (l) => units(l.units) }] }}
      empty={{ title: 'No leave lines', description: 'No approved leave falls in this period.' }}
    />
  );
}

function Contract({ data, extra }) {
  const lines = data.lines ?? [];
  return (
    <>
      <Tiles items={[{ label: 'Employees', value: data.employees }, { label: 'Lines', value: lines.length }, ...Object.entries(data.totals ?? {}).map(([k, v]) => ({ label: titleCase(k), value: units(v) }))]} />
      {(data.warnings ?? []).map((w) => (
        <Banner key={w.key} tone="warn" title={titleCase(w.key)}>{w.message}{w.count != null && ` (${w.count})`}</Banner>
      ))}
      {extra}
      <Lines lines={lines} />
      {lines.length > LIMIT && <p className="text-xs">Showing the first {LIMIT} of {lines.length} lines. Export the payroll_lines report for all of them.</p>}
    </>
  );
}

function PayrollPageInner() {
  const { can } = useAuth();
  const toast = useToast();
  const [range, setRange] = useState(monthRange);
  const [applied, setApplied] = useState(range);
  const [batchKey, setBatchKey] = useState('');
  const [publish, setPublish] = useState(false);
  const [batch, setBatch] = useState(null);
  const lookup = useAction();
  const q = query(applied);
  const cutoff = useResource(`${paths.payrollCutoff}?${q}`);
  const contract = useResource(`${paths.payrollContract}?${q}`);
  const co = cutoff.data ? unwrap(cutoff.data) : null;
  const ct = contract.data ? unwrap(contract.data) : null;
  const manage = can('leave.manage');
  return (
    <Screen
      title="Payroll contract"
      description="Leave units by pay class for a period, ready for payroll. References and units only, never money."
      permission="leave.manage|leave.reports.view"
    >
      <Card className="mb-5">
        <Section>
          <form className="grid items-end gap-x-4 pt-5 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); setApplied(range); setBatch(null); }}>
            <Input label="Period from" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            <Input label="Period to" type="date" min={range.from} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            <div className="mb-5"><Button type="submit" variant="secondary">Show period</Button></div>
          </form>
        </Section>
      </Card>
      <Card title="Cutoff" className="mb-5">
        <Section>
          {cutoff.loading ? <Skeleton rows={1} /> : cutoff.error ? <ErrorState error={cutoff.error} onRetry={cutoff.reload} /> : co.configured ? (
            <p className="m-0 text-xs">Cutoff is <strong>{dateOnly(co.cutoff_date)}</strong> (day {co.cutoff_day} of the following month) <StatusBadge status={co.status === 'passed' ? 'warning' : 'active'}>{titleCase(co.status)}</StatusBadge></p>
          ) : (
            <Banner tone="warn" title="Cutoff not configured">Set the leave integration cutoff day, or the attendance payroll cutoff, so late changes can be flagged.</Banner>
          )}
        </Section>
      </Card>
      <Card
        title="Live contract"
        className="mb-5"
        action={manage && <Button disabled={!ct || contract.loading} onClick={() => setPublish(true)}><Send size={14} /> Publish batch</Button>}
      >
        <Section>
          {contract.loading ? <Skeleton /> : contract.error ? <ErrorState error={contract.error} onRetry={contract.reload} /> : <Contract data={ct} />}
          {manage && (
            <Input label="Batch key (optional)" hint="Publishing the same key again replaces that snapshot." value={batchKey} onChange={(e) => setBatchKey(e.target.value)} />
          )}
        </Section>
      </Card>
      <Card title="Published batch lookup" className="mb-5">
        <Section>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await lookup.run(async () => unwrap(await api(paths.payrollBatch(batchKey))));
              if (r) setBatch(r);
            }}
          >
            <div className="min-w-48 flex-1"><Input label="Batch key" required value={batchKey} onChange={(e) => setBatchKey(e.target.value)} /></div>
            <div className="mb-5"><Button type="submit" variant="secondary" loading={lookup.busy}>Open batch</Button></div>
          </form>
          <FormError error={lookup.error} />
          {batch && <Contract data={batch} extra={<p className="text-xs">Snapshot <strong>{batch.batch_key}</strong> is immutable.</p>} />}
        </Section>
      </Card>
      <ConfirmPreview
        open={publish}
        onClose={() => setPublish(false)}
        title="Publish payroll batch"
        intro="Stores an immutable snapshot of these lines for payroll. Review the warnings first."
        load={async () => unwrap(await api(`${paths.payrollContract}?${q}`))}
        ack={(d) => ((d.warnings ?? []).length ? 'I have reviewed the warnings and want to publish anyway.' : null)}
        confirmLabel="Publish batch"
        onConfirm={async () => {
          const r = unwrap(await send('POST', paths.payrollBatches, { ...applied, ...(batchKey ? { batch_key: batchKey } : {}) }));
          toast(`Batch ${r?.batch_key ?? ''} published`);
        }}
      >
        {(d) => <Contract data={{ ...d, lines: [] }} />}
      </ConfirmPreview>
    </Screen>
  );
}

export default guarded(PayrollPageInner, { title: 'Payroll contract', permission: 'leave.manage|leave.reports.view' });
