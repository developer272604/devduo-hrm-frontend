import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, ErrorState, Pagination, Select, Skeleton } from '../../components/ui';
import { PeerPanel } from './PeerPanel';
import { Page } from './parts';
import { FormModal, ListCard, StatusBadge, Tiles, useDo } from '../../components/payroll/kit';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { clean, pageOf, paths, send, titleCase, today, unwrap, useList } from '../../lib/performanceApi';

const pct = (n) => `${Number(n ?? 0)}%`;

export function GoalsPage() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [create, setCreate] = useState(false);
  const [checkin, setCheckin] = useState(null);
  const list = useList(`${paths.goals}?page=${page}`);
  const mayManage = can('performance.self|performance.goals.manage');
  const actions = useDo();
  const submitGoal = async (g) => {
    await actions.run('submit', () => send('POST', paths.goal(g.uuid, 'submit'), {}), 'Goal submitted for approval');
    list.reload();
  };
  return (
    <Page
      permission="performance.self|performance.view"
      title="Goals and OKRs"
      description="Track measurable goals and progress. Goal status and access are enforced by the server."
      action={mayManage && <Button onClick={() => setCreate(true)}>Create a goal</Button>}
    >
      <ListCard
        title="Visible goals"
        list={list}
        columns={[
          { key: 'title', label: 'Goal' },
          { key: 'owner', label: 'Owner', priority: 'md', render: (g) => g.owner?.name ?? 'Company' },
          { key: 'level', label: 'Level', priority: 'md', render: (g) => titleCase(g.level) },
          { key: 'progress', label: 'Progress', render: (g) => pct(g.progress) },
          { key: 'status', label: 'Status', render: (g) => <StatusBadge value={g.status} /> },
          {
            key: 'action', label: 'Action', render: (g) => mayManage && ['active', 'draft'].includes(g.status) && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setCheckin(g)}>Add check-in</Button>
                {g.status === 'draft' && g.mine !== false && <Button variant="secondary" onClick={() => submitGoal(g)}>Submit for approval</Button>}
              </div>
            ),
          },
        ]}
        mobile={{ title: 'title', subtitle: (g) => `${g.owner?.name ?? 'Company'} Â· ${titleCase(g.level)}`, badge: (g) => <StatusBadge value={g.status} />, facts: [{ label: 'Progress', value: (g) => pct(g.progress) }] }}
        empty={{ title: 'No goals yet', description: 'Create a goal or wait for an aligned goal to be shared with you.' }}
      />
      <Pagination data={list.data ? pageOf(list.data) : null} onChange={setPage} />
      <FormModal
        open={create}
        onClose={() => setCreate(false)}
        title="Create an individual goal"
        intro="Your goal starts as a draft and can be submitted for approval."
        initial={{ level: 'individual', kind: 'goal', start_date: today(), end_date: `${today().slice(0, 4)}-12-31`, visibility: 'team', progress_mode: 'manual' }}
        fields={[
          { name: 'title', label: 'Goal title' },
          { name: 'description', label: 'Description', textarea: true, required: false },
          { name: 'start_date', label: 'Start date', type: 'date' },
          { name: 'end_date', label: 'End date', type: 'date' },
          { name: 'visibility', label: 'Visibility', options: [{ value: 'team', label: 'Team' }, { value: 'owner', label: 'Only me' }] },
        ]}
        onSubmit={async (values) => {
          await send('POST', paths.goals, clean(values));
          list.reload();
        }}
        success="Goal created as a draft"
      />
      <FormModal
        open={Boolean(checkin)}
        onClose={() => setCheckin(null)}
        title={`Check in: ${checkin?.title ?? ''}`}
        fields={[
          { name: 'progress', label: 'Progress (%)', type: 'number' },
          { name: 'confidence', label: 'Confidence', options: [{ value: 'on_track', label: 'On track' }, { value: 'at_risk', label: 'At risk' }, { value: 'off_track', label: 'Off track' }] },
          { name: 'note', label: 'Update', textarea: true, required: false },
        ]}
        onSubmit={async (values) => {
          await send('POST', paths.goal(checkin.uuid, 'checkins'), clean({ ...values, progress: values.progress === '' ? undefined : Number(values.progress) }));
          list.reload();
        }}
        success="Progress updated"
      />
    </Page>
  );
}

