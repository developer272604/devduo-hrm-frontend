import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, ErrorState, Pagination, Skeleton } from '../../components/ui';
import { Banner, ConfirmDialog, FormModal, KeyValues, ListCard, StatusBadge, useDo } from '../../components/payroll/kit';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { invalid, pageOf, paths, pipActions, send, today, unwrap, useList, validatePip } from '../../lib/performanceApi';
import { Page, PersonPicker } from './parts';

export const PIP_NOTICE = 'Confidential. Improvement plans are visible only to HR, the employee (once active) and the people HR involves. Every view and change is audited. Do not share or forward details. Outcomes are decided by people and never change pay, grade or employment automatically.';

export function PipsPage() {
  const [page, setPage] = useState(1);
  const [create, setCreate] = useState(false);
  const [person, setPerson] = useState('');
  const list = useList(`${paths.pips}?page=${page}`);
  const { can } = useAuth();
  return (
    <Page permission="performance.pip.manage" title="Improvement plans" description="Structured, supportive plans with checkpoints." action={can('performance.pip.manage') && <Button onClick={() => { setPerson(''); setCreate(true); }}>Create plan</Button>}>
      <Banner tone="warn" title="Confidential">{PIP_NOTICE}</Banner>
      <ListCard
        title="Plans you can manage"
        list={list}
        columns={[
          { key: 'employee', label: 'Employee', render: (p) => p.employee?.name },
          { key: 'period', label: 'Period', priority: 'md', render: (p) => `${p.start_date} to ${p.end_date}` },
          { key: 'status', label: 'Status', render: (p) => <StatusBadge value={p.status} /> },
          { key: 'open', label: '', render: (p) => <Link className="text-brand-700 dark:text-brand-300" to={`/performance/pips/${p.uuid}`}>Open plan</Link> },
        ]}
        mobile={{ title: (p) => p.employee?.name, subtitle: (p) => `${p.start_date} to ${p.end_date}`, badge: (p) => <StatusBadge value={p.status} /> }}
        empty={{ title: 'No improvement plans', description: 'Plans you create appear here. Draft plans are invisible to the employee until activated.' }}
      />
      <Pagination data={list.data ? pageOf(list.data) : null} onChange={setPage} />
      <FormModal
        open={create}
        onClose={() => setCreate(false)}
        title="Create an improvement plan"
        intro="The plan starts as a draft. The employee cannot see it and is not notified until you activate it."
        initial={{ reason: '', support_plan: '', start_date: today(), end_date: '', checkpoints: '' }}
        fields={[
          { name: 'reason', label: 'Reason and expectations', textarea: true, hint: 'At least 10 characters. Stick to observable facts.' },
          { name: 'support_plan', label: 'Support you will provide', textarea: true, required: false },
          { name: 'start_date', label: 'Start date', type: 'date' },
          { name: 'end_date', label: 'End date', type: 'date' },
          { name: 'checkpoints', label: 'Checkpoints', textarea: true, required: false, hint: 'One per line: 2026-11-15 | What good looks like. Dates must fall inside the plan period.' },
        ]}
        extra={() => <PersonPicker label="Employee" value={person} onChange={setPerson} />}
        onSubmit={async (v) => { await send('POST', paths.pips, validatePip({ ...v, employee_uuid: person })); list.reload(); }}
        success="Improvement plan created as a draft"
      />
    </Page>
  );
}

