import { useState } from 'react';
import {
  Button,
  Card,
  ErrorState,
  Skeleton,
  Textarea,
  Select,
  useToast,
} from '../../components/ui';
import { Banner, FormModal, ListCard, Page, StatusBadge } from '../../components/lifecycle/kit';
import { clean, paths, send, unwrap, useAction, useList } from '../../lib/lifecycleApi';
import { FormError } from '../../components/ui';

export function MyTasksPage() {
  const list = useList(paths.myTasks);
  const [target, setTarget] = useState(null);
  const done = (t) => t.status === 'done' || t.status === 'skipped' || t.status === 'cancelled';
  const action = (t) =>
    done(t) ? null : (
      <div>{Boolean(t.blocked_by?.length) && <p className="text-xs text-amber-700 dark:text-amber-300">Waiting for: {t.blocked_by.map((b) => b.title).join(', ')}</p>}<Button disabled={Boolean(t.blocked_by?.length)} variant="secondary" aria-label={`Complete ${t.title}`} onClick={() => setTarget(t)}>
        Complete
      </Button></div>
    );
  return (
    <Page
      permission="lifecycle.self"
      title="My onboarding and offboarding tasks"
      description="Checklist items assigned to you."
    >
      <ListCard
        title="Tasks"
        list={list}
        columns={[
          {
            key: 'title',
            label: 'Task',
            render: (t) => (
              <span>
                {t.title}
                {t.mandatory ? ' *' : ''}
              </span>
            ),
          },
          {
            key: 'due_date',
            label: 'Due',
            priority: 'md',
            render: (t) => (
              <span className={t.overdue ? 'font-semibold text-rose-700 dark:text-rose-300' : ''}>
                {t.due_date ?? '—'}
                {t.overdue ? ' (overdue)' : ''}
              </span>
            ),
          },
          { key: 'status', label: 'Status', render: (t) => <StatusBadge value={t.status} /> },
          { key: 'actions', label: 'Actions', render: action },
        ]}
        card={(t) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <strong className="text-sm">{t.title}</strong>
              <StatusBadge value={t.status} />
            </div>
            <p className="m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">
              Due {t.due_date ?? '—'}
              {t.overdue ? ' (overdue)' : ''}
            </p>
            <div className="mt-2">{action(t)}</div>
          </div>
        )}
        empty={{ title: 'No tasks', description: 'You have no onboarding or offboarding tasks.' }}
      />
      <FormModal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={`Complete: ${target?.title ?? ''}`}
        intro={target?.acknowledgment_text || (target?.requires_document ? 'This task needs a document reference.' : undefined)}
        initial={{ note: '', document_ref: '' }}
        fields={[
          ...(target?.acknowledgment_text ? [{ name: 'acknowledged', label: 'I have read and acknowledge this statement', type: 'checkbox' }] : []),
          {
            name: 'document_ref',
            label: 'Document reference',
            required: Boolean(target?.requires_document),
          },
          { name: 'note', label: 'Note', textarea: true, required: false },
        ]}
        submitLabel="Mark done"
        onSubmit={async (v) => {
          await send('POST', paths.complete(target.uuid), { outcome: 'done', ...clean(v) });
          list.reload();
        }}
        success="Task completed"
      />
    </Page>
  );
}

const OPTIONS = [
  { value: '', label: 'Select' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export function ExitInterviewPage() {
  const res = useList(paths.myExit);
  const toast = useToast();
  const { busy, error, run } = useAction();
  const [v, setV] = useState({ reason: '', recommend: '', feedback: '' });
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const data = unwrap(res.data);
  const submitted = Boolean(data?.submitted_at || data?.status === 'submitted');
  async function submit(e) {
    e.preventDefault();
    if (await run(() => send('PUT', paths.myExit, { answers: clean(v) }))) {
      toast('Exit interview submitted');
      res.reload();
    }
  }
  return (
    <Page
      permission="lifecycle.self"
      title="My exit interview"
      description="Confidential. Your answers are encrypted and visible only to people with exit-interview access."
    >
      {res.loading ? (
        <Skeleton />
      ) : res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : !data ? (
        <Banner tone="info">No exit interview is pending for you.</Banner>
      ) : submitted ? (
        <Banner tone="success">
          Thank you. Your exit interview was submitted and cannot be changed.
        </Banner>
      ) : (
        <Card title="Exit interview">
          <form onSubmit={submit}>
            <FormError error={error} />
            <Textarea
              label="Main reason for leaving"
              required
              value={v.reason}
              onChange={set('reason')}
            />
            <Select
              label="Would you recommend us as an employer?"
              required
              options={OPTIONS}
              value={v.recommend}
              onChange={set('recommend')}
            />
            <Textarea
              label="Anything we could improve?"
              value={v.feedback}
              onChange={set('feedback')}
            />
            <Button type="submit" loading={busy}>
              Submit (one time)
            </Button>
          </form>
        </Card>
      )}
    </Page>
  );
}
