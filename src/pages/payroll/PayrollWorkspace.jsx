import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import { PageHeader, Tabs, Card, Button, Input, Resource, ErrorState, Modal } from '../../components/ui';
import { RecordPanel, KeyValue, choices } from '../../components/DomainWorkspace';

const root = '/v1/payroll';
const money = (value, currency) => `${currency} ${value}`; // Server decimal strings are never recalculated in the browser.
const groupFields = [
  { name: 'name', label: 'Group name' }, { name: 'code', label: 'Code', hint: 'Uppercase letters, numbers and underscores.' },
  { name: 'legal_entity_id', label: 'Legal entity', path: '/organization/legal-entities', valueKey: 'id' },
  { name: 'country', label: 'Country code', hint: 'Two-letter country code, e.g. IN.' },
  { name: 'currency', label: 'Currency', options: choices(['INR', 'USD', 'GBP', 'EUR', 'SGD', 'AUD', 'CAD', 'JPY', 'AED']) },
  { name: 'timezone', label: 'Timezone', hint: 'IANA timezone, e.g. Asia/Kolkata.' },
  { name: 'frequency', label: 'Pay frequency', options: choices(['weekly', 'biweekly', 'semi_monthly', 'monthly', 'four_weekly', 'custom']) },
];
const componentFields = [
  { name: 'name', label: 'Name' }, { name: 'code', label: 'Code' },
  { name: 'kind', label: 'Component type', options: choices(['earning', 'deduction', 'tax', 'employee_contribution', 'employer_contribution', 'benefit', 'reimbursement', 'informational']) },
  { name: 'currency', label: 'Currency' }, { name: 'effective_from', label: 'Effective from', type: 'date' }, { name: 'effective_to', label: 'Effective to', type: 'date', required: false },
  { name: 'formula', label: 'Formula (optional)', required: false, hint: 'Simulation variables: BASE, WORKING_DAYS, PAYABLE_DAYS, OVERTIME_UNITS.' }, { name: 'gl_code', label: 'GL code', required: false },
];

function Simulator() {
  const [expression, setExpression] = useState('BASE / WORKING_DAYS * PAYABLE_DAYS'), [variables, setVariables] = useState({ BASE: '35000.00', WORKING_DAYS: '30', PAYABLE_DAYS: '30', OVERTIME_UNITS: '0' });
  const [result, setResult] = useState(null), [error, setError] = useState(null), [busy, setBusy] = useState(false);
  return <Card><form className="p-5" onSubmit={async (e) => {
    e.preventDefault(); setBusy(true); setError(null); setResult(null);
    try { setResult(await api(`${root}/simulate`, { method: 'POST', body: { expression, variables } })); } catch (e) { setError(e); } finally { setBusy(false); }
  }}><h2 className="mb-3 text-lg font-semibold">Formula simulator</h2><p className="mb-5 text-sm text-slate-500 dark:text-slate-400">Preview arithmetic without changing compensation. This is not a payroll or tax result.</p>
    <Input label="Expression" value={expression} onChange={(e) => setExpression(e.target.value)} required />
    <div className="grid gap-x-4 sm:grid-cols-2">{Object.entries(variables).map(([key, value]) => <Input key={key} label={key.replaceAll('_', ' ')} value={value} onChange={(e) => setVariables((v) => ({ ...v, [key]: e.target.value }))} required />)}</div>
    {error && <p role="alert" className="mb-3 text-sm text-rose-600 dark:text-rose-300">{Object.values(error.errors || {}).flat().join(' ') || error.message}</p>}
    <Button type="submit" disabled={busy}>{busy ? 'Calculating…' : 'Simulate'}</Button>
    {result && <p role="status" className="mt-5 rounded-lg bg-brand-50 p-4 text-lg font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-200">Result: {result.result}</p>}
  </form></Card>;
}

