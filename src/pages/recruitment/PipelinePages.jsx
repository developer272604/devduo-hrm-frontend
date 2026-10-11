import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Modal, Skeleton, ErrorState, EmptyState, Card } from '../../components/ui';
import { Banner, FormModal, ListCard, Page, StatusBadge, optionsOf, useAll } from '../../components/recruitment/kit';
import { useAuth } from '../../lib/auth';
import { clean, stagesFor, fmtDate, newKey, paths, send, titleCase, useList } from '../../lib/recruitmentApi';
import { api } from '../../lib/api';
import { useEffect } from 'react';

export function PipelineIndexPage() {
  const list = useList(`${paths.requisitions}?page=1`);
  return (
    <Page permission="recruitment.view" title="Pipeline" description="Choose a requisition to see its candidates by stage.">
      <ListCard
        title="Open requisitions"
        list={list}
        rows={list.rows.filter((r) => r.status === 'open')}
        columns={[
          { key: 'title', label: 'Role' },
          { key: 'openings', label: 'Openings', priority: 'md', render: (r) => `${r.filled_count ?? 0} / ${r.openings}` },
          { key: 'open', label: '', render: (r) => <Link className="text-xs font-medium underline" to={`/recruitment/pipeline/${r.uuid}`}>Open board</Link> },
        ]}
        mobile={{ title: 'title', subtitle: (r) => `${r.filled_count ?? 0} / ${r.openings} filled`, badge: (r) => <Link className="text-xs underline" to={`/recruitment/pipeline/${r.uuid}`}>Open</Link> }}
        empty={{ title: 'No open requisitions', description: 'Approve a requisition to start a pipeline.' }}
      />
    </Page>
  );
}

