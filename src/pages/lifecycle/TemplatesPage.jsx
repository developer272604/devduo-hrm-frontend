import { useState } from 'react';
import { Button, Card, ErrorState, EmptyState, Pagination, Skeleton } from '../../components/ui';
import {
  Banner,
  ConfirmDialog,
  FormModal,
  Page,
  StatusBadge,
} from '../../components/lifecycle/kit';
import { listOf, pageOf, paths, send, useList } from '../../lib/lifecycleApi';

const KINDS = ['onboarding', 'offboarding', 'transfer', 'promotion'].map((k) => ({
  value: k,
  label: k.charAt(0).toUpperCase() + k.slice(1),
}));
const SAMPLE = [
  {
    title: 'Welcome call',
    owner_type: 'manager',
    due_anchor: 'joining',
    due_offset_days: -1,
    mandatory: true,
    requires_document: false,
  },
];

/** Parses the tasks box; throws a readable error the form modal shows. */
function parseTasks(text) {
  let tasks;
  try {
    tasks = JSON.parse(text);
  } catch {
    throw Object.assign(new Error('Tasks must be valid JSON: a list of task objects.'), {
      errors: {},
    });
  }
  if (!Array.isArray(tasks) || !tasks.length)
    throw Object.assign(new Error('Add at least one task.'), { errors: {} });
  return tasks;
}

export default function TemplatesPage() {
  const [page, setPage] = useState(1);
  const list = useList(`${paths.templates}?page=${page}`);
  const [create, setCreate] = useState(null);
  const [version, setVersion] = useState(null);
  const [publish, setPublish] = useState(null);
  const rows = listOf(list.data);
  const latest = (t) =>
    (t.versions ?? []).reduce((a, v) => (!a || v.version > a.version ? v : a), null);
  return (
    <Page
      permission="lifecycle.templates.manage"
      title="Checklist templates"
      description="Versioned task lists. Published versions are immutable; existing cases keep the tasks they were generated with."
      action={
        <Button
          onClick={() =>
            setCreate({ kind: 'onboarding', name: '', tasks: JSON.stringify(SAMPLE, null, 2) })
          }
        >
          New template
        </Button>
      }
    >
      {list.loading ? (
        <Skeleton />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No templates"
          description="Create a template so cases get a checklist automatically."
        />
      ) : (
        rows.map((t) => (
          <Card
            key={t.uuid}
            title={`${t.name} (${t.kind})`}
            className="mb-5"
            action={
              <Button
                variant="secondary"
                aria-label={`New version of ${t.name}`}
                onClick={() =>
                  setVersion({
                    template: t,
                    tasks: JSON.stringify(latest(t)?.tasks ?? SAMPLE, null, 2),
                  })
                }
              >
                New version
              </Button>
            }
          >
            <ul className="m-0 list-none space-y-2 p-0 text-sm">
              {(t.versions ?? []).map((v) => (
                <li key={v.uuid} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Version {v.version} <StatusBadge value={v.status} />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {' '}
                      · {(v.tasks ?? []).length} tasks
                    </span>
                  </span>
                  {v.status === 'draft' && (
                    <Button
                      variant="secondary"
                      aria-label={`Publish ${t.name} version ${v.version}`}
                      onClick={() => setPublish({ template: t, version: v })}
                    >
                      Publish
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
      <Pagination data={list.data ? pageOf(list.data) : null} onChange={setPage} />

      <FormModal
        open={Boolean(create)}
        onClose={() => setCreate(null)}
        title="New template"
        initial={create ?? {}}
        fields={[
          { name: 'kind', label: 'Kind', options: KINDS },
          { name: 'name', label: 'Name' },
          {
            name: 'tasks',
            label: 'Tasks (JSON list)',
            textarea: true,
            hint: 'owner_type: manager, hr, it, finance, employee or user. due_anchor: joining, last_day or effective.',
          },
        ]}
        onSubmit={async (v) => {
          await send('POST', paths.templates, {
            kind: v.kind,
            name: v.name,
            tasks: parseTasks(v.tasks),
          });
          list.reload();
        }}
        success="Template created as a draft"
      />
      <FormModal
        open={Boolean(version)}
        onClose={() => setVersion(null)}
        title={`New version of ${version?.template.name ?? ''}`}
        intro="Saved as a draft. Publish it to retire the current published version."
        initial={version ?? {}}
        fields={[{ name: 'tasks', label: 'Tasks (JSON list)', textarea: true }]}
        onSubmit={async (v) => {
          await send('POST', paths.template(version.template.uuid, 'versions'), {
            tasks: parseTasks(v.tasks),
          });
          list.reload();
        }}
        success="Draft version created"
      />
      <ConfirmDialog
        open={Boolean(publish)}
        onClose={() => setPublish(null)}
        title="Publish this version?"
        intro={
          publish &&
          `${publish.template.name} version ${publish.version.version} becomes the active checklist and the previously published version is retired.`
        }
        confirmLabel="Publish"
        onConfirm={async () => {
          await send('POST', paths.publish(publish.version.uuid));
          list.reload();
        }}
      />
      <Banner tone="info">
        Templates apply by most specific conditions (country, legal entity, worker type, separation
        type).
      </Banner>
    </Page>
  );
}