export default function PayrollWorkspace() {
  const { can, enabled } = useAuth();
  const tabs = [['readiness', 'Readiness', 'payroll.configure|payroll.compensation.view'], ['groups', 'Groups', 'payroll.configure|payroll.compensation.manage'], ['components', 'Components', 'payroll.configure|payroll.compensation.manage'], ['compensation', 'Compensation', 'payroll.compensation.view'], ['simulator', 'Simulator', 'payroll.simulate']].filter((t) => can(t[2]));
  const [active, setActive] = useState(null), [review, setReview] = useState(null), [reviewError, setReviewError] = useState(null), [busy, setBusy] = useState(false);
  const tab = tabs.some((t) => t[0] === active) ? active : tabs[0]?.[0];
  if (!enabled('payroll') || !tabs.length) return <ErrorState error={{ status: 403, message: 'Your role does not have payroll access.' }} />;
  const action = (row, _open, reload) => row.can_review && can('payroll.compensation.approve') ? <Button variant="secondary" onClick={() => { setReview({ row, reload }); setReviewError(null); }}>Review revision</Button> : null;
  return <><PageHeader title="Payroll & compensation" description="Configure pay groups, review compensation and trace calculations." /><Tabs items={tabs.map(([value, label]) => ({ value, label }))} value={tab} onChange={setActive} />
    {tab === 'readiness' && <Readiness />}
    {tab === 'groups' && <RecordPanel title="Groups" path={`${root}/groups`} canCreate={can('payroll.configure')} fields={groupFields} initial={{ country: 'IN', currency: 'INR', timezone: 'Asia/Kolkata', frequency: 'monthly' }} render={(r) => <><h3 className="font-semibold">{r.name}</h3><KeyValue label="Code">{r.code}</KeyValue><KeyValue label="Payroll">{r.country || 'Configuration required'} · {r.currency} · {r.frequency}</KeyValue></>} />}
    {tab === 'components' && <RecordPanel title="Components" path={`${root}/components`} canCreate={can('payroll.configure')} fields={componentFields} initial={{ kind: 'earning', currency: 'INR' }} transform={(v) => ({ ...v, effective_to: v.effective_to || null, formula: v.formula || null })} render={(r) => <><h3 className="font-semibold">{r.name} · v{r.version}</h3><KeyValue label="Type">{r.kind}</KeyValue><KeyValue label="Effective">{r.effective_from} → {r.effective_to || 'Open ended'}</KeyValue><KeyValue label="Formula">{r.formula || 'Fixed amount'}</KeyValue></>} />}
    {tab === 'compensation' && <RecordPanel title="Compensation revisions" path={`${root}/compensations`} canCreate={can('payroll.compensation.manage')} fields={[
      { name: 'employee_uuid', label: 'Employee', path: `${root}/employees` }, { name: 'group_uuid', label: 'Payroll group', path: `${root}/groups`, filter: (r) => r.currency && r.active },
      { name: 'effective_from', label: 'Effective from', type: 'date' }, { name: 'effective_to', label: 'Effective to', type: 'date', required: false },
      { name: 'component_uuid', label: 'Salary component', path: `${root}/components`, display: (r) => `${r.name} (${r.currency}, v${r.version})`, filter: (r) => !r.formula },
      { name: 'amount', label: 'Amount per pay period', hint: 'Decimal amount, e.g. 35000.00.' }, { name: 'reason', label: 'Revision reason' },
    ]} initial={() => ({ idempotency_key: crypto.randomUUID() })} transform={({ component_uuid, amount, ...v }) => ({ ...v, effective_to: v.effective_to || null, lines: [{ component_uuid, amount }] })} render={(r) => <><h3 className="font-semibold">{r.employee_name}</h3><KeyValue label="Status">{r.status}</KeyValue><KeyValue label="Group">{r.group_name}</KeyValue><KeyValue label="Effective">{r.effective_from} → {r.effective_to || 'Open ended'}</KeyValue>{r.lines.map((l) => <KeyValue key={l.component_uuid} label={`${l.code} v${l.version}`}>{money(l.amount, r.currency)}</KeyValue>)}<p className="text-sm">{r.reason}</p></>} action={action} />}
    {tab === 'simulator' && <Simulator />}
    {review && <Modal open title="Review compensation revision" onClose={() => setReview(null)}><p className="mb-4 text-sm">Review {review.row.employee_name}'s revision effective {review.row.effective_from}. Approval preserves compensation history and rejects overlapping periods.</p>{reviewError && <p role="alert" className="mb-4 text-rose-600 dark:text-rose-300">{Object.values(reviewError.errors || {}).flat().join(' ') || reviewError.message}</p>}<div className="flex gap-3">{['approved', 'rejected'].map((decision) => <Button key={decision} disabled={busy} variant={decision === 'rejected' ? 'secondary' : 'primary'} onClick={async () => { setBusy(true); try { await api(`${root}/compensations/${review.row.uuid}/decision`, { method: 'POST', body: { decision } }); review.reload(); setReview(null); } catch (e) { setReviewError(e); } finally { setBusy(false); } }}>{decision === 'approved' ? 'Approve' : 'Reject'}</Button>)}</div></Modal>}
  </>;
}

function Readiness() {
  const resource = useResource(`${root}/readiness`);
  return <Resource resource={resource}>{() => <Card><div className="p-5"><h2 className="mb-4 text-lg font-semibold">Payroll readiness: {resource.data?.state}</h2><ul className="list-disc space-y-3 pl-5 text-sm">{resource.data?.issues?.map((issue) => <li key={issue.code}>{issue.message}</li>)}</ul></div></Card>}</Resource>;
}
