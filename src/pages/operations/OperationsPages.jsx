import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, ErrorState, PageHeader, Skeleton, Input } from '../../components/ui';
import Access from '../../components/Access';
import { FormModal, StatusBadge, useDo } from '../../components/payroll/kit';
import { operationPaths as paths, operationPermissions, currencyOptions, send, useList } from '../../lib/operationsApi';
import { useAuth } from '../../lib/auth';
import { download } from '../../lib/api';

function Page({ module, title, description, action, children }) {
  return <Access module={module} permission={operationPermissions[module]}><PageHeader title={title} description={description} action={action} />{children}</Access>;
}
function Result({ resource, children }) {
  return resource.loading ? <Skeleton /> : resource.error ? <ErrorState error={resource.error} onRetry={resource.reload} /> : children;
}
function Pager({ list, page, setPage }) {
  return <div className="mt-4 flex items-center gap-3"><Button variant="secondary" disabled={page <= 1 || list.loading} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-xs">Page {page} of {list.data?.last_page ?? 1}</span><Button variant="secondary" disabled={page >= (list.data?.last_page ?? 1) || list.loading} onClick={() => setPage(page + 1)}>Next</Button></div>;
}

export function AssetsPage() {
  const { can } = useAuth(); const [create, setCreate] = useState(false); const [page, setPage] = useState(1);
  const list = useList(`${paths.assets}?page=${page}`);
  return <Page module="assets" title={can('assets.manage') ? 'Asset inventory' : 'My assets'} description="Follow equipment custody, acknowledgment and returns." action={can('assets.manage') && <Button onClick={() => setCreate(true)}>Register asset</Button>}>
    <Result resource={list}><div className="grid gap-3 md:grid-cols-2">{list.rows.map((a) => <Card key={a.uuid} title={<Link className="text-brand-700 underline" to={`/assets/${a.uuid}`}>{a.identifier} — {a.name}</Link>} action={<StatusBadge value={a.status} />}><p className="text-sm">{a.category} · {a.condition}</p><p className="text-xs">{a.employee_name || 'In inventory'}</p></Card>)}{!list.rows.length && <Card>No assets to show.</Card>}</div><Pager list={list} page={page} setPage={setPage} /></Result>
    <FormModal open={create} onClose={() => setCreate(false)} title="Register asset" fields={[
      { name: 'identifier', label: 'Inventory identifier' }, { name: 'name', label: 'Asset name' }, { name: 'category', label: 'Category' },
      { name: 'serial_number', label: 'Serial number', required: false }, { name: 'model', label: 'Model', required: false },
      { name: 'location', label: 'Stock location', required: false }, { name: 'purchase_reference', label: 'Purchase reference', required: false }, { name: 'warranty_until', label: 'Warranty expiry', type: 'date', required: false },
    ]} onSubmit={async (v) => { const r = await send('POST', paths.assets, v); list.reload(); return r; }} success="Asset registered" />
  </Page>;
}

