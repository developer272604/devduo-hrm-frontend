import { useState } from 'react';
import { Button, Drawer, ErrorState, Skeleton, useToast } from '../../components/ui';
import { Amount, Banner, FormModal, ListCard, Page, StatusBadge, Tiles, useEmployees, useDo } from '../../components/payroll/kit';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import { newKey, paths, send, titleCase, today, unwrap, useList } from '../../lib/payrollApi';

const ACCESS = 'payroll.settlement.manage|payroll.settlement.approve';

function Detail({ uuid, onClose, onChanged }) {
  const { can } = useAuth();
  const toast = useToast();
  const res = useResource(uuid ? paths.settlement(uuid) : '/v1/payroll/settlements/none');
  const d = res.data ? unwrap(res.data) : null;
  const [decide, setDecide] = useState(false);
  const { busy, run } = useDo();
  const refresh = () => {
    res.reload();
    onChanged();
  };
  const cur = d?.currency;
  return (
    <Drawer open={Boolean(uuid)} onClose={onClose} title="Full and final settlement">
      {res.loading ? (
        <Skeleton rows={2} />
      ) : res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : (
        <div className="space-y-4">
          <Tiles items={[{ label: 'Status', value: <StatusBadge value={d.status} /> }, { label: 'Net payable', value: <Amount value={d.net_payable} currency={cur} /> }]} />
          {(d.summary?.warnings ?? []).length > 0 && (
            <Banner tone="warn" title="Warnings">
              <ul className="m-0 list-disc pl-4">
                {d.summary.warnings.map((w, i) => (
                  <li key={i}>{typeof w === 'string' ? w : w.message}</li>
                ))}
              </ul>
            </Banner>
          )}
          {d.summary?.negative && <Banner tone="error">The net is negative, so approval is blocked.</Banner>}
          <ListCard
            title="Items"
            list={{ loading: false, error: null, rows: d.items ?? [] }}
            rowKey={(r) => `${r.kind}-${r.direction}-${r.amount}`}
            columns={[
              { key: 'kind', label: 'Item', render: (r) => titleCase(r.kind) },
              { key: 'direction', label: 'Direction', render: (r) => titleCase(r.direction) },
              { key: 'amount', label: 'Amount', render: (r) => <Amount value={r.amount} currency={cur} /> },
              { key: 'explanation', label: 'Explanation', priority: 'md' },
            ]}
            mobile={{ title: (r) => titleCase(r.kind), subtitle: 'explanation', badge: (r) => titleCase(r.direction), facts: [{ label: 'Amount', value: (r) => <Amount value={r.amount} currency={cur} /> }] }}
            empty={{ title: 'No items' }}
          />
          <div className="flex flex-wrap gap-2">
            {can('payroll.settlement.manage') && ['calculated', 'draft'].includes(d.status) && (
              <>
                <Button variant="secondary" loading={busy === 'calc'} onClick={async () => (await run('calc', () => send('POST', paths.settlement(uuid, 'calculate'), {}), 'Recalculated')) && refresh()}>
                  Recalculate
                </Button>
                <Button loading={busy === 'submit'} onClick={async () => (await run('submit', () => send('POST', paths.settlement(uuid, 'submit'), {}), 'Submitted for review')) && refresh()}>
                  Submit for review
                </Button>
              </>
            )}
            {can('payroll.settlement.approve') && d.status === 'review' && <Button onClick={() => setDecide(true)}>Decide</Button>}
          </div>
          <FormModal
            open={decide}
            onClose={() => setDecide(false)}
            title="Settlement decision"
            intro="The approver must differ from the person who prepared it. Approval locks the result and recovers loan balances."
            initial={{ decision: 'approved' }}
            fields={[
              { name: 'decision', label: 'Decision', options: [{ value: 'approved', label: 'Approve' }, { value: 'rejected', label: 'Reject' }] },
              { name: 'note', label: 'Note', required: false, textarea: true },
            ]}
            onSubmit={async (v) => {
              await send('POST', paths.settlement(uuid, 'decision'), v);
              refresh();
            }}
            success="Decision recorded"
          />
        </div>
      )}
    </Drawer>
  );
}

export default function SettlementPage() {
  const { can } = useAuth();
  const list = useList(paths.settlements);
  const employees = useEmployees();
  const [create, setCreate] = useState(false);
  const [open, setOpen] = useState(null);
  return (
    <Page permission={ACCESS} title="Settlement" description="Full and final settlement for leavers: salary days, leave encashment, notice recovery and open balances." action={can('payroll.settlement.manage') && <Button onClick={() => setCreate(true)}>New settlement</Button>}>
      <ListCard
        title="Settlements"
        list={list}
        onRowClick={(r) => setOpen(r.uuid)}
        columns={[
          { key: 'employee_name', label: 'Employee' },
          { key: 'last_working_date', label: 'Last working day' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          { key: 'net_payable', label: 'Net payable', render: (r) => <Amount value={r.net_payable} currency={r.currency} /> },
        ]}
        mobile={{ title: 'employee_name', subtitle: 'last_working_date', badge: (r) => <StatusBadge value={r.status} />, facts: [{ label: 'Net payable', value: (r) => <Amount value={r.net_payable} currency={r.currency} /> }] }}
        empty={{ title: 'No settlements', description: 'Start a settlement when an employee leaves.' }}
      />
      <FormModal
        open={create}
        onClose={() => setCreate(false)}
        title="New settlement"
        initial={{ last_working_date: today(), currency: 'USD', include_leave_encashment: true, recover_balances: true }}
        fields={[
          { name: 'employee_uuid', label: 'Employee', options: employees },
          { name: 'last_working_date', label: 'Last working date', type: 'date' },
          { name: 'currency', label: 'Currency' },
          { name: 'daily_rate', label: 'Daily rate (optional)', required: false, hint: 'Leave empty to use the employee compensation.' },
          { name: 'include_leave_encashment', label: 'Include leave encashment', type: 'checkbox' },
          { name: 'recover_balances', label: 'Recover open loan and advance balances', type: 'checkbox' },
        ]}
        onSubmit={async (v) => {
          const body = { ...v, idempotency_key: newKey() };
          if (!body.daily_rate) delete body.daily_rate;
          const r = unwrap(await send('POST', paths.settlements, body));
          list.reload();
          if (r?.uuid) setOpen(r.uuid);
        }}
        success="Settlement calculated"
      />
      <Detail uuid={open} onClose={() => setOpen(null)} onChanged={list.reload} />
    </Page>
  );
}
