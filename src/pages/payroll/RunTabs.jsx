import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Drawer, ErrorState, Skeleton, useToast } from '../../components/ui';
import { Amount, Banner, ConfirmPreview, FormModal, ListCard, Section, StatusBadge, Tiles, useDo } from '../../components/payroll/kit';
import { PayslipSnapshot } from './SelfPages';
import { useResource } from '../../lib/hooks';
import { api } from '../../lib/api';
import { listOf, newKey, paths, send, titleCase, today, unwrap, useList, useLookup } from '../../lib/payrollApi';

const empName = (r) => r.employee_name ?? r.name ?? r.employee?.name ?? r.employee_number ?? 'Employee';
const empId = (r) => r.employee_uuid ?? r.employee?.uuid ?? r.uuid;

export function RosterTab({ run, canRun, locked }) {
  const nav = useNavigate();
  const list = useList(paths.run(run.uuid, 'employees'));
  const [change, setChange] = useState(null);
  const open = (r) => nav(`/payroll/runs/${run.uuid}/employees/${empId(r)}`);
  const actions = (r) =>
    canRun &&
    !locked && (
      <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        {r.status === 'excluded' || r.status === 'held' ? (
          <Button variant="secondary" className="min-h-8! px-2! py-1!" onClick={() => setChange({ r, action: 'include' })}>Include</Button>
        ) : (
          <>
            <Button variant="secondary" className="min-h-8! px-2! py-1!" onClick={() => setChange({ r, action: 'held' })}>Hold</Button>
            <Button variant="secondary" className="min-h-8! px-2! py-1!" onClick={() => setChange({ r, action: 'excluded' })}>Exclude</Button>
          </>
        )}
      </span>
    );
  return (
    <>
      <ListCard
        title="Roster"
        list={list}
        onRowClick={open}
        rowKey={empId}
        columns={[
          { key: 'name', label: 'Employee', render: empName },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          { key: 'pay', label: 'Pay window', priority: 'md', render: (r) => (r.snapshot ? `${r.snapshot.pay_from} to ${r.snapshot.pay_to}` : '—') },
          { key: 'flags', label: 'Flags', priority: 'lg', render: (r) => ['joiner', 'leaver', 'transfer_in', 'transfer_out'].filter((k) => r.snapshot?.[k]).map(titleCase).join(', ') || '—' },
          { key: 'net', label: 'Net', render: (r) => <Amount value={r.result?.net} currency={r.result?.currency} /> },
          { key: 'act', label: '', render: actions },
        ]}
        card={(r) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <strong className="text-sm">{empName(r)}</strong>
              <StatusBadge value={r.status} />
            </div>
            <p className="m-0 text-xs text-slate-500">
              Net <Amount value={r.result?.net} currency={r.result?.currency} />
            </p>
            <div className="mt-2">{actions(r)}</div>
          </div>
        )}
        empty={{ title: 'No employees in this run', description: 'Check the pay group assignments for this period.' }}
      />
      <FormModal
        open={Boolean(change)}
        onClose={() => setChange(null)}
        title={change ? `${titleCase(change.action)}: ${empName(change.r)}` : ''}
        fields={change?.action === 'include' ? [] : [{ name: 'reason', label: 'Reason', textarea: true }]}
        intro={change?.action === 'include' ? 'The employee will be part of the next calculation.' : 'The employee will not be paid in this run until included again.'}
        onSubmit={async (v) => {
          await send('PATCH', paths.runEmployee(run.uuid, empId(change.r)), { action: change.action, ...(v.reason ? { reason: v.reason } : {}) });
          list.reload();
        }}
        success="Roster updated"
      />
    </>
  );
}