const assetActions = {
  available: [['assign', 'Assign'], ['repair', 'Send for repair'], ['lost', 'Mark lost'], ['dispose', 'Dispose']],
  assigned: [['transfer', 'Transfer'], ['return', 'Record return'], ['lost', 'Mark lost']],
  repair: [['restore', 'Restore to stock'], ['dispose', 'Dispose']], lost: [['return', 'Record recovery']], disposed: [],
};
export function AssetDetailPage() {
  const { uuid } = useParams(); const { can } = useAuth(); const detail = useList(paths.asset(uuid)); const a = detail.data;
  const [action, setAction] = useState(null); const [search, setSearch] = useState('');
  const employees = useList(can('assets.manage') && ['assign', 'transfer'].includes(action) ? `${paths.employees}?search=${encodeURIComponent(search)}` : null);
  const work = useDo();
  const fields = [...(['assign', 'transfer'].includes(action) ? [{ name: 'employee_uuid', label: 'Custodian', options: employees.rows.map((e) => ({ value: e.uuid, label: e.name })) }] : []),
    ...(action === 'return' ? [{ name: 'condition', label: 'Returned condition', options: ['good', 'worn', 'damaged'].map((value) => ({ value, label: value })) }] : []), { name: 'reason', label: 'Reason', textarea: true }];
  return <Page module="assets" title={a?.name || 'Asset'} description="Custody changes and condition history."><Link className="mb-4 inline-block text-sm underline" to="/assets">All assets</Link><Result resource={detail}>{a && <>
    <Card title={a.identifier} action={<StatusBadge value={a.status} />}><p>{a.category} · {a.model || 'Model not recorded'} · {a.condition}</p><p>Custodian: {a.employee_name || 'In inventory'}</p><p className="text-xs">{a.acknowledged_at ? `Receipt acknowledged ${new Date(a.acknowledged_at).toLocaleString()}` : 'Receipt not acknowledged'}</p>
      {a.can_acknowledge && <Button disabled={Boolean(work.busy)} onClick={async () => { const r = await work.run('ack', () => send('POST', paths.asset(uuid, 'actions'), { action: 'acknowledge', version: a.version }), 'Asset receipt acknowledged'); if (r) detail.reload(); }}>Acknowledge receipt</Button>}
      {can('assets.manage') && <div className="flex flex-wrap gap-2">{(assetActions[a.status] || []).map(([key, label]) => <Button key={key} variant="secondary" onClick={() => setAction(key)}>{label}</Button>)}</div>}
    </Card><Card title="Chain of custody" className="mt-4"><ol className="space-y-3">{a.movements?.map((m) => <li key={m.uuid}><p className="text-sm">{m.action} · {m.from_status} → {m.to_status}</p>{m.reason && <p className="text-xs">{m.reason}</p>}<time className="text-xs text-slate-500">{new Date(m.at).toLocaleString()}</time></li>)}</ol></Card>
  </>}</Result><FormModal open={Boolean(action)} onClose={() => setAction(null)} title="Record asset movement" intro="The current asset version is checked before this custody change is saved." initial={{ condition: 'good' }} fields={fields}
    extra={() => ['assign', 'transfer'].includes(action) && <><Input label="Search employees" value={search} onChange={(e) => setSearch(e.target.value)} />{employees.error && <ErrorState error={employees.error} onRetry={employees.reload} />}</>}
    onSubmit={async (v) => { const r = await send('POST', paths.asset(uuid, 'actions'), { ...v, action, version: a.version }); detail.reload(); return r; }} success="Asset movement recorded" />
  </Page>;
}