/** Stage history for one application. */
function HistoryDrawer({ app, onClose }) {
  const [state, setState] = useState({ loading: true, rows: [], error: null });
  useEffect(() => {
    if (!app) return undefined;
    let live = true;
    setState({ loading: true, rows: [], error: null });
    api(paths.history(app.uuid))
      .then((r) => live && setState({ loading: false, rows: r?.data ?? [], error: null }))
      .catch((error) => live && setState({ loading: false, rows: [], error }));
    return () => {
      live = false;
    };
  }, [app]);
  return (
    <Modal open={Boolean(app)} onClose={onClose} title={`History: ${app?.candidate_name ?? ''}`} drawer>
      <div className="px-6 pb-6">
        {state.loading ? (
          <Skeleton rows={3} />
        ) : state.error ? (
          <ErrorState error={state.error} />
        ) : state.rows.length === 0 ? (
          <EmptyState title="No history yet" description="Stage changes appear here." />
        ) : (
          <ol className="m-0 list-none space-y-3 p-0">
            {state.rows.map((h) => (
              <li key={h.uuid} className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
                <strong>
                  {h.from_stage ? `${titleCase(h.from_stage)} → ` : ''}
                  {titleCase(h.to_stage)}
                </strong>{' '}
                <StatusBadge value={h.status} />
                <p className="m-0 mt-1">{h.reason}</p>
                <small className="text-slate-500 dark:text-slate-400">{fmtDate(h.created_at)}</small>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  );
}

function AppCard({ app, manage, stages, onMove, onHistory }) {
  const at = stages.findIndex((s) => s.code === app.stage);
  const nextStage = at >= 0 ? stages[at + 1] : null;
  // hired / rejected stages are never reached by a plain move
  const next = nextStage && ['active', 'offer'].includes(nextStage.kind) ? nextStage.code : null;
  const nextLabel = nextStage?.label ?? titleCase(next ?? '');
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900">
      <Link className="text-sm font-semibold underline" to={`/recruitment/candidates/${app.candidate_uuid}`}>
        {app.candidate_name}
      </Link>
      <p className="m-0 mt-1 text-slate-500 dark:text-slate-400">
        {app.source} · since {fmtDate(app.stage_entered_at)}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {manage && next && (
          <Button variant="secondary" onClick={() => onMove(app, { stage: next, status: 'active' })} aria-label={`Move ${app.candidate_name} to ${nextLabel}`}>
            Move to {nextLabel}
          </Button>
        )}
        {manage && (
          <Button variant="secondary" onClick={() => onMove(app, { stage: app.stage, status: 'rejected' })} aria-label={`Reject ${app.candidate_name}`}>
            Reject
          </Button>
        )}
        <Button variant="secondary" onClick={() => onHistory(app)} aria-label={`History for ${app.candidate_name}`}>
          History
        </Button>
      </div>
    </li>
  );
}

export function PipelinePage() {
  const { uuid } = useParams();
  const { can } = useAuth();
  const manage = can('recruitment.manage');
  const all = useAll(paths.applications);
  const candidates = useAll(paths.candidates);
  const reqs = useList(`${paths.requisitions}?page=1`);
  const pipelines = useList(paths.pipelines);
  const [move, setMove] = useState(null);
  const [history, setHistory] = useState(null);
  const [add, setAdd] = useState(false);
  const req = reqs.rows.find((r) => r.uuid === uuid);
  const stages = stagesFor(req, pipelines.rows);
  const apps = all.rows.filter((a) => a.requisition_uuid === uuid);
  const active = apps.filter((a) => a.status === 'active');
  const closed = apps.length - active.length;

  return (
    <Page
      permission="recruitment.view"
      title={req ? `Pipeline: ${req.title}` : 'Pipeline'}
      description="Candidates by stage. Every move records a reason in the history."
      action={manage && <Button onClick={() => setAdd(true)}>Add candidate</Button>}
    >
      {all.loading ? (
        <Card><Skeleton /></Card>
      ) : all.error ? (
        <Card><ErrorState error={all.error} onRetry={all.reload} /></Card>
      ) : apps.length === 0 ? (
        <Card><EmptyState title="No candidates in this pipeline" description={manage ? 'Add a candidate to start.' : 'Applications will appear here.'} /></Card>
      ) : (
        <>
          <div className="grid gap-4 md:auto-cols-[minmax(11rem,1fr)] md:grid-flow-col md:overflow-x-auto" role="list" aria-label="Pipeline stages">
            {stages.map((st) => {
              const stage = st.code;
              const here = active.filter((a) => a.stage === stage);
              return (
                <section key={stage} role="listitem" aria-label={`${st.label ?? titleCase(stage)} stage`} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                  <h3 className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {st.label ?? titleCase(stage)} <span className="font-normal">({here.length})</span>
                    {st.sla_hours ? <span className="ml-1 font-normal normal-case">SLA {st.sla_hours} h</span> : null}
                  </h3>
                  {here.length === 0 ? (
                    <p className="m-0 text-xs text-slate-500 dark:text-slate-400">No one here</p>
                  ) : (
                    <ul className="m-0 grid list-none gap-2 p-0">
                      {here.map((a) => (
                        <AppCard key={a.uuid} app={a} manage={manage} stages={stages} onMove={(app, to) => setMove({ app, ...to })} onHistory={setHistory} />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
          {closed > 0 && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{closed} application(s) are rejected or withdrawn and not shown on the board.</p>}
        </>
      )}

      <FormModal
        open={Boolean(move)}
        onClose={() => setMove(null)}
        title={move?.status === 'rejected' ? `Reject ${move?.app.candidate_name}` : `Move ${move?.app.candidate_name} to ${stages.find((s) => s.code === move?.stage)?.label ?? titleCase(move?.stage ?? '')}`}
        intro="The reason is saved in the application history."
        submitLabel={move?.status === 'rejected' ? 'Reject' : 'Move'}
        fields={[{ name: 'reason', label: 'Reason', textarea: true }]}
        onSubmit={async (v) => {
          await send('POST', paths.transition(move.app.uuid), { stage: move.stage, expected_stage: move.app.stage, status: move.status, reason: v.reason, idempotency_key: newKey() });
          all.reload();
        }}
        success="Application updated"
      />
      <FormModal
        open={add}
        onClose={() => setAdd(false)}
        title="Add candidate to pipeline"
        initial={{ source: 'direct' }}
        fields={[
          { name: 'candidate_uuid', label: 'Candidate', options: optionsOf(candidates.rows.filter((c) => !apps.some((a) => a.candidate_uuid === c.uuid)), (c) => c.name) },
          { name: 'source', label: 'Source' },
        ]}
        onSubmit={async (v) => { await send('POST', paths.applications, clean({ ...v, requisition_uuid: uuid })); all.reload(); }}
        success="Candidate added to pipeline"
      />
      <HistoryDrawer app={history} onClose={() => setHistory(null)} />
      {!manage && <Banner tone="info">You can view this pipeline but not change it.</Banner>}
    </Page>
  );
}
