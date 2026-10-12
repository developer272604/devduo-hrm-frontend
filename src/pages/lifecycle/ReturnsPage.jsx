import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, ErrorState, Pagination } from '../../components/ui';
import { FormModal, ListCard, Page, StatusBadge } from '../../components/lifecycle/kit';
import { listOf, pageOf, send, useList } from '../../lib/lifecycleApi';

const base = '/v1/lifecycle/returns';
export default function ReturnsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const list = useList(`${base}?page=${page}`);
  const employees = useList(`${base}/employees?q=${encodeURIComponent(search)}`);
  const options = listOf(employees.data).map((e) => ({ value: e.uuid, label: `${e.name} (${e.employee_number})` }));
  const actions = (row) => <div className="flex gap-2">
    {row.can_decide && ['approve', 'reject'].map((decision) => <Button key={decision} variant="secondary" onClick={() => setModal({ row, decision })}>{decision === 'approve' ? 'Approve return' : 'Reject'}</Button>)}
    {row.case_uuid && <Link to={`/lifecycle/cases/${row.case_uuid}`}>Checklist</Link>}
  </div>;
  return <Page permission="people.manage" title="Return to work" description="Request an employee's return from long leave. A different HR reviewer confirms the return on the day of approval and opens the published return checklist." action={<Button disabled={!options.length} onClick={() => setModal({ create: true })}>Request return</Button>}>
    <Input label="Find employees on long leave" maxLength={100} value={search} onChange={(e) => setSearch(e.target.value)} />
    {employees.error && <ErrorState error={employees.error} onRetry={employees.reload} />}
    {!employees.loading && !employees.error && !options.length && <p className="text-sm text-slate-500">No matching employees on long leave in your scope.</p>}
    <ListCard title="Return requests" list={list} columns={[
      { key: 'employee_name', label: 'Employee' },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
      { key: 'returned_on', label: 'Returned on' },
      { key: 'note', label: 'Notes', render: (r) => <div className="max-w-lg whitespace-pre-wrap">{r.note}{r.decision_note && <p>Decision: {r.decision_note}</p>}</div> },
      { key: 'actions', label: 'Actions', render: actions },
    ]} empty={{ title: 'No return requests', description: 'Requests for employees on long leave appear here.' }} />
    <Pagination data={list.data ? pageOf(list.data) : null} onChange={setPage} />
    <FormModal open={Boolean(modal)} onClose={() => setModal(null)} title={modal?.create ? 'Request return to work' : modal?.decision === 'approve' ? 'Approve return today' : 'Reject return'} initial={{ employee_uuid: options[0]?.value ?? '', note: '', confirmed: false }} intro="Use operational notes only; do not enter medical details. Approval requires a published Absence return checklist. Leave balances and payroll are handled in their own modules." fields={[
      ...(modal?.create ? [{ name: 'employee_uuid', label: 'Employee', options }] : []),
      { name: 'note', label: 'Operational note', textarea: true },
      ...(!modal?.create ? [{ name: 'confirmed', label: 'I confirm this decision', type: 'checkbox' }] : []),
    ]} onSubmit={async (v) => {
      if (modal.create) await send('POST', base, v);
      else await send('POST', `${base}/${modal.row.uuid}/decision`, { ...v, decision: modal.decision });
      list.reload(); employees.reload();
    }} success="Return request updated" />
  </Page>;
}