export function ExpensePoliciesPage() {
  const { can } = useAuth(); const policies = useList(paths.policies); const [create, setCreate] = useState(false);
  return <Page module="expenses" title="Expense policies" description="Each policy is an immutable version. Claims retain the rules used at creation." action={can('expenses.manage') && <Button onClick={() => setCreate(true)}>Create policy</Button>}>
    <Link to="/expenses" className="mb-4 inline-block text-sm underline">Expense claims</Link><Result resource={policies}><div className="grid gap-3">{policies.rows.map((p) => <Card key={p.uuid} title={p.name}><p>{p.category} · Limit {p.currency} {p.max_amount}</p><p className="text-xs">Receipt required from {p.currency} {p.receipt_threshold} · Effective {p.effective_from}{p.effective_to ? ` through ${p.effective_to}` : ''}</p></Card>)}{!policies.rows.length && <Card>No policies yet. A finance administrator must create a policy before claims can be entered.</Card>}</div></Result>
    <FormModal open={create} onClose={() => setCreate(false)} title="Create expense policy" fields={[
      { name: 'name', label: 'Policy version name' }, { name: 'category', label: 'Expense category' }, { name: 'currency', label: 'Currency', options: currencyOptions },
      { name: 'max_amount', label: 'Maximum claim amount' }, { name: 'receipt_threshold', label: 'Receipt required from amount' }, { name: 'effective_from', label: 'Effective from', type: 'date' }, { name: 'effective_to', label: 'Effective through', type: 'date', required: false },
    ]} onSubmit={async (v) => { const r = await send('POST', paths.policies, v); policies.reload(); return r; }} success="Expense policy created" />
  </Page>;
}
const emptyLine = () => ({ spent_on: '', merchant: '', description: '', amount: '' });
export function ExpensesPage() {
  const { can } = useAuth(); const [page, setPage] = useState(1); const [create, setCreate] = useState(false);
  const list = useList(`${paths.claims}?page=${page}`); const policies = useList(can('expenses.self') ? paths.policies : null);
  return <Page module="expenses" title="Expense claims" description="Submit business expenses and follow approval and reimbursement confirmation." action={can('expenses.self') && <Button onClick={() => setCreate(true)}>New claim</Button>}>
    {can('expenses.self|expenses.manage|expenses.approve') && <Link className="mb-4 inline-block text-sm underline" to="/expenses/policies">Expense policies</Link>}
    <Result resource={list}><div className="grid gap-3">{list.rows.map((c) => <Card key={c.uuid} title={<Link className="text-brand-700 underline" to={`/expenses/${c.uuid}`}>{c.title}</Link>} action={<StatusBadge value={c.status} />}><p>{c.currency} {c.total}</p></Card>)}{!list.rows.length && <Card>No claims to show.</Card>}</div><Pager list={list} page={page} setPage={setPage} /></Result>
    <FormModal open={create} onClose={() => setCreate(false)} title="New expense claim" initial={{ lines: [emptyLine()] }} fields={[
      { name: 'title', label: 'Claim title' }, { name: 'policy_uuid', label: 'Policy version', options: policies.rows.map((p) => ({ value: p.uuid, label: `${p.name} · ${p.currency} · limit ${p.max_amount}` })) },
    ]} extra={(v, set) => <>{policies.error && <ErrorState error={policies.error} onRetry={policies.reload} />}{(v.lines || []).map((line, index) => <fieldset key={index} className="mb-4 rounded-lg border border-slate-200 p-3"><legend className="text-sm">Expense {index + 1}</legend>{[['spent_on', 'Expense date', 'date'], ['merchant', 'Merchant', 'text'], ['description', 'Business purpose', 'text'], ['amount', 'Amount', 'text']].map(([key, label, type]) => <Input key={key} label={`${label} ${index + 1}`} required type={type} value={line[key]} onChange={(e) => set('lines', v.lines.map((l, i) => i === index ? { ...l, [key]: e.target.value } : l))} />)}{v.lines.length > 1 && <Button variant="secondary" onClick={() => set('lines', v.lines.filter((_, i) => i !== index))}>Remove expense {index + 1}</Button>}</fieldset>)}<Button variant="secondary" disabled={(v.lines?.length || 0) >= 20} onClick={() => set('lines', [...v.lines, emptyLine()])}>Add expense line</Button></>}
      onSubmit={async (v) => { const r = await send('POST', paths.claims, v); list.reload(); return r; }} success="Draft claim created. Open it to attach receipts and submit." />
  </Page>;
}
export function ExpenseDetailPage() {
  const { uuid } = useParams(); const detail = useList(paths.claim(uuid)); const c = detail.data;
  const [action, setAction] = useState(null); const [file, setFile] = useState(null); const [uploadKey, setUploadKey] = useState(0); const work = useDo();
  async function upload(e) { e.preventDefault(); if (!file) return; const form = new FormData(); form.append('file', file); const r = await work.run('upload', () => send('POST', paths.claim(uuid, 'receipts'), form), 'Receipt uploaded'); if (r) { setFile(null); setUploadKey((x) => x + 1); detail.reload(); } }
  return <Page module="expenses" title={c?.title || 'Expense claim'} description="Review the policy, receipts and approval status."><Link to="/expenses" className="mb-4 inline-block text-sm underline">All claims</Link><Result resource={detail}>{c && <>
    <Card title={`${c.currency} ${c.total}`} action={<StatusBadge value={c.status} />}><p className="text-sm">Policy: {c.policy?.name} · Limit {c.currency} {c.policy?.max_amount}</p><p className="text-xs">{c.readiness?.receipt_required ? (c.readiness.has_receipt ? 'Required receipt attached.' : 'A receipt is required before submission.') : 'A receipt is optional under this policy.'}</p>
      {c.lines?.map((l, i) => <div key={i} className="my-3 border-t border-slate-200 pt-3 text-sm"><p>{l.spent_on} · {l.merchant} · {c.currency} {l.amount}</p><p>{l.description}</p></div>)}
      <ul className="space-y-2">{c.receipts?.map((f) => <li key={f.uuid}><button type="button" className="text-sm text-brand-700 underline" onClick={() => work.run('download', () => download(paths.claim(uuid, `receipts/${f.uuid}`), f.filename))}>{f.filename}</button></li>)}</ul>
      {c.can_submit && <form onSubmit={upload} className="my-4 flex flex-wrap items-end gap-2"><label className="text-xs">Receipt (PDF or image, up to 5 MB)<input key={uploadKey} aria-label="Expense receipt" type="file" accept=".pdf,.png,.jpg,.jpeg" className="mt-2 block" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label><Button type="submit" variant="secondary" disabled={!file || Boolean(work.busy)}>Upload receipt</Button></form>}
      {c.can_submit && <Button disabled={Boolean(work.busy)} onClick={async () => { const r = await work.run('submit', () => send('POST', paths.claim(uuid, 'actions'), { action: 'submit' }), 'Claim submitted'); if (r) detail.reload(); }}>Submit claim</Button>}
      {c.can_review && <div className="flex gap-2"><Button onClick={() => setAction('approve')}>Approve</Button><Button variant="secondary" onClick={() => setAction('reject')}>Reject</Button></div>}
      {c.can_confirm_payment && <Button onClick={() => setAction('confirm_payment')}>Record payment confirmation</Button>}
      {c.decision_reason && <p className="mt-3 text-sm">Review: {c.decision_reason}</p>}{c.payment_reference && <p className="mt-3 text-sm">Confirmed payment reference: {c.payment_reference}</p>}
    </Card></>}</Result><FormModal open={Boolean(action)} onClose={() => setAction(null)} title={action === 'confirm_payment' ? 'Confirm external reimbursement' : 'Review expense claim'} intro={action === 'confirm_payment' ? 'Enter the unique transaction reference after your payment provider confirms reimbursement. This action records confirmation; it does not send money.' : 'Your decision and reason are recorded in the audit history.'} fields={action === 'confirm_payment' ? [{ name: 'payment_reference', label: 'Confirmed payment reference' }] : [{ name: 'reason', label: 'Decision reason', textarea: true }]}
      onSubmit={async (v) => { const r = await send('POST', paths.claim(uuid, 'actions'), { ...v, action }); detail.reload(); return r; }} success="Claim updated" />
  </Page>;
}

