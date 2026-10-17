import { useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, FormError, Input, Modal, PageHeader, Skeleton, Tabs, Textarea } from '../../components/ui';
import { send, useAction, useList } from '../../lib/timeOfficeApi';
import { useAuth } from '../../lib/auth';

const C = '/v1/lifecycle/continuity';
const levelTone = { urgent: 'amber', plan: 'purple', standing: 'neutral', low: 'neutral' };
export const GAP_TEXT = { no_backup: 'no backup', backup_not_trained: 'backup not trained', undocumented: 'not documented' };
export const gapText = (gaps) => (gaps.length ? gaps.map((g) => GAP_TEXT[g] || g).join(', ') : 'covered');
const sel = 'mt-1 block min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900';

function EmployeePick({ label, value, onChange, optional }) {
  const list = useList('/v1/employees?per_page=100');
  const rows = list.rows || [];
  return (
    <label className="block text-xs font-semibold">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={sel} required={!optional}>
        <option value="">{optional ? 'No backup yet' : 'Choose a person'}</option>
        {rows.map((e) => (
          <option key={e.uuid} value={e.uuid}>
            {e.display_name || e.name || e.employee_number}
          </option>
        ))}
      </select>
    </label>
  );
}

function ResponsibilityDialog({ item, onClose }) {
  const [f, setF] = useState({
    owner_uuid: item?.owner.uuid ?? '',
    title: item?.title ?? '',
    description: item?.description ?? '',
    criticality: item?.criticality ?? 'medium',
    documented: item?.documented ?? false,
    documentation_ref: item?.documentation_ref ?? '',
    backup_uuid: item?.backup?.uuid ?? '',
    backup_trained: item?.backup_trained ?? false,
  });
  const act = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={() => onClose(false)} title={item ? 'Update responsibility' : 'Record a critical responsibility'}>
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = { title: f.title, description: f.description || null, criticality: f.criticality, documented: f.documented, documentation_ref: f.documentation_ref || null, backup_uuid: f.backup_uuid || null, backup_trained: f.backup_uuid ? f.backup_trained : false };
          const r = await act.run(() => (item ? send('PATCH', `${C}/responsibilities/${item.uuid}`, body) : send('POST', `${C}/responsibilities`, { ...body, owner_uuid: f.owner_uuid })));
          if (r) onClose(true);
        }}
      >
        <FormError error={act.error} />
        {!item && <EmployeePick label="Who holds this know-how?" value={f.owner_uuid} onChange={(v) => setF({ ...f, owner_uuid: v })} />}
        <Input label="What do they cover?" value={f.title} onChange={set('title')} required />
        <Textarea label="Notes (optional)" value={f.description} onChange={set('description')} />
        <label className="block text-xs font-semibold">
          How critical is it?
          <select value={f.criticality} onChange={set('criticality')} className={sel}>
            {['low', 'medium', 'high', 'critical'].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <EmployeePick label="Backup" optional value={f.backup_uuid} onChange={(v) => setF({ ...f, backup_uuid: v, backup_trained: v ? f.backup_trained : false })} />
        {f.backup_uuid && (
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" className="size-4 accent-brand-500" checked={f.backup_trained} onChange={(e) => setF({ ...f, backup_trained: e.target.checked })} />
            The backup has been trained and could cover it
          </label>
        )}
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" className="size-4 accent-brand-500" checked={f.documented} onChange={(e) => setF({ ...f, documented: e.target.checked })} />
          It is documented
        </label>
        {f.documented && <Input label="Where is it documented? (link or location)" value={f.documentation_ref} onChange={set('documentation_ref')} required />}
        <Button type="submit" loading={act.busy}>
          Save
        </Button>
      </form>
    </Modal>
  );
}

