import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Pagination, useToast } from '../../components/ui';
import { Amount, Banner, ConfirmDialog, FormModal, ListCard, Page, StatusBadge, optionsOf, useOptions, useOrg } from '../../components/recruitment/kit';
import { AmendDialog, VersionsDrawer } from '../../components/recruitment/RequisitionVersions';
import { useAuth } from '../../lib/auth';
import { clean, newKey, pageOf, paths, send, titleCase, today, useList } from '../../lib/recruitmentApi';

const KINDS = ['new', 'replacement', 'contract', 'intern'].map((k) => ({ value: k, label: titleCase(k) }));

export function RequisitionsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const list = useList(`${paths.requisitions}?page=${page}`);
  const jobs = useList(`${paths.jobs}?page=1`);
  const users = useOptions(paths.users, (u) => u.name);
  const entities = useOrg('legal-entities');
  const departments = useOrg('departments');
  const locations = useOrg('locations');
  const positions = useOrg('positions', (p) => `${p.name}${p.metadata?.headcount != null ? ` (headcount ${p.metadata.headcount})` : ''}`);
  const [form, setForm] = useState(false);
  const [jobForm, setJobForm] = useState(false);
  const [decision, setDecision] = useState(null);
  const [closing, setClosing] = useState(null);
  const [amending, setAmending] = useState(null);
  const [versions, setVersions] = useState(null);
  const pipelines = useList(paths.pipelines);
  const manage = can('recruitment.manage');
  const seen = new Set();
  const pipelineOptions = [
    { value: '', label: 'Default pipeline' },
    ...pipelines.rows.filter((p) => p.status === 'active' && !seen.has(p.code) && seen.add(p.code)).map((p) => ({ value: p.code, label: `${p.name} (${p.code})${p.is_default ? ' - default' : ''}` })),
  ];
  const none = (o) => [{ value: '', label: 'None' }, ...o];

  const actions = (r) => (
    <div className="flex flex-wrap gap-1.5">
      {can('recruitment.approve') && r.status === 'pending' &&
        (r.can_review ? (
          <>
            <Button variant="secondary" onClick={() => setDecision({ row: r, decision: 'open' })}>Approve</Button>
            <Button variant="secondary" onClick={() => setDecision({ row: r, decision: 'rejected' })}>Reject</Button>
          </>
        ) : (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Another approver is needed</span>
        ))}
      {manage && ['pending', 'open'].includes(r.status) && <Button variant="secondary" onClick={() => setClosing(r)}>Close</Button>}
      {manage && ['pending', 'open'].includes(r.status) && <Button variant="secondary" onClick={() => setAmending(r)} aria-label={`Amend ${r.title}`}>Amend</Button>}
      <Button variant="secondary" onClick={() => setVersions(r)} aria-label={`Versions of ${r.title}`}>Versions</Button>
      {r.status === 'open' && <Link className="text-xs font-medium text-brand-700 underline dark:text-brand-300" to={`/recruitment/pipeline/${r.uuid}`}>Pipeline</Link>}
    </div>
  );
  const headcount = (r) => `${r.filled_count ?? 0} / ${r.openings}`;
  const budget = (r) => (r.budget_amount == null ? '—' : <Amount value={r.budget_amount} currency={r.budget_currency} />);

  return (
    <Page
      permission="recruitment.view"
      title="Requisitions"
      description="Request, approve and track hiring headcount."
      action={manage && (
        <>
          <Button variant="secondary" onClick={() => setJobForm(true)}>New job definition</Button>
          <Button onClick={() => setForm(true)}>New requisition</Button>
        </>
      )}
    >
      <ListCard
        title="Requisitions"
        list={list}
        columns={[
          { key: 'title', label: 'Role', render: (r) => <>{r.title} <span className="text-slate-400">v{r.job_version}</span>{r.version > 1 && <span className="ml-1 text-[11px] text-slate-500 dark:text-slate-400">(amended, rev {r.version})</span>}{r.confidential && <span className="ml-1 text-[11px]">(confidential)</span>}</> },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          { key: 'pipeline', label: 'Pipeline', priority: 'md', render: (r) => r.pipeline_code ?? '—' },
          { key: 'headcount', label: 'Filled / openings', render: headcount },
          { key: 'budget', label: 'Budget', priority: 'md', render: budget },
          { key: 'target_date', label: 'Target date', priority: 'md' },
          { key: 'actions', label: 'Actions', render: actions },
        ]}
        card={(r) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <strong className="text-sm">{r.title}</strong>
              <StatusBadge value={r.status} />
            </div>
            <p className="m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">Filled {headcount(r)} · Budget {budget(r)} · Target {r.target_date}</p>
            <div className="mt-2">{actions(r)}</div>
          </div>
        )}
        empty={{ title: 'No requisitions', description: manage ? 'Create a requisition to start hiring.' : 'Requisitions you can access will appear here.' }}
      />
      <Pagination data={list.data ? pageOf(list.data) : null} onChange={setPage} />

      <FormModal
        open={jobForm}
        onClose={() => setJobForm(false)}
        title="New job definition"
        intro="Saving the same code again creates a new version."
        fields={[
          { name: 'code', label: 'Code', hint: 'Capital letters, digits and underscore, e.g. SWE_II' },
          { name: 'title', label: 'Title' },
          { name: 'description', label: 'Description', textarea: true },
        ]}
        onSubmit={async (v) => { await send('POST', paths.jobs, v); jobs.reload(); }}
        success="Job definition saved"
      />
      <FormModal
        open={form}
        onClose={() => setForm(false)}
        title="New requisition"
        intro="Approval is needed from someone other than you. Openings may not exceed the position headcount."
        initial={{ kind: 'new', openings: '1', target_date: today(), budget_currency: '', pipeline_code: '' }}
        submitLabel="Submit for approval"
        fields={[
          { name: 'job_uuid', label: 'Job', options: optionsOf(jobs.rows, (j) => `${j.title} v${j.version}`) },
          { name: 'legal_entity_id', label: 'Legal entity', options: entities },
          { name: 'position_id', label: 'Position', required: false, options: none(positions) },
          { name: 'department_id', label: 'Department', required: false, options: none(departments) },
          { name: 'location_id', label: 'Location', required: false, options: none(locations) },
          { name: 'recruiter_id', label: 'Recruiter', options: users },
          { name: 'hiring_manager_id', label: 'Hiring manager', options: users },
          { name: 'pipeline_code', label: 'Hiring pipeline', required: false, options: pipelineOptions },
          { name: 'kind', label: 'Kind', options: KINDS },
          { name: 'openings', label: 'Openings (headcount)', type: 'number' },
          { name: 'target_date', label: 'Target date', type: 'date' },
          { name: 'budget_amount', label: 'Budget amount', type: 'number', required: false },
          { name: 'budget_currency', label: 'Budget currency (3 letters)', required: false },
          { name: 'reason', label: 'Reason', textarea: true },
          { name: 'confidential', label: 'Confidential requisition', type: 'checkbox' },
        ]}
        onSubmit={async (v) => {
          await send('POST', paths.requisitions, { ...clean(v), openings: Number(v.openings), confidential: Boolean(v.confidential), idempotency_key: newKey() });
          list.reload();
        }}
        success="Requisition submitted"
      />
      <AmendDialog req={amending} departments={departments} locations={locations} onClose={() => setAmending(null)} onDone={list.reload} />
      <VersionsDrawer req={versions} onClose={() => setVersions(null)} onChanged={list.reload} />
      <ConfirmDialog
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        title={decision?.decision === 'open' ? 'Approve requisition?' : 'Reject requisition?'}
        intro={`${decision?.row.title}: ${decision?.row.openings} opening(s). ${decision?.decision === 'open' ? 'The recruiter is notified to start sourcing.' : 'The requisition will be rejected.'}`}
        confirmLabel={decision?.decision === 'open' ? 'Approve' : 'Reject'}
        danger={decision?.decision === 'rejected'}
        onConfirm={async () => { await send('POST', paths.requisition(decision.row.uuid, 'decision'), { decision: decision.decision }); toast(decision.decision === 'open' ? 'Requisition approved' : 'Requisition rejected'); list.reload(); }}
      />
      <ConfirmDialog
        open={Boolean(closing)}
        onClose={() => setClosing(null)}
        title="Close requisition?"
        intro="Published postings for this requisition are closed too."
        confirmLabel="Close requisition"
        danger
        onConfirm={async () => { await send('POST', paths.requisition(closing.uuid, 'close')); toast('Requisition closed'); list.reload(); }}
      />
    </Page>
  );
}

