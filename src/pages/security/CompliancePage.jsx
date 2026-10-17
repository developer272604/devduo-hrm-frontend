import { useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, FormError, Input, Modal, PageHeader, Skeleton, Tabs, Textarea } from '../../components/ui';
import { send, useAction, useList } from '../../lib/timeOfficeApi';
import { useAuth } from '../../lib/auth';

const C = '/v1/security/compliance';
const label = (s) => String(s).replace(/_/g, ' ');
const tone = { current: 'green', due_soon: 'amber', overdue: 'amber', overdue_in_review: 'amber', awaiting_review: 'purple', complete: 'green', inactive: 'neutral', submitted: 'purple', accepted: 'green', rejected: 'amber' };
const sel = 'mt-1 block min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900';
const today = () => new Date().toISOString().slice(0, 10);

export const dueText = (c) => {
  if (c.next_due_on === null) return c.status === 'complete' ? 'completed' : 'no date set';
  if (c.days_until_due < 0) return `${Math.abs(c.days_until_due)} day(s) overdue (due ${c.next_due_on})`;
  return c.days_until_due === 0 ? `due today (${c.next_due_on})` : `due in ${c.days_until_due} day(s) (${c.next_due_on})`;
};

function ControlDialog({ onClose }) {
  const users = useList('/v1/workflows/options');
  const [f, setF] = useState({ code: '', name: '', category: 'statutory', frequency: 'monthly', regulation_ref: '', owner_user_id: '', next_due_on: '', description: '' });
  const act = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={() => onClose(false)} title="New compliance control">
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = { ...f, owner_user_id: Number(f.owner_user_id), next_due_on: f.next_due_on || null, regulation_ref: f.regulation_ref || null, description: f.description || null };
          if (await act.run(() => send('POST', `${C}/controls`, body))) onClose(true);
        }}
      >
        <FormError error={act.error} />
        <p className="m-0 text-xs text-slate-500">Take the obligation and its due date from your own compliance advisor. Nothing is pre-filled.</p>
        <Input label="Code" value={f.code} onChange={set('code')} required />
        <Input label="What must be done?" value={f.name} onChange={set('name')} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold">
            Category
            <select value={f.category} onChange={set('category')} className={sel}>
              {['statutory', 'policy', 'security', 'other'].map((k) => <option key={k}>{k}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold">
            How often
            <select value={f.frequency} onChange={set('frequency')} className={sel}>
              {['monthly', 'quarterly', 'half_yearly', 'annual', 'one_time'].map((k) => <option key={k} value={k}>{label(k)}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-xs font-semibold">
          Owner
          <select value={f.owner_user_id} onChange={set('owner_user_id')} className={sel} required>
            <option value="">Choose a person</option>
            {(users.data?.users || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <Input label={f.frequency === 'one_time' ? 'Due date (optional)' : 'First due date'} type="date" value={f.next_due_on} onChange={set('next_due_on')} required={f.frequency !== 'one_time'} />
        <Input label="Regulation or policy reference (optional)" value={f.regulation_ref} onChange={set('regulation_ref')} />
        <Button type="submit" loading={act.busy}>Create control</Button>
      </form>
    </Modal>
  );
}

function EvidenceDialog({ control, onClose }) {
  const [f, setF] = useState({ collected_on: today(), title: '', reference: '', note: '' });
  const act = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={() => onClose(false)} title={`Submit evidence: ${control.name}`}>
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act.run(() => send('POST', `${C}/controls/${control.uuid}/evidence`, { ...f, note: f.note || null }))) onClose(true);
        }}
      >
        <FormError error={act.error} />
        <p className="m-0 text-xs text-slate-500">Someone other than you must accept this before the due date moves forward.</p>
        <Input label="Date the evidence was collected" type="date" max={today()} value={f.collected_on} onChange={set('collected_on')} required />
        <Input label="Title" value={f.title} onChange={set('title')} required />
        <Input label="Where is the proof? (link, folder or document reference)" value={f.reference} onChange={set('reference')} required />
        <Textarea label="Note (optional)" value={f.note} onChange={set('note')} />
        <Button type="submit" loading={act.busy}>Submit for review</Button>
      </form>
    </Modal>
  );
}

