import { useState } from 'react';
import { Button, Card, ErrorState, Pagination, Skeleton, Tabs } from '../../components/ui';
import { Banner, FormModal, ListCard, StatusBadge, useDo } from '../../components/payroll/kit';
import { useAuth } from '../../lib/auth';
import { clean, invalid, pageOf, paths, send, titleCase, useList } from '../../lib/performanceApi';
import { Page, PersonPicker } from './parts';

export const FEEDBACK_NOTICE = 'Direct feedback shows your name to the recipient. It is visible only to the recipient unless you choose to share it with their manager. HR does not see it by default. Anonymous input exists only inside formal peer reviews, where reviewers are hidden until the minimum response count is met.';

const senderOf = (f) => (f.from ? f.from : f.mine ? 'You' : 'Anonymous sender');

export function FeedbackPage() {
  const [tab, setTab] = useState('received');
  const [page, setPage] = useState(1);
  const [give, setGive] = useState(false);
  const [person, setPerson] = useState('');
  const list = useList(`${tab === 'received' ? paths.feedback + '/received' : paths.feedback + '/given'}?page=${page}`);
  return (
    <Page permission="performance.self" title="Feedback" description="Give and receive feedback and recognition." action={<Button onClick={() => { setPerson(''); setGive(true); }}>Give feedback</Button>}>
      <Banner tone="info" title="Privacy and anonymity">{FEEDBACK_NOTICE}</Banner>
      <Tabs items={[{ value: 'received', label: 'Received' }, { value: 'given', label: 'Given' }]} value={tab} onChange={(v) => { setTab(v); setPage(1); }} />
      <div className="mt-5">
        <ListCard
          title={tab === 'received' ? 'Feedback you received' : 'Feedback you gave'}
          list={list}
          columns={[
            { key: 'kind', label: 'Type', render: (f) => titleCase(f.kind) },
            { key: 'message', label: 'Message' },
            { key: 'from', label: tab === 'received' ? 'From' : 'Shared with', priority: 'md', render: (f) => (tab === 'received' ? senderOf(f) : f.visibility === 'recipient_manager' ? 'Recipient and their manager' : 'Recipient only') },
            { key: 'at', label: 'Date', priority: 'md', render: (f) => (f.at ? f.at.slice(0, 10) : '-') },
          ]}
          mobile={{ title: 'message', subtitle: (f) => (tab === 'received' ? `From ${senderOf(f)}` : f.visibility === 'recipient_manager' ? 'Shared with manager' : 'Recipient only'), badge: (f) => <StatusBadge value={f.kind === 'recognition' ? 'approved' : 'open'} />, facts: [{ label: 'Type', value: (f) => titleCase(f.kind) }] }}
          empty={{ title: tab === 'received' ? 'No feedback yet' : 'You have not given feedback yet', description: 'Feedback and recognition appear here.' }}
        />
        <Pagination data={list.data ? pageOf(list.data) : null} onChange={setPage} />
      </div>
      <FormModal
        open={give}
        onClose={() => setGive(false)}
        title="Give feedback"
        intro={FEEDBACK_NOTICE}
        initial={{ kind: 'feedback', visibility: 'recipient', message: '' }}
        fields={[
          { name: 'kind', label: 'Type', options: [{ value: 'feedback', label: 'Feedback' }, { value: 'recognition', label: 'Recognition' }, { value: 'development', label: 'Development suggestion' }] },
          { name: 'visibility', label: 'Who can read it', options: [{ value: 'recipient', label: 'Only the recipient (default)' }, { value: 'recipient_manager', label: 'The recipient and their manager' }] },
          { name: 'message', label: 'Message', textarea: true, hint: 'Be specific and kind. At least 3 characters.' },
        ]}
        extra={() => <PersonPicker label="Recipient" value={person} onChange={setPerson} />}
        onSubmit={async (v) => {
          if (!person) throw invalid('employee_uuid', 'Choose who receives this feedback.');
          await send('POST', paths.feedback, { ...clean(v), employee_uuid: person });
          setTab('given');
          list.reload();
        }}
        submitLabel="Send feedback"
        success="Feedback sent"
      />
    </Page>
  );
}