export function ReviewsPage() {
  const [page, setPage] = useState(1);
  const list = useList(`${paths.reviews}?page=${page}`);
  return (
    <Page permission="performance.self|performance.view" title="Reviews" description="Reviews assigned to you and reviews visible within your scope.">
      <ListCard
        title="Review work"
        list={list}
        columns={[
          { key: 'employee', label: 'Employee', render: (r) => r.employee?.name ?? 'Employee' },
          { key: 'cycle', label: 'Cycle', priority: 'md', render: (r) => r.cycle?.name ?? '—' },
          { key: 'role', label: 'Your role', priority: 'md', render: (r) => titleCase(r.role) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          { key: 'open', label: '', render: (r) => <Link className="text-brand-700 dark:text-brand-300" to={`/performance/reviews/${r.uuid}`}>Open review</Link> },
        ]}
        mobile={{ title: (r) => r.employee?.name ?? 'Employee', subtitle: (r) => r.cycle?.name ?? '—', badge: (r) => <StatusBadge value={r.status} />, facts: [{ label: 'Your role', value: (r) => titleCase(r.role) }] }}
        empty={{ title: 'No reviews', description: 'Assigned review work will appear here.' }}
      />
      <Pagination data={list.data ? pageOf(list.data) : null} onChange={setPage} />
    </Page>
  );
}

function ReviewResponseForm({ review, response, onSubmitted, actions }) {
  const sections = review.template?.sections ?? [];
  const [values, setValues] = useState({});
  const [comments, setComments] = useState('');
  const scales = review.scale?.labels ?? [];
  const competencies = review.template?.competencies ?? [];
  const set = (key, name, value) => setValues((old) => ({ ...old, [key]: { ...old[key], [name]: value } }));
  const submit = async (event) => {
    event.preventDefault();
    const items = sections.filter((section) => values[section.key]?.rating !== undefined && values[section.key]?.rating !== '').map((section) => {
      const value = values[section.key];
      const competency = section.type === 'competencies' ? competencies.find((row) => row.code === value.ref) : null;
      return {
        section: section.key,
        ref: section.type === 'competencies' ? value.ref : section.key,
        label: competency?.name ?? value.label ?? section.title,
        rating: Number(value.rating),
        comment: value.comment,
      };
    });
    const result = await actions.run('submit-response', () => send('POST', paths.response(response.uuid), { items, comments }), 'Review response submitted');
    if (result) onSubmitted();
  };
  return (
    <form className="mt-4 space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800" onSubmit={submit}>
      <h3 className="m-0 text-sm">Your {titleCase(response.type)} response</h3>
      {sections.map((section) => {
        const value = values[section.key] ?? {};
        return (
          <fieldset key={section.key} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <legend className="px-1 text-sm font-medium">{section.title}{section.mandatory ? ' *' : ''}</legend>
            {section.type === 'competencies' ? (
              <label className="mb-3 block text-xs text-slate-600 dark:text-slate-300">
                Competency
                <select required={Boolean(section.mandatory)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={value.ref ?? ''} onChange={(event) => set(section.key, 'ref', event.target.value)}>
                  <option value="">Choose a competency</option>
                  {competencies.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                </select>
              </label>
            ) : section.type === 'goals' ? (
              <label className="mb-3 block text-xs text-slate-600 dark:text-slate-300">
                Goal or outcome
                <input required={Boolean(section.mandatory)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={value.label ?? ''} onChange={(event) => set(section.key, 'label', event.target.value)} />
              </label>
            ) : null}
            <label className="mb-3 block text-xs text-slate-600 dark:text-slate-300">
              Rating
              <select required={Boolean(section.mandatory)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={value.rating ?? ''} onChange={(event) => set(section.key, 'rating', event.target.value)}>
                <option value="">Choose a rating</option>
                {scales.map((item) => <option key={item.value} value={item.value}>{item.value} Â· {item.label}</option>)}
              </select>
            </label>
            <label className="block text-xs text-slate-600 dark:text-slate-300">
              Comment (optional)
              <textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={value.comment ?? ''} onChange={(event) => set(section.key, 'comment', event.target.value)} />
            </label>
          </fieldset>
        );
      })}
      <label className="block text-xs text-slate-600 dark:text-slate-300">
        Overall comments (optional)
        <textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={comments} onChange={(event) => setComments(event.target.value)} />
      </label>
      <Button type="submit" disabled={Boolean(actions.busy)}>Submit response</Button>
    </form>
  );
}

export function ReviewDetailPage() {
  const { uuid } = useParams();
  const { can } = useAuth();
  const res = useList(paths.review(uuid));
  const review = unwrap(res.data);
  const actions = useDo();
  const acknowledge = async () => {
    await actions.run('acknowledge', () => send('POST', paths.review(uuid, 'acknowledge'), {}), 'Review acknowledged');
    res.reload();
  };
  return (
    <Page permission="performance.self|performance.view" title={review ? `Review: ${review.employee?.name ?? ''}` : 'Review'} description={review?.cycle?.name ?? 'Review details and feedback visible to you.'}>
      {res.loading ? <Skeleton /> : res.error ? <ErrorState error={res.error} onRetry={res.reload} /> : review && (
        <>
          <Card className="mb-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="m-0 text-xs text-slate-500 dark:text-slate-400">Your role: {titleCase(review.role)}</p><p className="m-0 mt-2">Status: <StatusBadge value={review.status} /></p></div>{review.role === 'subject' && review.result?.finalized_at && !review.result?.acknowledged_at && can('performance.self') && <Button onClick={acknowledge} disabled={Boolean(actions.busy)}>Acknowledge result</Button>}</div></Card>
          <PeerPanel review={review} onChanged={res.reload} />
          {review.result && <Card title="Final result" className="mb-5"><Tiles items={[{ label: 'Score', value: review.result.final_score ?? '—' }, { label: 'Rating', value: review.result.final_rating ?? '—' }]} /></Card>}
          <Card title="Responses" className="mb-5">
            <div className="space-y-3">
              {(review.responses ?? []).map((response) => (
                <section key={response.uuid} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <strong>{titleCase(response.type)}{response.reviewer ? ` · ${response.reviewer}` : ''}</strong>
                    <StatusBadge value={response.status} />
                  </div>
                  {response.hidden ? (
                    <p className="mb-0 text-sm text-slate-500 dark:text-slate-400">This feedback is hidden by the review privacy rules.</p>
                  ) : (response.items ?? []).map((item, i) => (
                    <div key={`${response.uuid}-${i}`} className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <div className="flex justify-between gap-3"><strong className="text-sm">{item.label ?? item.section}</strong><span>{item.rating}</span></div>
                      {item.comment && <p className="mb-0 text-sm">{item.comment}</p>}
                    </div>
                  ))}
                  {response.mine && response.status === 'pending' && review.cycle?.status === 'open' && (
                    <ReviewResponseForm key={response.uuid} review={review} response={response} actions={actions} onSubmitted={res.reload} />
                  )}
                </section>
              ))}
            </div>
          </Card>
          {!review.responses?.length && <Card><p className="m-0 text-sm text-slate-500 dark:text-slate-400">No responses are visible yet.</p></Card>}
        </>
      )}
    </Page>
  );
}

export function PerformanceDashboardPage() {
  const cycles = useList(`${paths.cycles}?per_page=50`);
  const [cycleId, setCycleId] = useState('');
  const res = useList(cycleId ? `${paths.dashboard}?cycle_uuid=${cycleId}` : paths.dashboard);
  const data = unwrap(res.data) ?? {};
  const options = cycles.rows.filter((c) => ['open', 'calibration', 'closed'].includes(c.status));
  return (
    <Page permission="performance.reports.view" title="Performance dashboard" description="Cycle completion, late reviews and goal status, scoped to the people you may view.">
      {options.length > 1 && (
        <div className="mb-4 max-w-sm">
          <Select label="Cycle" value={cycleId || data.cycle?.uuid || ''} options={options.map((c) => ({ value: c.uuid, label: c.name }))} onChange={(e) => setCycleId(e.target.value)} />
        </div>
      )}
      {res.loading ? <Skeleton /> : res.error ? <ErrorState error={res.error} onRetry={res.reload} /> : <>
        <Card title={data.cycle?.name ?? 'Current cycle'} className="mb-5"><Tiles items={[{ label: 'Reviews', value: data.reviews?.total ?? 0 }, { label: 'Late responses', value: data.late_responses ?? 0, tone: data.late_responses ? 'warn' : undefined }, { label: 'Pending calibration', value: data.calibration?.pending_changes ?? 0 }, { label: 'Goals awaiting approval', value: data.goals?.pending_approval ?? 0 }]} /></Card>
        <ListCard
          title="Late reviews"
          list={{ loading: false, error: null, rows: data.late_list ?? [] }}
          rowKey={(r) => `${r.review_uuid}-${r.reviewer_type}`}
          columns={[
            { key: 'employee', label: 'Employee' },
            { key: 'reviewer_type', label: 'Late response', render: (r) => titleCase(r.reviewer_type) },
            { key: 'due_on', label: 'Was due', priority: 'md' },
            { key: 'days_late', label: 'Days late', render: (r) => `${r.days_late} days` },
            { key: 'open', label: '', render: (r) => <Link className="text-brand-700 dark:text-brand-300" to={`/performance/reviews/${r.review_uuid}`}>Open review</Link> },
          ]}
          mobile={{ title: 'employee', subtitle: (r) => `${titleCase(r.reviewer_type)} response, due ${r.due_on}`, facts: [{ label: 'Days late', value: (r) => r.days_late }] }}
          empty={{ title: 'Nothing is late', description: 'Pending responses past their due date are listed here. Reviewer names are never shown for peer reviews.' }}
        />
        {data.distribution?.suppressed && <Card><p className="m-0 text-sm text-slate-500 dark:text-slate-400">Rating distribution is hidden to protect privacy for small groups.</p></Card>}
      </>}
    </Page>
  );
}