function ControlsTab({ canManage }) {
  const list = useList(`${C}/controls`);
  const [dialog, setDialog] = useState(null);
  const [open, setOpen] = useState(null);
  const detail = useList(open ? `${C}/controls/${open}` : null);
  const act = useAction();
  const [note, setNote] = useState(null);
  if (list.loading) return <Skeleton />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  const d = list.data;
  return (
    <Card
      title="Controls"
      action={
        canManage ? (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              loading={act.busy}
              onClick={async () => {
                const r = await act.run(() => send('POST', `${C}/remind`, {}));
                if (r && r !== true) setNote(`${r.created} reminder task(s) opened, ${r.already_open} already open.`);
              }}
            >
              Send reminders
            </Button>
            <Button onClick={() => setDialog({ type: 'control' })}>New control</Button>
          </div>
        ) : null
      }
    >
      <div className="space-y-3 p-5 text-xs">
        <FormError error={act.error} />
        {note && <p role="status" className="m-0">{note}</p>}
        <p className="m-0">
          {d.summary.overdue} overdue · {d.summary.due_soon} due soon · {d.summary.awaiting_review} awaiting review · {d.summary.current} current
        </p>
        {d.items.length ? (
          <ul className="m-0 list-none space-y-3 p-0">
            {d.items.map((c) => (
              <li key={c.uuid} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <strong className="text-sm">{c.name}</strong>
                  <Badge>{c.code}</Badge>
                  <Badge tone={tone[c.status]}>{label(c.status)}</Badge>
                </div>
                <p className="m-0 mb-2 text-slate-600 dark:text-slate-300">
                  {label(c.frequency)} · {c.category} · owner {c.owner.name} · {dueText(c)}
                  {c.last_accepted_on ? ` · last accepted evidence ${c.last_accepted_on}` : ''}
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setOpen(open === c.uuid ? null : c.uuid)}>{open === c.uuid ? 'Hide evidence' : 'Evidence'}</Button>
                  {c.active && c.awaiting_review === 0 && <Button variant="secondary" onClick={() => setDialog({ type: 'evidence', control: c })}>Submit evidence</Button>}
                </div>
                {open === c.uuid && (
                  <div className="mt-3 space-y-1">
                    {detail.loading ? <Skeleton /> : (detail.data?.evidence || []).length ? detail.data.evidence.map((e) => (
                      <p key={e.uuid} className="m-0">
                        <Badge tone={tone[e.status]}>{e.status}</Badge> {e.title} · {e.collected_on} · {e.reference} · by {e.submitted_by}
                        {e.reviewed_by ? ` · reviewed by ${e.reviewed_by}${e.review_note ? `: ${e.review_note}` : ''}` : ''}
                      </p>
                    )) : <p className="m-0 text-slate-500">No evidence yet.</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No controls yet" description={d.note} />
        )}
        <p className="m-0 text-slate-500">{d.note}</p>
      </div>
      {dialog?.type === 'control' && <ControlDialog onClose={(ok) => { setDialog(null); if (ok) list.reload(); }} />}
      {dialog?.type === 'evidence' && <EvidenceDialog control={dialog.control} onClose={(ok) => { setDialog(null); if (ok) { list.reload(); detail.reload(); } }} />}
    </Card>
  );
}

function ReviewTab() {
  const q = useList(`${C}/review-queue`);
  const act = useAction();
  const [refuse, setRefuse] = useState(null);
  const [note, setNote] = useState('');
  if (q.loading) return <Skeleton />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
  return (
    <Card title="Evidence waiting for review">
      <div className="space-y-3 p-5 text-xs">
        <FormError error={act.error} />
        {q.data.items.length ? q.data.items.map((e) => (
          <div key={e.uuid} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <p className="m-0 mb-1"><strong>{e.control?.name}</strong>: {e.title}</p>
            <p className="m-0 mb-2 text-slate-600 dark:text-slate-300">Collected {e.collected_on} · proof at {e.reference} · submitted by {e.submitted_by}</p>
            {e.can_review ? (
              <div className="flex flex-wrap items-end gap-2">
                <Button loading={act.busy} onClick={async () => { if (await act.run(() => send('POST', `${C}/evidence/${e.uuid}/review`, { accept: true }))) q.reload(); }}>Accept</Button>
                <Button variant="secondary" onClick={() => { setRefuse(e.uuid); setNote(''); }}>Send back</Button>
              </div>
            ) : <p className="m-0 text-slate-500">You submitted this, so someone else must review it.</p>}
            {refuse === e.uuid && (
              <div className="mt-2 space-y-2">
                <Textarea label="What is missing?" value={note} onChange={(ev) => setNote(ev.target.value)} required />
                <Button
                  disabled={!note.trim()}
                  onClick={async () => { if (await act.run(() => send('POST', `${C}/evidence/${e.uuid}/review`, { accept: false, note }))) { setRefuse(null); q.reload(); } }}
                >
                  Send back with note
                </Button>
              </div>
            )}
          </div>
        )) : <EmptyState title="Nothing to review" description="Submitted evidence appears here for a second person to accept." />}
      </div>
    </Card>
  );
}

function PackTab() {
  const y = new Date().getFullYear();
  const [range, setRange] = useState({ from: `${y}-01-01`, to: today() });
  const [pack, setPack] = useState(null);
  const act = useAction();
  return (
    <Card title="Auditor pack">
      <div className="space-y-3 p-5 text-xs">
        <FormError error={act.error} />
        <div className="flex flex-wrap items-end gap-4">
          <Input label="From" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          <Input label="To" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          <Button loading={act.busy} onClick={async () => { const r = await act.run(() => send('GET', `${C}/pack?from=${range.from}&to=${range.to}`)); if (r && r !== true) setPack(r); }}>Build pack</Button>
        </div>
        {pack && (
          <div role="region" aria-label="Pack summary" className="space-y-2">
            <p className="m-0">{pack.controls.length} control(s) · {pack.controls_without_evidence} without accepted evidence in this period</p>
            <p className="m-0 break-all text-slate-500">Checksum (SHA-256): {pack.sha256}</p>
            <ul className="m-0 list-none space-y-1 p-0">
              {pack.controls.map((c) => (
                <li key={c.code}>{c.code} {c.name}: {c.evidence.length} accepted item(s){c.gap ? ' (gap)' : ''}</li>
              ))}
            </ul>
            <Button variant="secondary" onClick={() => { const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `compliance-pack-${pack.period.from}-to-${pack.period.to}.json`; a.click(); }}>Download JSON</Button>
            <p className="m-0 text-slate-500">{pack.note}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function CompliancePage() {
  const { can } = useAuth();
  const tabs = [{ value: 'controls', label: 'Controls' }];
  if (can('security.compliance.review')) tabs.push({ value: 'review', label: 'Review queue' }, { value: 'pack', label: 'Auditor pack' });
  const [tab, setTab] = useState('controls');
  return (
    <>
      <PageHeader eyebrow="SECURITY · COMPLIANCE" title="Compliance evidence" description="Recurring obligations, the proof that each one was met, and an independent check before it counts." />
      <Tabs items={tabs} value={tab} onChange={setTab} />
      <div className="mt-5">
        {tab === 'controls' && <ControlsTab canManage={can('security.compliance.manage')} />}
        {tab === 'review' && <ReviewTab />}
        {tab === 'pack' && <PackTab />}
      </div>
    </>
  );
}