export function OneOnOnesPage() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [person, setPerson] = useState('');
  const list = useList(`${paths.oneOnOnes}?page=${page}`);
  return (
    <Page permission="performance.self" title="1:1 notes" description="Keep notes for one-to-one conversations. Private notes stay with you." action={<Button onClick={() => { setPerson(''); setOpen(true); }}>Record a 1:1</Button>}>
      <Banner tone="info" title="Private by default">Private notes are visible only to you and are encrypted. Shared notes and action items are visible to the employee and the manager who wrote them. HR and administrators cannot read 1:1 notes.</Banner>
      <ListCard
        title="Your 1:1 notes"
        list={list}
        columns={[
          { key: 'held_on', label: 'Date' },
          { key: 'employee', label: 'With', render: (n) => n.employee?.name },
          { key: 'shared_notes', label: 'Shared notes', render: (n) => n.shared_notes || '-' },
          { key: 'private', label: 'Private notes', priority: 'md', render: (n) => (n.private_notes ? <span><StatusBadge value="draft" /> {n.private_notes}</span> : n.mine ? 'None' : 'Not visible to you') },
          { key: 'items', label: 'Action items', priority: 'lg', render: (n) => (n.action_items ?? []).map((a) => a.text).join('; ') || '-' },
        ]}
        card={(n) => (
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2"><strong>{n.employee?.name}</strong><span className="text-xs">{n.held_on}</span></div>
            <p className="mb-1 mt-2 text-xs"><span className="font-semibold">Shared:</span> {n.shared_notes || '-'}</p>
            {n.private_notes && <p className="my-1 text-xs"><span className="font-semibold">Private (only you):</span> {n.private_notes}</p>}
            {(n.action_items ?? []).length > 0 && <ul className="mb-0 mt-1 list-disc pl-5 text-xs">{n.action_items.map((a, i) => <li key={i}>{a.text} ({titleCase(a.owner ?? 'employee')})</li>)}</ul>}
          </div>
        )}
        mobile={{ title: (n) => n.employee?.name, subtitle: 'held_on' }}
        empty={{ title: 'No 1:1 notes', description: 'Record a conversation to start the journal.' }}
      />
      <Pagination data={list.data ? pageOf(list.data) : null} onChange={setPage} />
      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Record a 1:1"
        intro="Choose the employee the conversation is about: yourself for your own journal, or one of your direct reports."
        initial={{ held_on: new Date().toLocaleDateString('en-CA'), shared_notes: '', private_notes: '', action_items: '' }}
        fields={[
          { name: 'held_on', label: 'Date held', type: 'date' },
          { name: 'shared_notes', label: 'Shared notes (the employee can read these)', textarea: true, required: false },
          { name: 'private_notes', label: 'Private notes (only you can read these)', textarea: true, required: false },
          { name: 'action_items', label: 'Action items', textarea: true, required: false, hint: 'One per line. Prefix with "manager:" or "employee:" to set the owner.' },
        ]}
        extra={() => <PersonPicker label="Employee" value={person} onChange={setPerson} />}
        onSubmit={async (v) => {
          if (!person) throw invalid('employee_uuid', 'Choose the employee.');
          if (!v.shared_notes && !v.private_notes) throw invalid('shared_notes', 'Write at least one note.');
          const action_items = String(v.action_items).split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
            const m = l.match(/^(manager|employee):\s*(.*)$/i);
            return m ? { text: m[2], owner: m[1].toLowerCase() } : { text: l, owner: 'employee' };
          });
          await send('POST', paths.oneOnOnes, clean({ employee_uuid: person, held_on: v.held_on, shared_notes: v.shared_notes, private_notes: v.private_notes, action_items: action_items.length ? action_items : undefined }));
          list.reload();
        }}
        success="1:1 recorded"
      />
    </Page>
  );
}

