import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, ErrorState, Skeleton, useToast } from '../../components/ui';
import { Amount, Banner, ConfirmDialog, ConfirmPreview, FormModal, ListCard, Page, Section, StatusBadge, Tiles, useDo } from '../../components/payroll/kit';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import { download } from '../../lib/api';
import { newKey, paths, send, titleCase, unwrap, useList } from '../../lib/payrollApi';

const ACCESS = 'payroll.payments.prepare|payroll.payments.approve|payroll.payments.confirm';

export function PaymentsPage() {
  const list = useList(paths.payments);
  const nav = useNavigate();
  return (
    <Page permission={ACCESS} title="Payments" description="Payment batches: prepare, approve (a different person), generate the bank file, then confirm outcomes.">
      <ListCard
        title="Batches"
        list={list}
        onRowClick={(r) => nav(`/payroll/payments/${r.uuid}`)}
        columns={[
          { key: 'period', label: 'Period', render: (r) => r.period_label ?? r.run?.period_label ?? r.uuid.slice(0, 8) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          { key: 'employee_count', label: 'Employees' },
          { key: 'total_amount', label: 'Total', render: (r) => <Amount value={r.total_amount} currency={r.currency} /> },
          { key: 'payment_date', label: 'Payment date', priority: 'md' },
        ]}
        mobile={{ title: (r) => r.period_label ?? r.run?.period_label ?? `Batch ${r.uuid.slice(0, 8)}`, badge: (r) => <StatusBadge value={r.status} />, facts: [{ label: 'Employees', value: 'employee_count' }, { label: 'Total', value: (r) => <Amount value={r.total_amount} currency={r.currency} /> }] }}
        empty={{ title: 'No payment batches', description: 'Prepare a batch from a locked payroll run.' }}
      />
    </Page>
  );
}

export function PaymentDetailPage() {
  const { uuid } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const res = useResource(paths.payment(uuid));
  const d = res.data ? unwrap(res.data) : null;
  const [dialog, setDialog] = useState(null);
  const [draft, setDraft] = useState(null);
  const { busy, run } = useDo();
  const approved = Boolean(d?.approved || d?.approved_at || d?.approval_status === 'approved');
  const cur = d?.currency;
  const rec = d?.reconciliation;

  async function bankFile() {
    const r = await run('file', () => send('POST', paths.payment(uuid, 'bank-file'), {}), 'Bank file generated');
    if (r) res.reload();
  }
  async function fetchFile(f) {
    await run(`dl-${f.uuid}`, () => download(paths.bankFile(f.uuid), `bank-file-${f.file_version ?? ''}.csv`));
  }
  async function submit() {
    if (await run('submit', () => send('POST', paths.payment(uuid, 'submit'), {}), 'Marked as handed to the bank')) res.reload();
  }

  return (
    <Page permission={ACCESS} title="Payment batch" description={d ? `${d.employee_count ?? 0} employees` : undefined}>
      <p className="mt-0">
        <Link to="/payroll/payments" className="text-xs font-semibold text-brand-700 dark:text-brand-300">
          Back to payments
        </Link>
      </p>
      {res.loading ? (
        <Skeleton rows={3} />
      ) : res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : (
        <>
          <Tiles
            items={[
              { label: 'Status', value: <StatusBadge value={d.status} /> },
              { label: 'Total', value: <Amount value={d.total_amount} currency={cur} /> },
              { label: 'Employees', value: d.employee_count },
              { label: 'Reconciliation difference', value: <Amount value={rec?.difference} currency={cur} />, tone: rec && rec.difference && Number(rec.difference) !== 0 ? 'warn' : undefined },
            ]}
          />
          {(d.exceptions ?? []).length > 0 && (
            <Banner tone="warn" title={`${d.exceptions.length} employee(s) excluded`}>
              <ul className="m-0 list-disc pl-4">
                {d.exceptions.map((e, i) => (
                  <li key={i}>
                    {e.employee_name ?? e.name}: {titleCase(e.reason ?? e.code ?? 'excluded')}
                  </li>
                ))}
              </ul>
            </Banner>
          )}
          {can('payroll.payments.approve') && d.status === 'prepared' && !approved && d.can_approve === false && (
            <Banner tone="info" title="Another approver is needed">
              You prepared this batch, so a different person with approval permission must approve it.
            </Banner>
          )}
          <div className="mb-4 flex flex-wrap gap-2">
            {can('payroll.payments.approve') && d.status === 'prepared' && !approved && (
              <Button disabled={d.can_approve === false} onClick={() => setDialog('approve')}>
                Approve batch
              </Button>
            )}
            {can('payroll.payments.prepare') && approved && (
              <Button variant="secondary" loading={busy === 'file'} onClick={bankFile}>
                Generate bank file
              </Button>
            )}
            {can('payroll.payments.prepare') && approved && d.status === 'prepared' && (
              <Button variant="secondary" loading={busy === 'submit'} onClick={submit}>
                Mark submitted to bank
              </Button>
            )}
            {can('payroll.payments.confirm') && ['submitted', 'processing', 'partially_paid'].includes(d.status) && <Button onClick={() => setDraft({ open: true })}>Record outcomes</Button>}
            {can('payroll.payments.prepare') && ['failed', 'partially_paid'].includes(d.status) && <Button variant="secondary" onClick={() => setDialog('retry')}>Retry failed</Button>}
          </div>
          {(d.files ?? []).length > 0 && (
            <Card title="Bank files" className="mb-5">
              <Section>
                <ul className="m-0 list-none p-0 text-xs">
                  {d.files.map((f) => (
                    <li key={f.uuid} className="flex items-center justify-between gap-2 py-1">
                      <span>
                        Version {f.file_version} · {f.employee_count} employees{f.expires_at ? ` · expires ${f.expires_at.slice(0, 10)}` : ''}
                      </span>
                      {can('payroll.payments.prepare') && (
                        <Button variant="secondary" className="min-h-8! px-2! py-1!" loading={busy === `dl-${f.uuid}`} onClick={() => fetchFile(f)}>
                          Download
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            </Card>
          )}
          <ListCard
            title="Instructions"
            list={{ loading: false, error: null, rows: d.instructions ?? [] }}
            columns={[
              { key: 'employee_name', label: 'Employee' },
              { key: 'account', label: 'Account', priority: 'md' },
              { key: 'amount', label: 'Amount', render: (r) => <Amount value={r.amount} currency={cur} /> },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
              { key: 'bank_reference', label: 'Bank reference', priority: 'lg', render: (r) => r.bank_reference ?? '—' },
            ]}
            mobile={{ title: 'employee_name', subtitle: 'account', badge: (r) => <StatusBadge value={r.status} />, facts: [{ label: 'Amount', value: (r) => <Amount value={r.amount} currency={cur} /> }] }}
            empty={{ title: 'No instructions', description: 'Nobody was payable in this batch.' }}
          />
          <ConfirmDialog
            open={dialog === 'approve'}
            onClose={() => setDialog(null)}
            title="Approve payment batch?"
            intro="You are confirming the amounts and recipients. You cannot approve a batch you prepared."
            confirmLabel="Approve batch"
            onConfirm={async () => {
              await send('POST', paths.payment(uuid, 'approve'), {});
              toast('Batch approved');
              res.reload();
            }}
          />
          <ConfirmDialog
            open={dialog === 'retry'}
            onClose={() => setDialog(null)}
            title="Create a retry batch?"
            intro="A new batch with only the failed instructions is created. It needs approval again."
            confirmLabel="Create retry batch"
            onConfirm={async () => {
              const r = unwrap(await send('POST', paths.payment(uuid, 'retry'), { idempotency_key: newKey() }));
              toast('Retry batch created');
              if (r?.uuid) nav(`/payroll/payments/${r.uuid}`);
            }}
          />
          <FormModal
            open={draft?.open === true}
            onClose={() => setDraft(null)}
            title="Record payment outcome"
            intro="You will preview the effect first. Paid needs a bank reference; paid and failed are final."
            initial={{ status: 'paid' }}
            submitLabel="Preview"
            fields={[
              { name: 'uuid', label: 'Instruction', options: (d.instructions ?? []).map((i) => ({ value: i.uuid, label: `${i.employee_name} (${titleCase(i.status)})` })) },
              { name: 'status', label: 'Outcome', options: ['processing', 'paid', 'failed'].map((s) => ({ value: s, label: titleCase(s) })) },
              { name: 'bank_reference', label: 'Bank reference', required: false },
              { name: 'reason', label: 'Failure reason', required: false },
            ]}
            onSubmit={async (v) => setDraft({ update: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '')) })}
          />
          <ConfirmPreview
            open={Boolean(draft?.update)}
            onClose={() => setDraft(null)}
            title="Confirm payment outcome"
            load={() => send('POST', paths.payment(uuid, 'confirm'), { preview: true, updates: [draft.update] })}
            blocked={(p) => ((p.results ?? []).some((r) => r.result === 'rejected') ? (p.results.find((r) => r.result === 'rejected').message ?? 'This update would be rejected.') : null)}
            confirmLabel="Record outcome"
            onConfirm={async () => {
              await send('POST', paths.payment(uuid, 'confirm'), { updates: [draft.update] });
              toast('Outcome recorded');
              res.reload();
            }}
          >
            {(p) => (
              <ul className="m-0 list-disc pl-5 text-xs">
                {(p.results ?? []).map((r, i) => (
                  <li key={i}>
                    {titleCase(r.result)}
                    {r.message ? `: ${r.message}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </ConfirmPreview>
        </>
      )}
    </Page>
  );
}