export function ValidationsTab({ run, canWaive }) {
  const res = useResource(paths.run(run.uuid, 'validations'));
  const [waive, setWaive] = useState(null);
  const rows = res.data ? listOf(res.data) : [];
  const summary = res.data?.summary;
  const { busy, run: act } = useDo();
  return (
    <>
      {summary && (
        <Tiles
          items={[
            { label: 'Open', value: summary.open },
            { label: 'Blocking', value: summary.blocking, tone: summary.blocking > 0 ? 'warn' : undefined },
            { label: 'Critical', value: summary.critical, tone: summary.critical > 0 ? 'warn' : undefined },
            { label: 'Warnings', value: summary.warnings },
          ]}
        />
      )}
      <div className="mb-3">
        <Button
          variant="secondary"
          loading={busy === 'validate'}
          onClick={async () => (await act('validate', () => send('POST', paths.run(run.uuid, 'validate'), {}), 'Validation refreshed')) && res.reload()}
        >
          Re-run validation
        </Button>
      </div>
      <ListCard
        title="Findings"
        list={{ loading: res.loading, error: res.error, reload: res.reload, rows }}
        columns={[
          { key: 'severity', label: 'Severity', render: (r) => <StatusBadge value={r.severity} /> },
          { key: 'code', label: 'Check', render: (r) => titleCase(r.code) },
          { key: 'message', label: 'Message' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          { key: 'act', label: '', render: (r) => canWaive && r.status === 'open' && r.severity !== 'critical' && <Button variant="secondary" className="min-h-8! px-2! py-1!" onClick={() => setWaive(r)}>Waive</Button> },
        ]}
        card={(r) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <strong className="text-sm">{titleCase(r.code)}</strong>
              <StatusBadge value={r.severity} />
            </div>
            <p className="m-0 text-xs">{r.message}</p>
            {canWaive && r.status === 'open' && r.severity !== 'critical' && (
              <div className="mt-2">
                <Button variant="secondary" className="min-h-8! px-2! py-1!" onClick={() => setWaive(r)}>Waive</Button>
              </div>
            )}
          </div>
        )}
        empty={{ title: 'No findings', description: 'Validation found nothing to review.' }}
      />
      <FormModal
        open={Boolean(waive)}
        onClose={() => setWaive(null)}
        title="Waive finding"
        intro={waive?.message}
        fields={[{ name: 'note', label: 'Why is this acceptable?', textarea: true }]}
        submitLabel="Waive finding"
        onSubmit={async (v) => {
          await send('POST', paths.waive(waive.uuid), { note: v.note });
          res.reload();
        }}
        success="Finding waived"
      />
    </>
  );
}

export function TotalsTab({ run }) {
  const res = useResource(paths.run(run.uuid, 'totals'));
  if (res.loading) return <Skeleton rows={2} />;
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  const t = unwrap(res.data)?.stored ?? unwrap(res.data);
  const cur = t.currency;
  return (
    <>
      <Tiles
        items={[
          { label: 'Employees', value: t.employees },
          { label: 'Gross', value: <Amount value={t.gross} currency={cur} /> },
          { label: 'Deductions', value: <Amount value={t.total_deductions} currency={cur} /> },
          { label: 'Taxes', value: <Amount value={t.total_taxes} currency={cur} /> },
          { label: 'Reimbursements', value: <Amount value={t.reimbursements} currency={cur} /> },
          { label: 'Employer contributions', value: <Amount value={t.employer_contributions} currency={cur} /> },
          { label: 'Net pay', value: <Amount value={t.net} currency={cur} /> },
          { label: 'Employer cost', value: <Amount value={t.employer_cost} currency={cur} /> },
        ]}
      />
      {t.reconciled === false ? <Banner tone="error" title="Totals do not reconcile">The stored totals differ from the live recalculation. Do not lock until this is resolved.</Banner> : <Banner tone="success">Totals reconcile with the stored results.</Banner>}
    </>
  );
}