function RiskTab({ canManage }) {
  const risk = useList(`${C}/risk`);
  const act = useAction();
  const [result, setResult] = useState(null);
  if (risk.loading) return <Skeleton />;
  if (risk.error) return <ErrorState error={risk.error} onRetry={risk.reload} />;
  const d = risk.data;
  return (
    <Card title="Where a departure would leave a gap">
      <div className="space-y-3 p-5 text-xs">
        <FormError error={act.error} />
        <p className="m-0">
          {d.summary.urgent} urgent · {d.summary.plan} to plan · {d.summary.standing} standing · {d.summary.responsibilities_recorded} responsibilities recorded
        </p>
        {result && (
          <p role="status" className="m-0 text-slate-600 dark:text-slate-300">
            {result.created} follow-up task(s) opened, {result.already_open} already open.
          </p>
        )}
        {d.owners.length ? (
          <ul className="m-0 list-none space-y-3 p-0">
            {d.owners.map((o) => (
              <li key={o.owner.uuid} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <strong className="text-sm">{o.owner.name}</strong>
                  <Badge tone={levelTone[o.level]}>{o.level}</Badge>
                  <span className="text-slate-500">
                    {o.exit ? `Leaving ${o.exit.date} (${o.exit.days_left} days, ${o.exit.source})` : 'No exit date known'} · {o.uncovered} of {o.responsibilities} uncovered
                  </span>
                </div>
                <ul className="m-0 mb-2 list-none space-y-1 p-0">
                  {o.items.map((i) => (
                    <li key={i.uuid}>
                      {i.title} <Badge>{i.criticality}</Badge> <span className="text-amber-800 dark:text-amber-200">{gapText(i.gaps)}</span>
                    </li>
                  ))}
                </ul>
                {canManage && (
                  <Button
                    variant="secondary"
                    loading={act.busy}
                    onClick={async () => {
                      const r = await act.run(() => send('POST', `${C}/handover/${o.owner.uuid}`, {}));
                      if (r && r !== true) setResult(r);
                    }}
                  >
                    Open handover tasks
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No uncovered responsibilities" description="Everything recorded has a trained backup and is documented." />
        )}
        <p className="m-0 text-slate-500">{d.limitations}</p>
      </div>
    </Card>
  );
}

function ListTab({ canManage }) {
  const list = useList(`${C}/responsibilities`);
  const [dialog, setDialog] = useState(null);
  const act = useAction();
  if (list.loading) return <Skeleton />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  return (
    <Card title="Recorded responsibilities" action={canManage ? <Button onClick={() => setDialog({})}>Record one</Button> : null}>
      <FormError error={act.error} />
      {list.data.items.length ? (
        <ul className="m-0 list-none space-y-3 p-5 text-xs">
          {list.data.items.map((i) => (
            <li key={i.uuid} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <strong className="text-sm">{i.title}</strong>
                <Badge>{i.criticality}</Badge>
                <Badge tone={i.covered ? 'green' : 'amber'}>{gapText(i.gaps)}</Badge>
              </div>
              <p className="m-0 mb-2 text-slate-600 dark:text-slate-300">
                Held by {i.owner.name} · Backup: {i.backup ? `${i.backup.name}${i.backup_trained ? ' (trained)' : ''}` : 'none'}
                {i.documentation_ref ? ` · Documented at ${i.documentation_ref}` : ''}
              </p>
              {canManage && (
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setDialog({ item: i })}>Update</Button>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      if (await act.run(() => send('PATCH', `${C}/responsibilities/${i.uuid}`, { status: 'retired' }))) await list.reload();
                    }}
                  >
                    Retire
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nothing recorded yet" description="Record what each key person covers so a departure never comes as a surprise." />
      )}
      {dialog && (
        <ResponsibilityDialog
          item={dialog.item}
          onClose={async (ok) => {
            setDialog(null);
            if (ok) await list.reload();
          }}
        />
      )}
    </Card>
  );
}

export default function ContinuityPage() {
  const { can } = useAuth();
  const manage = can('lifecycle.continuity.manage');
  const [tab, setTab] = useState('risk');
  return (
    <>
      <PageHeader eyebrow="LIFECYCLE · KNOWLEDGE" title="Knowledge continuity" description="See who holds critical know-how, whether it is covered, and what a departure would leave behind." />
      <Tabs items={[{ value: 'risk', label: 'Exit risk' }, { value: 'list', label: 'Responsibilities' }]} value={tab} onChange={setTab} />
      <div className="mt-5">{tab === 'risk' ? <RiskTab canManage={manage} /> : <ListTab canManage={manage} />}</div>
    </>
  );
}
