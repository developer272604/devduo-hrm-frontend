import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, ErrorState, FormError, Input, Modal, PageHeader, Skeleton, Textarea } from '../../components/ui';
import { send, useAction, useList } from '../../lib/timeOfficeApi';
import { useAuth } from '../../lib/auth';

const API = '/v1/integrations/migration-projects';
const tone = { verified: 'green', imported: 'purple', linked: 'purple', skipped: 'neutral', pending: 'neutral', matched: 'green', variance: 'amber' };
const label = (s) => String(s).replace(/_/g, ' ');

export function variationText(r) {
  if (r.imported_value === null) return 'not measured yet';
  const sign = r.variance > 0 ? '+' : '';
  return `Devduo ${r.imported_value} vs source ${r.source_value} (${sign}${r.variance})`;
}

function ReasonDialog({ title, field = 'reason', required = true, onClose, onSubmit, children }) {
  const [reason, setReason] = useState('');
  const act = useAction();
  return (
    <Modal open onClose={onClose} title={title}>
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act.run(() => onSubmit(reason, field))) onClose(true);
        }}
      >
        <FormError error={act.error} />
        {children}
        <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required={required} />
        <Button type="submit" loading={act.busy}>
          Save
        </Button>
      </form>
    </Modal>
  );
}

function ReconcileDialog({ project, stage, onClose }) {
  const metrics = Object.entries(stage.allowed_metrics);
  const [metric, setMetric] = useState(metrics[0]?.[0]);
  const [source, setSource] = useState('');
  const [tolerance, setTolerance] = useState('0');
  const act = useAction();
  return (
    <Modal open onClose={() => onClose(false)} title={`Check totals: ${stage.label}`}>
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await act.run(() =>
            send('POST', `${API}/${project}/reconcile`, {
              stage: stage.code,
              metric,
              source_value: Number(source),
              tolerance: Number(tolerance),
            }),
          );
          if (ok) onClose(true);
        }}
      >
        <FormError error={act.error} />
        <label className="block text-xs font-semibold">
          What to compare
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="mt-1 block min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            {metrics.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <Input label="Value in the old system" type="number" step="any" value={source} onChange={(e) => setSource(e.target.value)} required />
        <Input label="Accepted difference" type="number" min="0" step="any" value={tolerance} onChange={(e) => setTolerance(e.target.value)} />
        <p className="m-0 text-xs text-slate-500">The Devduo value is measured from your live data. It is not typed in.</p>
        <Button type="submit" loading={act.busy}>
          Compare
        </Button>
      </form>
    </Modal>
  );
}