export function PayslipsTab({ run, canManage }) {
  const toast = useToast();
  const list = useList(paths.runPayslips(run.uuid));
  const [view, setView] = useState(null);
  const [withdraw, setWithdraw] = useState(null);
  const [publishAll, setPublishAll] = useState(false);
  const { busy, run: act } = useDo();
  const ready = ['locked', 'outputs', 'payment', 'closed'].includes(run.status);
  return (
    <>
      {!ready && <Banner tone="info">Payslips can be generated once the run is locked.</Banner>}
      {canManage && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!ready}
            loading={busy === 'gen'}
            onClick={async () => (await act('gen', () => send('POST', paths.runPayslips(run.uuid, 'generate'), {}), 'Payslip generation queued')) && setTimeout(list.reload, 1500)}
          >
            Generate payslips
          </Button>
          <Button disabled={!ready} onClick={() => setPublishAll(true)}>
            Publish payslips
          </Button>
        </div>
      )}
      <ListCard
        title="Payslips"
        list={list}
        onRowClick={setView}
        columns={[
          { key: 'employee_name', label: 'Employee' },
          { key: 'version', label: 'Version', priority: 'md' },
          { key: 'net', label: 'Net', render: (r) => <Amount value={r.net} currency={r.currency} /> },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          { key: 'act', label: '', render: (r) => canManage && r.status === 'published' && <Button variant="secondary" className="min-h-8! px-2! py-1!" onClick={(e) => { e.stopPropagation(); setWithdraw(r); }}>Withdraw</Button> },
        ]}
        mobile={{ title: 'employee_name', badge: (r) => <StatusBadge value={r.status} />, facts: [{ label: 'Net', value: (r) => <Amount value={r.net} currency={r.currency} /> }, { label: 'Version', value: 'version' }] }}
        empty={{ title: 'No payslips yet', description: 'Generate payslips after the run is locked.' }}
      />
      <PayslipDrawer payslip={view} onClose={() => setView(null)} />
      <ConfirmPreview
        open={publishAll}
        onClose={() => setPublishAll(false)}
        title="Publish payslips to employees"
        intro="Employees are notified (without amounts) and can see their payslip immediately."
        load={async () => {
          const rows = listOf(await api(paths.runPayslips(run.uuid)));
          return { generated: rows.filter((r) => r.status === 'generated').length, published: rows.filter((r) => r.status === 'published').length, total: rows.length };
        }}
        blocked={(d) => (d.generated === 0 ? 'There are no generated payslips waiting to be published.' : null)}
        ack={(d) => `I am ready to publish ${d.generated} payslip(s) to employees`}
        confirmLabel="Publish payslips"
        onConfirm={async () => {
          const r = unwrap(await send('POST', paths.runPayslips(run.uuid, 'publish'), {}));
          toast(`Published ${r?.published ?? ''} payslip(s)`);
          list.reload();
        }}
      >
        {(d) => <Tiles items={[{ label: 'Waiting to publish', value: d.generated }, { label: 'Already published', value: d.published }, { label: 'Total', value: d.total }]} />}
      </ConfirmPreview>
      <FormModal
        open={Boolean(withdraw)}
        onClose={() => setWithdraw(null)}
        title={`Withdraw payslip: ${withdraw?.employee_name ?? ''}`}
        intro="The payslip is hidden from the employee. The history is kept."
        fields={[{ name: 'reason', label: 'Reason', textarea: true }]}
        submitLabel="Withdraw"
        onSubmit={async (v) => {
          await send('POST', paths.payslip(withdraw.uuid, 'withdraw'), { reason: v.reason });
          list.reload();
        }}
        success="Payslip withdrawn"
      />
    </>
  );
}

function PayslipDrawer({ payslip, onClose }) {
  const res = useResource(payslip ? paths.payslip(payslip.uuid) : '/v1/payroll/payslips/none');
  const d = res.data ? unwrap(res.data) : null;
  return (
    <Drawer open={Boolean(payslip)} onClose={onClose} title={`Payslip: ${payslip?.employee_name ?? ''}`}>
      {res.loading ? <Skeleton rows={2} /> : res.error ? <ErrorState error={res.error} onRetry={res.reload} /> : <PayslipSnapshot snapshot={d?.snapshot ? { currency: d.currency, ...d.snapshot } : null} />}
    </Drawer>
  );
}

export function PrepareTab({ run, canPrepare }) {
  const nav = useNavigate();
  const toast = useToast();
  const formats = useLookup(paths.paymentFormats);
  const [form, setForm] = useState(false);
  const ready = ['locked', 'outputs', 'payment'].includes(run.status);
  return (
    <Section>
      {!ready && <Banner tone="info">A payment batch can be prepared once the run is locked.</Banner>}
      <p className="mt-0 text-sm">Preparing a batch lists who would be paid and who is excluded (no verified bank account, zero or negative net). A different person must approve it before a bank file is made.</p>
      {canPrepare && (
        <Button disabled={!ready} onClick={() => setForm(true)}>
          Prepare payment batch
        </Button>
      )}
      <FormModal
        open={form}
        onClose={() => setForm(false)}
        title="Prepare payment batch"
        initial={{ format: formats[0]?.code ?? 'generic_csv', payment_date: today() }}
        fields={[
          { name: 'format', label: 'Bank file format', options: (formats.length ? formats : [{ code: 'generic_csv', label: 'Generic CSV' }]).map((f) => ({ value: f.code, label: f.label ?? f.code })) },
          { name: 'payment_date', label: 'Payment date', type: 'date' },
        ]}
        submitLabel="Prepare"
        onSubmit={async (v) => {
          const r = unwrap(await send('POST', paths.runPayments(run.uuid), { ...v, idempotency_key: newKey() }));
          toast('Payment batch prepared');
          nav(`/payroll/payments/${r.uuid}`);
        }}
      />
    </Section>
  );
}