function PlanCard({ plan, canEdit, onAdd, onStatus, busy }) {
  const done = plan.actions.filter((a) => a.status === 'done').length;
  return (
    <Card className="mb-4" title={plan.title} action={<StatusBadge value={plan.status} />}>
      <div className="px-6 pb-5 text-xs">
        <p className="mt-0 text-slate-600 dark:text-slate-300">{plan.employee?.name}{plan.target_date ? ` - target ${plan.target_date}` : ''} - {done} of {plan.actions.length} actions done</p>
        {plan.description && <p>{plan.description}</p>}
        <ul className="m-0 list-none space-y-2 p-0">
          {plan.actions.map((a) => (
            <li key={a.uuid} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              <span><strong>{a.title}</strong>{a.due_on ? ` - due ${a.due_on}` : ''}{a.learning_ref ? ` - learning ${a.learning_ref}` : ''}</span>
              <span className="flex items-center gap-2">
                <StatusBadge value={a.status} />
                {canEdit && a.status !== 'done' && a.status !== 'cancelled' && (
                  <>
                    {a.status === 'open' && <Button variant="secondary" disabled={busy} onClick={() => onStatus(a, 'in_progress')} aria-label={`Start ${a.title}`}>Start</Button>}
                    <Button variant="secondary" disabled={busy} onClick={() => onStatus(a, 'done')} aria-label={`Mark ${a.title} done`}>Mark done</Button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
        {canEdit && <Button className="mt-3" variant="secondary" onClick={() => onAdd(plan)}>Add action</Button>}
      </div>
    </Card>
  );
}

function MyImprovementPlan() {
  const res = useList(`${paths.pips}/mine`);
  const plans = res.rows;
  if (res.loading || res.error || !plans.length) return null;
  return (
    <Card title="Your improvement plan" className="mb-5">
      <div className="px-6 pb-5">
        <Banner tone="info" title="Confidential">This plan is visible only to you, your manager and HR. It records expectations, support and checkpoints. Outcomes are decided by people, never automatically.</Banner>
        {plans.map((p) => (
          <div key={p.uuid} className="mb-4 text-xs">
            <p className="mt-0"><StatusBadge value={p.status} /> {p.start_date} to {p.end_date}</p>
            <p><strong>Reason:</strong> {p.reason}</p>
            {p.support_plan && <p><strong>Support:</strong> {p.support_plan}</p>}
            <ul className="list-disc pl-5">{(p.checkpoints ?? []).map((c) => <li key={c.uuid}>{c.due_on}: {c.expectation} ({titleCase(c.status)}){c.note ? ` - ${c.note}` : ''}</li>)}</ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function DevelopmentPage() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const plans = useList(`${paths.plans}?page=${page}`);
  const actions = useDo();
  const [create, setCreate] = useState(false);
  const [addTo, setAddTo] = useState(null);
  const [person, setPerson] = useState('');
  const mayForOthers = can('performance.goals.manage');
  const rows = plans.rows;
  const setStatus = async (a, status) => {
    await actions.run(a.uuid, () => send('PATCH', paths.action(a.uuid), { status }), status === 'done' ? 'Action completed' : 'Action started');
    plans.reload();
  };
  return (
    <Page permission="performance.self|performance.view" title="Development plans" description="Plan skills and growth with concrete actions." action={can('performance.self|performance.goals.manage') && <Button onClick={() => { setPerson(''); setCreate(true); }}>Create plan</Button>}>
      <MyImprovementPlan />
      {plans.loading ? <Skeleton /> : plans.error ? <ErrorState error={plans.error} onRetry={plans.reload} /> : rows.length === 0 ? (
        <Card><p className="m-0 text-sm text-slate-500 dark:text-slate-400">No development plans yet. Create one with a few actions to get started.</p></Card>
      ) : rows.map((p) => <PlanCard key={p.uuid} plan={p} canEdit={can('performance.self|performance.goals.manage')} busy={Boolean(actions.busy)} onAdd={setAddTo} onStatus={setStatus} />)}
      <Pagination data={plans.data ? pageOf(plans.data) : null} onChange={setPage} />
      <FormModal
        open={create}
        onClose={() => setCreate(false)}
        title="Create a development plan"
        intro={mayForOthers ? 'Leave the person empty to create the plan for yourself.' : 'The plan is created for you.'}
        initial={{ title: '', description: '', target_date: '', first_action: '' }}
        fields={[
          { name: 'title', label: 'Plan title' },
          { name: 'description', label: 'Description', textarea: true, required: false },
          { name: 'target_date', label: 'Target date', type: 'date', required: false },
          { name: 'first_action', label: 'First action', required: false },
        ]}
        extra={() => mayForOthers && <PersonPicker label="Employee" value={person} onChange={setPerson} />}
        onSubmit={async (v) => {
          await send('POST', paths.plans, clean({ employee_uuid: mayForOthers ? person : '', title: v.title, description: v.description, target_date: v.target_date, actions: v.first_action ? [{ title: v.first_action }] : undefined }));
          plans.reload();
        }}
        success="Development plan created"
      />
      <FormModal
        open={Boolean(addTo)}
        onClose={() => setAddTo(null)}
        title={`Add an action to ${addTo?.title ?? ''}`}
        fields={[
          { name: 'title', label: 'Action' },
          { name: 'due_on', label: 'Due date', type: 'date', required: false },
          { name: 'learning_ref', label: 'Learning reference', required: false },
        ]}
        onSubmit={async (v) => { await send('POST', paths.planActions(addTo.uuid), clean(v)); plans.reload(); }}
        success="Action added"
      />
    </Page>
  );
}