export function TravelPage() {
  const { can } = useAuth(); const [create, setCreate] = useState(false); const [page, setPage] = useState(1); const list = useList(`${paths.trips}?page=${page}`);
  return <Page module="travel" title="Travel requests" description="Plan business trips and obtain approval for estimated budgets." action={can('travel.self') && <Button onClick={() => setCreate(true)}>New trip</Button>}>
    <Result resource={list}><div className="grid gap-3">{list.rows.map((t) => <Card key={t.uuid} title={<Link className="text-brand-700 underline" to={`/travel/${t.uuid}`}>{t.destination}</Link>} action={<StatusBadge value={t.status} />}><p>{t.purpose}</p><p className="text-xs">{t.starts_on} – {t.ends_on} · {t.currency} {t.budget}</p></Card>)}{!list.rows.length && <Card>No travel requests to show.</Card>}</div><Pager list={list} page={page} setPage={setPage} /></Result>
    <FormModal open={create} onClose={() => setCreate(false)} title="New travel request" fields={[
      { name: 'purpose', label: 'Business purpose' }, { name: 'destination', label: 'Destination' }, { name: 'starts_on', label: 'Departure date', type: 'date' }, { name: 'ends_on', label: 'Return date', type: 'date' },
      { name: 'timezone', label: 'Destination timezone', hint: 'For example, Europe/London' }, { name: 'currency', label: 'Budget currency', options: currencyOptions }, { name: 'budget', label: 'Estimated budget' },
    ]} onSubmit={async (v) => { const r = await send('POST', paths.trips, v); list.reload(); return r; }} success="Draft trip created" />
  </Page>;
}
export function TravelDetailPage() {
  const [editItinerary, setEditItinerary] = useState(false);
  const { uuid } = useParams(); const detail = useList(paths.trip(uuid)); const t = detail.data; const [action, setAction] = useState(null); const work = useDo();
  return <Page module="travel" title={t?.destination || 'Travel request'} description="Requested travel dates, budget and decision."><Link to="/travel" className="mb-4 inline-block text-sm underline">All trips</Link><Result resource={detail}>{t && <Card title={t.purpose} action={<StatusBadge value={t.status} />}>
    <p>{t.starts_on} – {t.ends_on} · {t.timezone}</p><p>Estimated budget: {t.currency} {t.budget}</p><p className="text-xs">Approval authorizes this request; bookings, advances and payments are tracked separately.</p>
    <div className="flex flex-wrap gap-2">{t.can_submit && <Button disabled={Boolean(work.busy)} onClick={async () => { const r = await work.run('submit', () => send('POST', paths.trip(uuid, 'actions'), { action: 'submit' }), 'Travel request submitted'); if (r) detail.reload(); }}>Submit request</Button>}
      {t.can_review && <><Button onClick={() => setAction('approve')}>Approve trip</Button><Button variant="secondary" onClick={() => setAction('reject')}>Reject trip</Button></>}{t.can_cancel && <Button variant="secondary" onClick={() => setAction('cancel')}>Cancel trip</Button>}</div>
    <h2 className="mt-4 font-semibold">Itinerary</h2>
    {(t.itinerary || []).map((leg, i) => <div key={i} className="my-3 text-sm"><p>{leg.origin} → {leg.destination}</p><p>{leg.departure} ({leg.departure_timezone})</p><p>{leg.arrival} ({leg.arrival_timezone})</p></div>)}
    {!t.itinerary?.length && <p className="text-sm">No itinerary legs recorded.</p>}
    {t.can_submit && <Button variant="secondary" onClick={() => setEditItinerary(true)}>Edit itinerary</Button>}
    {t.decision_reason && <p className="mt-3 text-sm">Decision: {t.decision_reason}</p>}
  </Card>}</Result><FormModal open={Boolean(action)} onClose={() => setAction(null)} title="Record travel decision" fields={[{ name: 'reason', label: 'Reason', textarea: true }]}
    onSubmit={async (v) => { const r = await send('POST', paths.trip(uuid, 'actions'), { ...v, action }); detail.reload(); return r; }} success="Travel request updated" />
    <FormModal open={editItinerary} onClose={() => setEditItinerary(false)} title="Edit itinerary" initial={{ legs: t?.itinerary || [], version: t?.itinerary_version }} fields={[]}
      intro="Enter timestamps with an explicit offset, for example 2026-11-01T09:00:00+05:30, and the matching timezone, such as Asia/Kolkata. Legs must fit the trip dates in the trip timezone."
      extra={(v, set) => <>{(v.legs || []).map((leg, index) => <fieldset key={index} className="mb-4 rounded border p-3"><legend>Leg {index + 1}</legend>{[['origin', 'Origin'], ['destination', 'Destination'], ['departure', 'Departure timestamp'], ['departure_timezone', 'Departure timezone'], ['arrival', 'Arrival timestamp'], ['arrival_timezone', 'Arrival timezone']].map(([key, label]) => <Input key={key} label={`${label} ${index + 1}`} required value={leg[key]} onChange={(e) => set('legs', v.legs.map((l, i) => i === index ? { ...l, [key]: e.target.value } : l))} />)}<Button variant="secondary" onClick={() => set('legs', v.legs.filter((_, i) => i !== index))}>Remove leg {index + 1}</Button></fieldset>)}<Button variant="secondary" disabled={v.legs?.length >= 20} onClick={() => set('legs', [...(v.legs || []), { origin: '', destination: '', departure: '', arrival: '', departure_timezone: '', arrival_timezone: '' }])}>Add leg</Button></>}
      onSubmit={async (v) => { const r = await send('PUT', paths.trip(uuid, 'itinerary'), v); detail.reload(); return r; }} success="Itinerary saved" />
    </Page>;
}