export function PostingsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const list = useList(`${paths.postings}?page=${page}`);
  const reqs = useList(`${paths.requisitions}?page=1`);
  const [form, setForm] = useState(false);
  const [act, setAct] = useState(null);
  const manage = can('recruitment.manage');
  const actions = (p) => (
    <div className="flex gap-1.5">
      {manage && p.status === 'draft' && <Button variant="secondary" onClick={() => setAct({ row: p, part: 'publish' })}>Publish</Button>}
      {manage && p.status === 'published' && <Button variant="secondary" onClick={() => setAct({ row: p, part: 'close' })}>Close</Button>}
    </div>
  );
  return (
    <Page permission="recruitment.view" title="Job postings" description="Draft, publish and close postings for open requisitions." action={manage && <Button onClick={() => setForm(true)}>New posting</Button>}>
      <Banner tone="info">Publishing goes through the configured job-board channel. Until a channel is connected the posting is marked published internally.</Banner>
      <ListCard
        title="Postings"
        list={list}
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'channel', label: 'Channel', priority: 'md', render: (p) => titleCase(p.channel) },
          { key: 'status', label: 'Status', render: (p) => <StatusBadge value={p.status} /> },
          { key: 'closes_on', label: 'Closes', priority: 'md' },
          { key: 'actions', label: 'Actions', render: actions },
        ]}
        card={(p) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <strong className="text-sm">{p.title}</strong>
              <StatusBadge value={p.status} />
            </div>
            <p className="m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">{titleCase(p.channel)}{p.closes_on ? ` · closes ${p.closes_on}` : ''}</p>
            <div className="mt-2">{actions(p)}</div>
          </div>
        )}
        empty={{ title: 'No postings', description: 'Create a posting for an open requisition.' }}
      />
      <Pagination data={list.data ? pageOf(list.data) : null} onChange={setPage} />
      <FormModal
        open={form}
        onClose={() => setForm(false)}
        title="New posting"
        initial={{ channel: 'internal' }}
        fields={[
          { name: 'requisition_uuid', label: 'Requisition', options: optionsOf(reqs.rows.filter((r) => ['pending', 'open'].includes(r.status)), (r) => `${r.title} (${r.status})`) },
          { name: 'title', label: 'Posting title' },
          { name: 'description', label: 'Description', textarea: true },
          { name: 'channel', label: 'Channel', options: ['internal', 'external', 'referral'].map((c) => ({ value: c, label: titleCase(c) })) },
          { name: 'location_text', label: 'Location', required: false },
          { name: 'closes_on', label: 'Closes on', type: 'date', required: false },
        ]}
        onSubmit={async (v) => { await send('POST', paths.postings, clean(v)); list.reload(); }}
        success="Posting saved as draft"
      />
      <ConfirmDialog
        open={Boolean(act)}
        onClose={() => setAct(null)}
        title={act?.part === 'publish' ? 'Publish posting?' : 'Close posting?'}
        intro={act?.part === 'publish' ? 'The requisition must be open. Candidates may start applying.' : 'The posting stops accepting applications.'}
        confirmLabel={act?.part === 'publish' ? 'Publish' : 'Close posting'}
        onConfirm={async () => { await send('POST', paths.posting(act.row.uuid, act.part)); toast(act.part === 'publish' ? 'Posting published' : 'Posting closed'); list.reload(); }}
      />
    </Page>
  );
}