export function PipDetailPage() {
  const { uuid } = useParams();
  const res = useList(paths.pip(uuid));
  const pip = unwrap(res.data);
  const actions = useDo();
  const [activating, setActivating] = useState(false);
  const [checkpoint, setCheckpoint] = useState(null);
  const [completing, setCompleting] = useState(false);
  const gate = pipActions(pip?.status);
  return (
    <Page permission="performance.pip.manage" title={pip ? `Improvement plan: ${pip.employee?.name ?? ''}` : 'Improvement plan'} description="Review the plan, record checkpoints and close it with a documented outcome.">
      <Banner tone="warn" title="Confidential">{PIP_NOTICE}</Banner>
      {res.loading ? <Skeleton /> : res.error ? <ErrorState error={res.error} onRetry={res.reload} /> : pip && (
        <>
          <Card title="Plan" className="mb-5" action={<div className="flex gap-2">
            {gate.activate && <Button onClick={() => setActivating(true)}>Activate plan</Button>}
            {gate.complete && <Button variant="secondary" onClick={() => setCompleting(true)}>Complete plan</Button>}
          </div>}>
            <div className="px-6 pb-5 text-sm">
              <p className="mt-0"><StatusBadge value={pip.status} /> {pip.start_date} to {pip.end_date}</p>
              <KeyValues data={{ reason: pip.reason, support_plan: pip.support_plan, outcome_note: pip.outcome_note }} />
              {pip.status === 'draft' && <p className="text-xs text-slate-600 dark:text-slate-300">This plan is a draft: the employee cannot see it. Checkpoints can be recorded only after activation.</p>}
            </div>
          </Card>
          <ListCard
            title="Checkpoints"
            list={{ loading: false, error: null, rows: pip.checkpoints ?? [] }}
            columns={[
              { key: 'due_on', label: 'Due' },
              { key: 'expectation', label: 'Expectation' },
              { key: 'status', label: 'Result', render: (c) => <StatusBadge value={c.status} /> },
              { key: 'note', label: 'Note', priority: 'md' },
              { key: 'action', label: '', render: (c) => gate.checkpoint && <Button variant="secondary" onClick={() => setCheckpoint(c)}>Record result</Button> },
            ]}
            mobile={{ title: 'expectation', subtitle: 'due_on', badge: (c) => <StatusBadge value={c.status} /> }}
            empty={{ title: 'No checkpoints', description: 'This plan has no scheduled checkpoints.' }}
          />
        </>
      )}
      <ConfirmDialog
        open={activating}
        onClose={() => setActivating(false)}
        title="Activate this plan?"
        intro="The employee will be notified and can read the plan from this moment. Make sure you have discussed it with them."
        confirmLabel="Activate and notify"
        onConfirm={async () => { await actions.run('activate', () => api(paths.pip(uuid, 'activate'), { method: 'POST' }), 'Plan activated'); res.reload(); }}
      />
      <FormModal
        open={Boolean(checkpoint)}
        onClose={() => setCheckpoint(null)}
        title={`Record checkpoint due ${checkpoint?.due_on ?? ''}`}
        intro={checkpoint?.expectation}
        initial={{ status: 'met', note: '' }}
        fields={[
          { name: 'status', label: 'Result', options: [{ value: 'met', label: 'Met' }, { value: 'partially_met', label: 'Partially met' }, { value: 'not_met', label: 'Not met' }] },
          { name: 'note', label: 'Note', textarea: true, required: false },
        ]}
        onSubmit={async (v) => { await send('POST', paths.pip(uuid, `checkpoints/${checkpoint.uuid}`), { status: v.status, note: v.note || undefined }); res.reload(); }}
        success="Checkpoint recorded"
      />
      <FormModal
        open={completing}
        onClose={() => setCompleting(false)}
        title="Complete this plan"
        intro="Closing a plan records a documented outcome. It does not change pay, grade or employment: any such decision is made separately by people."
        initial={{ outcome: 'success', note: '', confirm: false }}
        fields={[
          { name: 'outcome', label: 'Outcome', options: [{ value: 'success', label: 'Completed successfully' }, { value: 'unsuccessful', label: 'Completed unsuccessfully' }, { value: 'cancelled', label: 'Cancelled' }] },
          { name: 'note', label: 'Outcome note', textarea: true, hint: 'At least 5 characters.' },
          { name: 'confirm', label: 'I understand this is a human decision and nothing is applied automatically', type: 'checkbox' },
        ]}
        onSubmit={async (v) => {
          if (!v.confirm) throw invalid('confirm', 'Please confirm before closing the plan.');
          if (v.outcome === 'success' && (pip.checkpoints ?? []).some((c) => c.status === 'pending')) throw invalid('outcome', 'Record every checkpoint before closing the plan as successful.');
          await send('POST', paths.pip(uuid, 'complete'), { outcome: v.outcome, note: v.note });
          res.reload();
        }}
        success="Plan closed with a documented outcome"
      />
    </Page>
  );
}
