import { useEffect, useState } from 'react';
import { Badge, Button, Checkbox, ErrorState, FormError, Input, Modal, Select, Skeleton, useToast } from '../../components/ui';
import { Banner, ConfirmDialog, ListCard, Page, StatusBadge } from '../../components/recruitment/kit';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import {
  RECIPIENTS, STAGE_KINDS, blankPipeline, blankStage, paths, pipelinePayload, pipelineToForm, send, titleCase, useAction, useList, validatePipeline,
} from '../../lib/recruitmentApi';

const kindOptions = STAGE_KINDS.map((k) => ({ value: k, label: titleCase(k) }));
const move = (list, i, d) => {
  const next = [...list];
  const [item] = next.splice(i, 1);
  next.splice(i + d, 0, item);
  return next;
};

/** Create a pipeline, or edit one. Editing a version already used by a requisition is frozen: saving creates a new version instead. */
function PipelineEditor({ open, pipeline, onClose, onSaved }) {
  const toast = useToast();
  const creating = !pipeline;
  const [form, setForm] = useState(blankPipeline());
  const [problems, setProblems] = useState([]);
  const [frozen, setFrozen] = useState(false);
  const { busy, error, run, clear } = useAction();
  useEffect(() => {
    if (!open) return;
    setForm(pipeline ? pipelineToForm(pipeline) : blankPipeline());
    setProblems([]);
    setFrozen(Boolean(pipeline?.in_use));
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pipeline]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setStage = (i, patch) => set({ stages: form.stages.map((s, n) => (n === i ? { ...s, ...patch } : s)) });
  const toggleRecipient = (i, r, on) => setStage(i, { reminder_recipients: on ? [...form.stages[i].reminder_recipients, r] : form.stages[i].reminder_recipients.filter((x) => x !== r) });

  async function save(asNewVersion) {
    const found = validatePipeline(form, { withCode: creating });
    setProblems(found);
    if (found.length) return;
    const body = pipelinePayload(form, { withCode: creating });
    const done = await run(async () => {
      if (creating) return send('POST', paths.pipelines, body);
      if (asNewVersion) return send('POST', paths.pipeline(pipeline.uuid, 'versions'), body);
      return send('PUT', paths.pipeline(pipeline.uuid), body);
    });
    if (done) {
      toast(creating ? 'Pipeline created' : asNewVersion ? 'New pipeline version created' : 'Pipeline saved');
      onSaved();
      onClose();
    }
  }
  const conflict = error?.status === 409 && !creating;
  useEffect(() => {
    if (conflict) setFrozen(true);
  }, [conflict]);
  const isFrozen = frozen || conflict;

  return (
    <Modal open={open} onClose={onClose} title={creating ? 'New pipeline' : `Edit ${pipeline.name} (v${pipeline.version})`} drawer>
      <form
        className="px-6 pb-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save(isFrozen);
        }}
      >
        {isFrozen && (
          <Banner tone="warn" title="This version is frozen">
            A requisition already uses this version, so it can no longer be changed. Saving creates a new version; requisitions that already run on this one keep it.
          </Banner>
        )}
        {error && !conflict && <FormError error={error} />}
        {problems.length > 0 && (
          <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
            <strong>Fix these before saving</strong>
            <ul className="m-0 mt-1 list-disc pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid gap-x-4 sm:grid-cols-2">
          {creating && <Input label="Code" hint="Capital letters, digits and underscore, e.g. ENGINEERING" value={form.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} />}
          <Input label="Name" value={form.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} />
          <Input label="Feedback reminder hours" hint="Optional, 1 to 8760. Default 24." type="number" min="1" max="8760" value={form.feedback_reminder_hours} onChange={(e) => set({ feedback_reminder_hours: e.target.value })} />
        </div>
        <div className="mb-5">
          <Checkbox label="Allow forward skip (candidates may jump over stages, never backwards)" checked={form.allow_skip} onChange={(e) => set({ allow_skip: e.target.checked })} />
        </div>

        <h3 className="mb-2 mt-0 text-sm">Stages (in order)</h3>
        <p className="mt-0 text-xs text-slate-500 dark:text-slate-400">2 to 20 stages. The first is active, exactly one is the offer stage, and hired / rejected stages (no SLA) come last.</p>
        <ol className="m-0 grid list-none gap-3 p-0">
          {form.stages.map((s, i) => (
            <li key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="grid gap-x-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input label={`Stage ${i + 1} code`} value={s.code} onChange={(e) => setStage(i, { code: e.target.value })} />
                <Input label={`Stage ${i + 1} label`} value={s.label} onChange={(e) => setStage(i, { label: e.target.value })} />
                <Select label={`Stage ${i + 1} kind`} required options={kindOptions} value={s.kind} onChange={(e) => setStage(i, { kind: e.target.value })} />
                <Input label={`Stage ${i + 1} SLA hours`} type="number" min="1" max="8760" value={s.sla_hours} disabled={['hired', 'rejected'].includes(s.kind)} onChange={(e) => setStage(i, { sla_hours: e.target.value })} />
              </div>
              <fieldset className="m-0 flex flex-wrap items-center gap-x-4 gap-y-2 border-0 p-0">
                <legend className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Stage {i + 1} reminder recipients</legend>
                {RECIPIENTS.map((r) => (
                  <Checkbox key={r} label={titleCase(r)} checked={s.reminder_recipients.includes(r)} onChange={(e) => toggleRecipient(i, r, e.target.checked)} />
                ))}
              </fieldset>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button variant="secondary" disabled={i === 0} onClick={() => set({ stages: move(form.stages, i, -1) })} aria-label={`Move stage ${i + 1} up`}>Up</Button>
                <Button variant="secondary" disabled={i === form.stages.length - 1} onClick={() => set({ stages: move(form.stages, i, 1) })} aria-label={`Move stage ${i + 1} down`}>Down</Button>
                <Button variant="secondary" disabled={form.stages.length <= 2} onClick={() => set({ stages: form.stages.filter((_, n) => n !== i) })} aria-label={`Remove stage ${i + 1}`}>Remove</Button>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-3">
          <Button variant="secondary" disabled={form.stages.length >= 20} onClick={() => set({ stages: [...form.stages.slice(0, lastEditable(form.stages)), blankStage(), ...form.stages.slice(lastEditable(form.stages))] })}>
            Add stage
          </Button>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>{creating ? 'Create pipeline' : isFrozen ? 'Create new version' : 'Save changes'}</Button>
        </div>
        {!creating && !isFrozen && (
          <p className="mb-0 mt-2 text-right text-xs text-slate-500 dark:text-slate-400">
            Unused versions are edited in place.{' '}
            <button type="button" className="underline" onClick={() => save(true)}>Save as a new version instead</button>
          </p>
        )}
      </form>
    </Modal>
  );
}

/** Index after the last non-terminal stage, so new stages land before hired / rejected. */
function lastEditable(stages) {
  const t = stages.findIndex((s) => ['hired', 'rejected'].includes(s.kind));
  return t < 0 ? stages.length : t;
}

function VersionsDrawer({ pipeline, onClose }) {
  const [state, setState] = useState({ loading: true, rows: [], error: null });
  useEffect(() => {
    if (!pipeline) return undefined;
    let live = true;
    setState({ loading: true, rows: [], error: null });
    api(paths.pipeline(pipeline.uuid, 'versions'))
      .then((r) => live && setState({ loading: false, rows: Array.isArray(r) ? r : (r?.data ?? []), error: null }))
      .catch((error) => live && setState({ loading: false, rows: [], error }));
    return () => {
      live = false;
    };
  }, [pipeline]);
  return (
    <Modal open={Boolean(pipeline)} onClose={onClose} title={`Versions of ${pipeline?.code ?? ''}`} drawer>
      <div className="px-6 pb-6">
        {state.loading ? <Skeleton rows={3} /> : state.error ? <ErrorState error={state.error} /> : (
          <ol className="m-0 list-none space-y-3 p-0">
            {state.rows.map((v) => (
              <li key={v.uuid} className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>Version {v.version}</strong> <StatusBadge value={v.status} />
                  {v.is_default && <Badge tone="green">Default</Badge>}
                  {v.in_use && <Badge>In use</Badge>}
                </div>
                <p className="m-0 mt-1">{v.name}</p>
                <p className="m-0 mt-1 text-slate-500 dark:text-slate-400">{(v.stages ?? []).map((s) => s.label + (s.sla_hours ? ` (${s.sla_hours} h)` : '')).join(' → ')}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  );
}

export default function PipelineAdminPage() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useList(`${paths.pipelines}?page=1`);
  const manage = can('recruitment.pipeline.manage');
  const [edit, setEdit] = useState(null); // {pipeline|null}
  const [versions, setVersions] = useState(null);
  const [makeDefault, setMakeDefault] = useState(null);
  const [remove, setRemove] = useState(null);

  const actions = (p) => (
    <div className="flex flex-wrap gap-1.5">
      <Button variant="secondary" onClick={() => setVersions(p)} aria-label={`Versions of ${p.code} v${p.version}`}>Versions</Button>
      {manage && p.status === 'active' && <Button variant="secondary" onClick={() => setEdit({ pipeline: p })} aria-label={`Edit ${p.code} v${p.version}`}>{p.in_use ? 'New version' : 'Edit'}</Button>}
      {manage && p.status === 'active' && !p.is_default && <Button variant="secondary" onClick={() => setMakeDefault(p)} aria-label={`Set ${p.code} v${p.version} as default`}>Set default</Button>}
      {manage && !p.in_use && !p.is_default && <Button variant="secondary" onClick={() => setRemove(p)} aria-label={`Delete ${p.code} v${p.version}`}>Delete</Button>}
    </div>
  );
  const flow = (p) => (p.stages ?? []).map((s) => s.label).join(' → ');
  const marks = (p) => (
    <span className="inline-flex flex-wrap items-center gap-1">
      <StatusBadge value={p.status} />
      {p.is_default && <Badge tone="green">Default</Badge>}
      {p.in_use && <Badge>In use</Badge>}
    </span>
  );

  return (
    <Page
      permission="recruitment.view"
      title="Pipeline setup"
      description="Hiring pipelines with stage SLAs and reminders. A version used by a requisition never changes; edits create a new version."
      action={manage && <Button onClick={() => setEdit({ pipeline: null })}>New pipeline</Button>}
    >
      <ListCard
        title="Pipelines"
        list={list}
        columns={[
          { key: 'name', label: 'Pipeline', render: (p) => <>{p.name} <span className="text-slate-400">{p.code} v{p.version}</span></> },
          { key: 'status', label: 'Status', render: marks },
          { key: 'stages', label: 'Stages', priority: 'md', render: flow },
          { key: 'actions', label: 'Actions', render: actions },
        ]}
        card={(p) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <strong className="text-sm">{p.name} <span className="font-normal text-slate-400">{p.code} v{p.version}</span></strong>
              {marks(p)}
            </div>
            <p className="m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">{flow(p)}</p>
            <div className="mt-2">{actions(p)}</div>
          </div>
        )}
        empty={{ title: 'No pipelines', description: manage ? 'Create a pipeline to configure stages and SLAs.' : 'Pipelines will appear here.' }}
      />
      {!manage && <Banner tone="info">You can view pipelines but not change them.</Banner>}

      <PipelineEditor open={Boolean(edit)} pipeline={edit?.pipeline ?? null} onClose={() => setEdit(null)} onSaved={list.reload} />
      <VersionsDrawer pipeline={versions} onClose={() => setVersions(null)} />
      <ConfirmDialog
        open={Boolean(makeDefault)}
        onClose={() => setMakeDefault(null)}
        title="Set as default pipeline?"
        intro={`New requisitions without a chosen pipeline will use ${makeDefault?.name} v${makeDefault?.version}. Open requisitions keep their current version.`}
        confirmLabel="Set default"
        onConfirm={async () => { await send('POST', paths.pipeline(makeDefault.uuid, 'default')); toast('Default pipeline updated'); list.reload(); }}
      />
      <ConfirmDialog
        open={Boolean(remove)}
        onClose={() => setRemove(null)}
        title="Delete pipeline version?"
        intro={`${remove?.name} v${remove?.version} is unused and will be removed.`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => { await send('DELETE', paths.pipeline(remove.uuid)); toast('Pipeline version deleted'); list.reload(); }}
      />
    </Page>
  );
}