function StageCard({ project, stage, canManage, reload, busy }) {
  const [dialog, setDialog] = useState(null);
  const [importUuid, setImportUuid] = useState('');
  const act = useAction();
  const call = (action, body) => () => send('POST', `${API}/${project}/${action}`, { stage: stage.code, ...body });
  const done = async (ok) => {
    setDialog(null);
    if (ok) await reload();
  };
  const frozen = busy;
  return (
    <li className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <strong className="text-sm">
          {stage.position}. {stage.label}
        </strong>
        <Badge tone={tone[stage.status]}>{label(stage.status)}</Badge>
      </div>
      <p className="m-0 mb-2 text-xs text-slate-600 dark:text-slate-300">
        Import it in <Link to={stage.href} className="font-semibold text-brand-700 dark:text-brand-300">{stage.where_to_import}</Link>, then link it here.
        {stage.waiting_for.length ? ` Waiting for: ${stage.waiting_for.join(', ')}.` : ''}
        {stage.skip_reason ? ` Skipped: ${stage.skip_reason}` : ''}
        {stage.override_reason ? ` Accepted with variance: ${stage.override_reason}` : ''}
      </p>
      {stage.import && (
        <p className="m-0 mb-2 text-xs">
          Import {stage.import.status}: {stage.import.ok} of {stage.import.total} rows imported, {stage.import.error} with errors.
        </p>
      )}
      {stage.reconciliations.length > 0 && (
        <ul className="m-0 mb-2 list-none space-y-1 p-0 text-xs">
          {stage.reconciliations.map((r) => (
            <li key={r.metric} className="flex flex-wrap items-center gap-2">
              <Badge tone={tone[r.status]}>{r.status}</Badge>
              <span>
                {label(r.metric)}: {variationText(r)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <FormError error={act.error} />
      {canManage && !frozen && (
        <div className="flex flex-wrap items-end gap-2">
          {['pending', 'linked'].includes(stage.status) && !stage.import_uuid && !stage.waiting_for.length && (
            <>
              <Input
                label="Import ID"
                value={importUuid}
                onChange={(e) => setImportUuid(e.target.value)}
                placeholder="Paste the import ID"
              />
              <Button
                variant="secondary"
                disabled={!importUuid}
                loading={act.busy}
                onClick={async () => {
                  if (await act.run(call('link', { import_uuid: importUuid }))) await reload();
                }}
              >
                Link import
              </Button>
            </>
          )}
          {stage.import_uuid && stage.status !== 'verified' && (
            <Button variant="secondary" onClick={async () => (await act.run(call('unlink'))) && reload()}>
              Unlink
            </Button>
          )}
          {['imported', 'verified'].includes(stage.status) && (
            <Button variant="secondary" onClick={() => setDialog('reconcile')}>
              Add check
            </Button>
          )}
          {stage.status === 'imported' && (
            <Button
              loading={act.busy}
              onClick={async () => {
                if (stage.reconciliations.some((r) => r.status !== 'matched')) setDialog('override');
                else if (await act.run(call('verify'))) await reload();
              }}
            >
              Verify stage
            </Button>
          )}
          {['verified', 'skipped'].includes(stage.status) && (
            <Button variant="secondary" onClick={() => setDialog('reopen')}>
              Reopen
            </Button>
          )}
          {['pending', 'linked', 'imported'].includes(stage.status) && (
            <Button variant="secondary" onClick={() => setDialog('skip')}>
              Skip
            </Button>
          )}
        </div>
      )}
      {dialog === 'reconcile' && <ReconcileDialog project={project} stage={stage} onClose={done} />}
      {dialog === 'skip' && (
        <ReasonDialog title="Skip this stage" onClose={done} onSubmit={(reason) => call('skip', { reason })()} />
      )}
      {dialog === 'reopen' && (
        <ReasonDialog title="Reopen this stage" onClose={done} onSubmit={(reason) => call('reopen', { reason })()} />
      )}
      {dialog === 'override' && (
        <ReasonDialog title="Accept the differences" onClose={done} onSubmit={(reason) => call('verify', { override_reason: reason })()}>
          <p className="m-0 text-xs text-slate-600 dark:text-slate-300">Some checks do not match. Fix the data, or explain why the difference is acceptable.</p>
        </ReasonDialog>
      )}
    </li>
  );
}

function ProjectView({ uuid, canManage, onBack }) {
  const p = useList(`${API}/${uuid}`);
  const [dialog, setDialog] = useState(null);
  const act = useAction();
  const d = p.data;
  return (
    <>
      <Button variant="secondary" onClick={onBack}>
        Back to projects
      </Button>
      {p.loading ? (
        <Skeleton />
      ) : p.error ? (
        <ErrorState error={p.error} onRetry={p.reload} />
      ) : (
        <Card
          title={d.name}
          action={
            canManage && !['live', 'cancelled'].includes(d.status) ? (
              <div className="flex gap-2">
                <Button
                  disabled={!d.can_go_live}
                  loading={act.busy}
                  onClick={async () => {
                    if (await act.run(() => send('POST', `${API}/${uuid}/go-live`, {}))) await p.reload();
                  }}
                >
                  Confirm cutover
                </Button>
                <Button variant="secondary" onClick={() => setDialog('cancel')}>
                  Cancel project
                </Button>
              </div>
            ) : null
          }
        >
          <div className="space-y-4 p-5">
            <FormError error={act.error} />
            <p className="m-0 flex flex-wrap items-center gap-2 text-xs">
              <Badge tone={d.status === 'live' ? 'green' : 'purple'}>{label(d.status)}</Badge>
              <span>Source: {d.source_system || 'not set'}</span>
              <span>Target cutover: {d.target_cutover_on || 'not set'}</span>
              <span>
                {d.stages_done} of {d.stages_total} stages verified or skipped
              </span>
            </p>
            {d.cutover_blockers.length > 0 && !['live', 'cancelled'].includes(d.status) && (
              <ul className="m-0 list-disc space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 pl-6 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                {d.cutover_blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            <ol className="m-0 list-none space-y-3 p-0">
              {d.stages.map((s) => (
                <StageCard
                  key={s.code}
                  project={uuid}
                  stage={s}
                  canManage={canManage}
                  reload={p.reload}
                  busy={['live', 'cancelled'].includes(d.status)}
                />
              ))}
            </ol>
            <h3 className="m-0 text-xs font-semibold">History</h3>
            <ol className="m-0 space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-300">
              {d.history.map((h, i) => (
                <li key={i}>
                  {h.at?.slice(0, 10)} · {h.type}
                  {h.stage ? ` · ${label(h.stage)}` : ''} · {h.actor}
                  {h.detail ? ` · ${h.detail}` : ''}
                </li>
              ))}
            </ol>
            <p className="m-0 text-xs text-slate-500">{d.limitations}</p>
          </div>
        </Card>
      )}
      {dialog === 'cancel' && (
        <ReasonDialog
          title="Cancel this project"
          onClose={async (ok) => {
            setDialog(null);
            if (ok) await p.reload();
          }}
          onSubmit={(reason) => send('POST', `${API}/${uuid}/cancel`, { reason })}
        />
      )}
    </>
  );
}

function CreateDialog({ onClose }) {
  const [form, setForm] = useState({ name: '', source_system: '', target_cutover_on: '' });
  const act = useAction();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <Modal open onClose={() => onClose(null)} title="New migration project">
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = { ...form, target_cutover_on: form.target_cutover_on || null, source_system: form.source_system || null };
          const r = await act.run(() => send('POST', API, body));
          if (r) onClose(r.uuid ?? true);
        }}
      >
        <FormError error={act.error} />
        <Input label="Project name" value={form.name} onChange={set('name')} required />
        <Input label="Moving from" value={form.source_system} onChange={set('source_system')} placeholder="Name of your current HR system" />
        <Input label="Target cutover date" type="date" value={form.target_cutover_on} onChange={set('target_cutover_on')} />
        <Button type="submit" loading={act.busy}>
          Create project
        </Button>
      </form>
    </Modal>
  );
}

export function MigrationStudioPage() {
  const { can } = useAuth();
  const canManage = can('integrations.migration.manage');
  const list = useList(API);
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);
  const items = list.data?.items || [];
  return (
    <>
      <PageHeader
        eyebrow="INTEGRATIONS · SWITCHING"
        title="Migration Studio"
        description="Move from another HR system in the right order. Each stage uses the existing import, and is verified against your old totals before cutover."
        action={canManage ? <Button onClick={() => setCreating(true)}>New project</Button> : null}
      />
      {open ? (
        <ProjectView
          uuid={open}
          canManage={canManage}
          onBack={() => {
            setOpen(null);
            list.reload();
          }}
        />
      ) : (
        <Card title="Projects">
          {list.loading ? (
            <Skeleton />
          ) : list.error ? (
            <ErrorState error={list.error} onRetry={list.reload} />
          ) : items.length ? (
            <ul className="m-0 list-none space-y-3 p-5">
              {items.map((p) => (
                <li key={p.uuid} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  <div>
                    <strong className="text-sm">{p.name}</strong>
                    <p className="m-0 text-xs text-slate-500">
                      {p.source_system || 'Source not set'} · {p.stages_done} of {p.stages_total} stages done
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={p.status === 'live' ? 'green' : 'purple'}>{label(p.status)}</Badge>
                    <Button variant="secondary" onClick={() => setOpen(p.uuid)}>
                      Open
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No migration projects" description="Create a project to plan and verify a move from your current HR system." />
          )}
        </Card>
      )}
      {creating && (
        <CreateDialog
          onClose={async (r) => {
            setCreating(false);
            if (r) {
              await list.reload();
              if (typeof r === 'string') setOpen(r);
            }
          }}
        />
      )}
    </>
  );
}
