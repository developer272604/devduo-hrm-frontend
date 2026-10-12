import { useState } from 'react';
import { Button, ErrorState, Pagination } from '../../components/ui';
import { FormModal, ListCard, Page, StatusBadge } from '../../components/lifecycle/kit';
import { listOf, pageOf, send, useList } from '../../lib/lifecycleApi';

const base = '/v1/lifecycle';
export default function ResignationsPage({ review = false }) {
  const [page, setPage] = useState(1);
  const list = useList(`${base}/${review ? 'resignations' : 'me/resignations'}?page=${page}`);
  const employments = useList(review ? null : `${base}/me/resignation-employments`);
  const [modal, setModal] = useState(null);
  const options = listOf(employments.data).map((e) => ({ value: e.uuid, label: `${e.name} (${e.employee_number})` }));
  const actions = (row) => <div className="flex flex-wrap gap-2">
    {!review && row.can_withdraw && <Button variant="secondary" onClick={() => setModal({ type: 'withdraw', row })}>Withdraw</Button>}
    {review && row.can_decide && ['approve', 'reject'].map((decision) => <Button key={decision} variant="secondary" onClick={() => setModal({ type: decision, row })}>{decision === 'approve' ? 'Approve' : 'Reject'}{row.status === 'withdrawal_pending' ? ' withdrawal' : ''}</Button>)}
  </div>;
  return <Page permission={review ? 'people.separate' : 'lifecycle.self'} title={review ? 'Resignation review' : 'My resignation requests'} description={review ? 'Review proposed departures and withdrawal requests. Approval starts the existing separation and offboarding process.' : 'Submit a proposed last working day for HR review. Employment changes only after approval.'} action={!review && <Button disabled={!options.length} onClick={() => setModal({ type: 'create' })}>Request resignation</Button>}>
    {!review && employments.error && <ErrorState error={employments.error} onRetry={employments.reload} />}
    <ListCard title="Requests" list={list} columns={[
      { key: 'employee_name', label: 'Employee' },
      { key: 'requested_last_day', label: 'Proposed last day' },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
      { key: 'reason', label: 'Request details', render: (r) => <div className="max-w-lg whitespace-pre-wrap"><p>{r.reason}</p>{r.withdrawal_reason && <p>Withdrawal: {r.withdrawal_reason}</p>}{r.decision_note && <p>HR response: {r.decision_note}</p>}</div> },
      { key: 'actions', label: 'Actions', render: actions },
    ]} empty={{ title: 'No resignation requests', description: 'Requests will appear here when submitted.' }} />
    <Pagination data={list.data ? pageOf(list.data) : null} onChange={setPage} />
    <FormModal open={Boolean(modal)} onClose={() => setModal(null)} title={modal?.type === 'create' ? 'Request resignation' : modal?.type === 'withdraw' ? 'Withdraw resignation' : `${modal?.type === 'approve' ? 'Approve' : 'Reject'} ${modal?.row?.status === 'withdrawal_pending' ? 'withdrawal' : 'resignation'}`} initial={{ employee_uuid: options[0]?.value ?? '', requested_last_day: '', reason: '', note: '', confirmed: false }} fields={modal?.type === 'create' ? [
      { name: 'employee_uuid', label: 'Employment', options },
      { name: 'requested_last_day', label: 'Proposed last working day', type: 'date' },
      { name: 'reason', label: 'Reason', textarea: true },
      { name: 'confirmed', label: 'I confirm I want to submit this resignation request', type: 'checkbox' },
    ] : modal?.type === 'withdraw' ? [
      { name: 'reason', label: 'Withdrawal reason', textarea: true },
      { name: 'confirmed', label: 'I confirm this withdrawal request', type: 'checkbox' },
    ] : [{ name: 'note', label: 'Decision note (visible to the employee)', textarea: true }]} intro={modal?.type === 'withdraw' ? 'Pending requests withdraw immediately. Approved resignations need HR approval to reverse the separation.' : undefined} submitLabel="Submit" onSubmit={async (values) => {
      if (modal.type === 'create') await send('POST', `${base}/me/resignations`, values);
      else if (modal.type === 'withdraw') await send('POST', `${base}/me/resignations/${modal.row.uuid}/withdraw`, values);
      else await send('POST', `${base}/resignations/${modal.row.uuid}/decision`, { decision: modal.type, expected_status: modal.row.status, note: values.note });
      list.reload(); employments.reload();
    }} success="Request updated" />
  </Page>;
}
