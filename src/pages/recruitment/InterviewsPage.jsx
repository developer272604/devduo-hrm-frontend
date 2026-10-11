import { useEffect, useState } from 'react';
import { Button, useToast, ErrorState, Modal, MultiSelect, Pagination, Skeleton, EmptyState } from '../../components/ui';
import { Banner, ConfirmDialog, FormModal, ListCard, Page, StatusBadge, optionsOf, useAll, useOptions } from '../../components/recruitment/kit';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { clean, fmtDate, pageOf, paths, send, titleCase, useList } from '../../lib/recruitmentApi';

const RATINGS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}` }));
const RECS = ['strong_yes', 'yes', 'no', 'strong_no'].map((r) => ({ value: r, label: titleCase(r) }));
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/** Feedback visible to the viewer. The API returns only the viewer's own unless they manage hiring for the application. */
function FeedbackDrawer({ interview, onClose, canSeeAll }) {
  const [state, setState] = useState({ loading: true, rows: [], error: null });
  useEffect(() => {
    if (!interview) return undefined;
    let live = true;
    setState({ loading: true, rows: [], error: null });
    api(paths.interview(interview.uuid, 'scorecards'))
      .then((r) => live && setState({ loading: false, rows: r?.data ?? [], error: null }))
      .catch((error) => live && setState({ loading: false, rows: [], error }));
    return () => {
      live = false;
    };
  }, [interview]);
  return (
    <Modal open={Boolean(interview)} onClose={onClose} title={`Feedback: ${interview?.candidate_name ?? ''}`} drawer>
      <div className="px-6 pb-6">
        <Banner tone="info">{canSeeAll ? 'Viewing submitted feedback is recorded in the audit log.' : 'Panelists see only their own feedback.'}</Banner>
        {state.loading ? (
          <Skeleton rows={2} />
        ) : state.error ? (
          <ErrorState error={state.error} />
        ) : state.rows.length === 0 ? (
          <EmptyState title="No feedback to show" description="Submitted scorecards you may see appear here." />
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {state.rows.map((s, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
                <strong>{s.mine ? 'You' : (s.panelist ?? 'Panelist')}</strong>: {s.rating}/5, {titleCase(s.recommendation)}
                {s.strengths && <p className="m-0 mt-1">Strengths: {s.strengths}</p>}
                {s.concerns && <p className="m-0 mt-1">Concerns: {s.concerns}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

export default function InterviewsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const list = useList(`${paths.interviews}?page=${page}`);
  const apps = useAll(paths.applications);
  const users = useOptions(paths.users, (u) => u.name);
  const [schedule, setSchedule] = useState(false);
  const [panel, setPanel] = useState([]);
  const [score, setScore] = useState(null);
  const [view, setView] = useState(null);
  const [cancel, setCancel] = useState(null);
  const [reschedule, setReschedule] = useState(null);
  const manage = can('recruitment.manage');
  const started = (i) => new Date(i.starts_at) <= new Date();

  const actions = (i) => (
    <div className="flex flex-wrap gap-1.5">
      {i.status !== 'cancelled' && started(i) && (
        <Button variant="secondary" onClick={() => setScore(i)} aria-label={`Submit feedback for ${i.candidate_name}`}>
          Submit feedback
        </Button>
      )}
      <Button variant="secondary" onClick={() => setView(i)} aria-label={`View feedback for ${i.candidate_name}`}>
        Feedback
      </Button>
      {manage && !['cancelled', 'completed'].includes(i.status) && (
        <Button variant="secondary" onClick={() => setCancel(i)}>
          Cancel
        </Button>
      )}
      {manage && i.status === 'scheduled' && !started(i) && <Button variant="secondary" onClick={() => setReschedule(i)}>Reschedule</Button>}
    </div>
  );

  return (
    <Page permission="recruitment.view" title="Interviews" description="Interviews you are involved in. Feedback opens when an interview starts and stays private to each panelist." action={manage && <Button onClick={() => setSchedule(true)}>Schedule interview</Button>}>
      <ListCard
        title="Interviews"
        list={list}
        columns={[
          { key: 'candidate_name', label: 'Candidate' },
          { key: 'round', label: 'Round' },
          { key: 'starts_at', label: 'Starts', render: (i) => `${fmtDate(i.starts_at)} (${i.timezone})` },
          { key: 'mode', label: 'Mode', priority: 'md', render: (i) => titleCase(i.mode ?? '—') },
          { key: 'status', label: 'Status', render: (i) => <StatusBadge value={i.status} /> },
          { key: 'actions', label: 'Actions', render: actions },
        ]}
        card={(i) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <strong className="text-sm">{i.candidate_name}</strong>
              <StatusBadge value={i.status} />
            </div>
            <p className="m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">
              {i.round} · {fmtDate(i.starts_at)}
            </p>
            <div className="mt-2">{actions(i)}</div>
          </div>
        )}
        empty={{ title: 'No interviews', description: 'Scheduled interviews you are part of appear here.' }}
      />
      <Pagination data={list.data ? pageOf(list.data) : null} onChange={setPage} />

      <FormModal
        open={schedule}
        onClose={() => setSchedule(false)}
        title="Schedule interview"
        intro="Panelists with an overlapping interview are refused. Times are in the time zone shown."
        initial={{ timezone: tz(), mode: 'video' }}
        fields={[
          { name: 'application_uuid', label: 'Application', options: optionsOf(apps.rows.filter((a) => a.status === 'active'), (a) => `${a.candidate_name}: ${a.job_title} (${titleCase(a.stage)})`) },
          { name: 'round', label: 'Round' },
          { name: 'starts_at', label: 'Starts', type: 'datetime-local' },
          { name: 'ends_at', label: 'Ends', type: 'datetime-local' },
          { name: 'timezone', label: 'Time zone' },
          { name: 'mode', label: 'Mode', options: ['video', 'phone', 'onsite'].map((m) => ({ value: m, label: titleCase(m) })) },
          { name: 'location_text', label: 'Location or link', required: false },
        ]}
        extra={() => <MultiSelect label="Panelists" options={users} value={panel} onChange={setPanel} />}
        onSubmit={async (v) => {
          if (panel.length === 0) throw new Error('Choose at least one panelist.');
          await send('POST', paths.interviews, { ...clean(v), panelist_ids: panel.map(Number) });
          setPanel([]);
          list.reload();
        }}
        success="Interview scheduled"
      />
      <FormModal
        open={Boolean(score)}
        onClose={() => setScore(null)}
        title={`Feedback: ${score?.candidate_name ?? ''}`}
        intro="Only you and authorized hiring managers can read this. You can submit once."
        initial={{ rating: '3', recommendation: 'yes' }}
        submitLabel="Submit feedback"
        fields={[
          { name: 'rating', label: 'Rating (1-5)', options: RATINGS },
          { name: 'recommendation', label: 'Recommendation', options: RECS },
          { name: 'strengths', label: 'Strengths', textarea: true, required: false },
          { name: 'concerns', label: 'Concerns', textarea: true, required: false },
        ]}
        onSubmit={async (v) => { await send('POST', paths.interview(score.uuid, 'scorecard'), { ...clean(v), rating: Number(v.rating) }); list.reload(); }}
        success="Feedback submitted"
      />
      <FormModal
        open={Boolean(reschedule)} onClose={() => setReschedule(null)} title="Reschedule interview"
        intro="Choose the new local start and end. Panelists remain assigned and receive an in-app update."
        initial={{ timezone: reschedule?.timezone || tz() }} submitLabel="Reschedule"
        fields={[
          { name: 'starts_at', label: 'New start', type: 'datetime-local' },
          { name: 'ends_at', label: 'New end', type: 'datetime-local' },
          { name: 'timezone', label: 'Time zone' },
          { name: 'reason', label: 'Reason for rescheduling', textarea: true },
        ]}
        onSubmit={async (values) => { await send('POST', paths.interview(reschedule.uuid, 'reschedule'), { ...values, expected_starts_at: reschedule.starts_at }); list.reload(); }}
        success="Interview rescheduled"
      />
      <FeedbackDrawer interview={view} onClose={() => setView(null)} canSeeAll={manage} />
      <ConfirmDialog
        open={Boolean(cancel)}
        onClose={() => setCancel(null)}
        title="Cancel interview?"
        intro="Panelists are notified and their feedback tasks are removed."
        confirmLabel="Cancel interview"
        danger
        onConfirm={async () => { await send('POST', paths.interview(cancel.uuid, 'cancel')); toast('Interview cancelled'); list.reload(); }}
      />
    </Page>
  );
}
