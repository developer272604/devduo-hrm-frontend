import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button, Card, ErrorState, Select, Skeleton, Tabs, useToast } from '../../../components/ui';
import { FormDialog } from '../../../components/timeoffice/CrudPanel';
import { Banner, Screen, StatusBadge, guarded } from '../../../components/timeoffice/parts';
import { ConfirmDialog, ConfirmPreview, ListCard, Section } from '../../../components/leave/hr/kit';
import PolicyDiffViewer from '../../../components/leave/hr/PolicyDiffViewer';
import VersionEditor from '../../../components/leave/hr/VersionEditor';
import AssignmentsPanel from '../../../components/leave/hr/AssignmentsPanel';
import { useAuth } from '../../../lib/auth';
import { api } from '../../../lib/api';
import { useResource } from '../../../lib/hooks';
import { HR, paths, query, send, unwrap, useAction, useList } from '../../../lib/leaveHrApi';

const range = (v) => `${v.effective_from ?? '—'} to ${v.effective_to ?? 'open'}`;

/** Shown inside the publish/schedule confirmation: the diff against the version it replaces (or a first-version note). */
const loadDiff = async (policy, n) => {
  const prev = (policy.versions ?? []).filter((v) => v.version < n && v.status !== 'draft').sort((a, b) => b.version - a.version)[0];
  if (!prev) return { first: true, to: n };
  const r = unwrap(await api(`${paths.policyDiff(policy.uuid)}?${query({ from: prev.version, to: n })}`));
  return { ...r, previous: prev.version };
};

function ComparePanel({ policy, policies }) {
  const versions = (policy.versions ?? []).map((v) => ({ value: String(v.version), label: `v${v.version} (${v.status})` }));
  const [f, setF] = useState({ from: versions.at(-2)?.value ?? versions[0]?.value ?? '', to: versions.at(-1)?.value ?? '', against: '' });
  const [diff, setDiff] = useState(null);
  const { busy, error, run } = useAction();
  const others = policies.filter((p) => p.uuid !== policy.uuid).map((p) => ({ value: p.uuid, label: p.name }));
  return (
    <Card title="Policy Difference Viewer" className="mb-5">
      <Section>
        <p className="mt-0 text-xs text-slate-500 dark:text-slate-400">Compare two versions of this policy, or a version against another policy.</p>
        {error && <ErrorState error={error} />}
        <div className="grid gap-x-4 sm:grid-cols-3">
          <Select label="From version" value={f.from} options={versions} onChange={(e) => setF({ ...f, from: e.target.value })} />
          <Select label="To version" value={f.to} options={versions} onChange={(e) => setF({ ...f, to: e.target.value })} />
          <Select label="Against another policy (optional)" value={f.against} options={[{ value: '', label: 'This policy' }, ...others]} onChange={(e) => setF({ ...f, against: e.target.value })} />
        </div>
        <Button
          loading={busy}
          disabled={!f.from || !f.to}
          onClick={async () => {
            const r = await run(async () => unwrap(await api(`${paths.policyDiff(policy.uuid)}?${query({ from: f.from, to: f.to, against: f.against })}`)));
            if (r) setDiff(r);
          }}
        >
          Compare
        </Button>
        {diff && (
          <div className="mt-4">
            <PolicyDiffViewer diff={diff} />
          </div>
        )}
      </Section>
    </Card>
  );
}

function PolicyDetailInner() {
  const { uuid } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const manage = can('leave.policy.manage|leave.manage');
  const res = useResource(paths.policy(uuid));
  const all = useList(paths.policies);
  const typeList = useList(`${paths.types}?active_only=1`);
  const policy = res.data ? unwrap(res.data) : null;
  const [tab, setTab] = useState('versions');
  const [editing, setEditing] = useState(null);
  const [publishing, setPublishing] = useState(null); // {n, schedule?: {effective_from, effective_to}}
  const [scheduleForm, setScheduleForm] = useState(null);
  const [retiring, setRetiring] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [newDraft, setNewDraft] = useState(false);
  const [notes, setNotes] = useState(null); // warnings from publish/retire
  const done = (msg, r) => {
    toast(msg);
    const warnings = r?.warnings ?? [];
    setNotes(warnings.length ? warnings : null);
    res.reload();
  };
  const versions = [...(policy?.versions ?? [])].sort((a, b) => b.version - a.version);
  const columns = [
    { key: 'version', label: 'Version', render: (v) => <strong>v{v.version}</strong> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v.status} /> },
    { key: 'range', label: 'Effective', render: range },
    { key: 'change_note', label: 'Change note', priority: 'lg', render: (v) => v.change_note ?? '—' },
    {
      key: 'actions',
      label: 'Actions',
      render: (v) => (
        <span className="flex flex-wrap gap-1.5">
          <Button variant="secondary" aria-label={`${v.status === 'draft' && manage ? 'Edit' : 'View'} version ${v.version}`} onClick={() => setEditing(v.version)}>{v.status === 'draft' && manage ? 'Edit' : 'View'}</Button>
          {manage && v.status === 'draft' && (
            <>
              <Button aria-label={`Publish version ${v.version}`} onClick={() => setPublishing({ n: v.version })}>Publish</Button>
              <Button variant="secondary" aria-label={`Schedule version ${v.version}`} onClick={() => setScheduleForm(v.version)}>Schedule</Button>
              <Button variant="ghost" aria-label={`Delete draft version ${v.version}`} onClick={() => setRemoving(v.version)}>Delete</Button>
            </>
          )}
          {manage && ['active', 'scheduled'].includes(v.status) && (
            <Button variant="secondary" aria-label={`Retire version ${v.version}`} onClick={() => setRetiring(v)}>Retire</Button>
          )}
        </span>
      ),
    },
  ];
  const publish = publishing && { ...publishing };
  return (
    <Screen
      title={policy?.name ?? 'Policy'}
      description={policy ? `Code ${policy.code}${policy.country ? ` · ${policy.country}` : ''}` : undefined}
      permission="leave.policy.manage|leave.manage"
      action={<Link to={`${HR}/policies`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"><ArrowLeft size={14} /> All policies</Link>}
    >
      {res.loading ? (
        <Skeleton rows={3} />
      ) : res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : (
        <>
          {notes && (
            <Banner tone="warn" title="Warnings from the last change">
              <ul className="m-0 list-disc pl-4">{notes.map((w, i) => <li key={i}>{typeof w === 'string' ? w : (w.message ?? JSON.stringify(w))}</li>)}</ul>
            </Banner>
          )}
          <Card className="mb-5">
            <Tabs
              value={tab}
              onChange={setTab}
              items={[{ value: 'versions', label: 'Versions' }, { value: 'compare', label: 'Compare' }, { value: 'assignments', label: 'Assignments' }]}
            />
          </Card>
          {tab === 'versions' && (
            <ListCard
              title="Versions"
              list={{ loading: false, error: null }}
              rows={versions}
              rowKey={(v) => v.version}
              columns={columns}
              action={manage && <Button onClick={() => setNewDraft(true)}><Plus size={14} /> New draft version</Button>}
              mobile={{ title: (v) => `Version ${v.version}`, subtitle: range, badge: (v) => <StatusBadge status={v.status} />, facts: [{ label: 'Note', value: (v) => v.change_note ?? '—' }] }}
              empty={{ title: 'No versions', description: 'Create a draft version to start writing rules.' }}
              extra={<div className="px-6"><Banner tone="info" title="Published versions are immutable">Only their status and end date move when a neighbouring version is published or retired. A checksum proves the rules were not edited.</Banner></div>}
            />
          )}
          {tab === 'compare' && <ComparePanel policy={policy} policies={all.rows} />}
          {tab === 'assignments' && <AssignmentsPanel policyUuid={uuid} types={typeList.rows} canManage={manage} />}
        </>
      )}

      <VersionEditor open={editing != null} onClose={() => setEditing(null)} policyUuid={uuid} version={editing} types={typeList.rows} onSaved={res.reload} />

      <FormDialog
        open={scheduleForm != null}
        onClose={() => setScheduleForm(null)}
        title={`Schedule version ${scheduleForm}`}
        fields={[
          { name: 'effective_from', label: 'Starts on', type: 'date', required: true, hint: 'Must be after today.' },
          { name: 'effective_to', label: 'Ends on (optional)', type: 'date' },
        ]}
        submitLabel="Preview changes"
        onSubmit={async (b) => setPublishing({ n: scheduleForm, schedule: Object.fromEntries(Object.entries(b).filter(([, v]) => v !== null)) })}
      />

      <ConfirmPreview
        open={Boolean(publish)}
        onClose={() => setPublishing(null)}
        title={publish?.schedule ? `Schedule version ${publish?.n}` : `Publish version ${publish?.n}`}
        intro={publish?.schedule ? `Version ${publish?.n} will become active on ${publish.schedule.effective_from}.` : `Version ${publish?.n} takes effect on its start date and closes the previous version the day before.`}
        load={() => loadDiff(policy, publish.n)}
        ack={() => 'I understand a published version can no longer be edited, only retired.'}
        confirmLabel={publish?.schedule ? 'Schedule version' : 'Publish version'}
        onConfirm={async () => {
          const r = publish.schedule
            ? await send('POST', paths.policyVersion(uuid, publish.n, 'schedule'), publish.schedule)
            : await send('POST', paths.policyVersion(uuid, publish.n, 'publish'));
          done(publish.schedule ? `Version ${publish.n} scheduled` : `Version ${publish.n} published`, r);
        }}
      >
        {(d) =>
          d.first ? (
            <Banner tone="info" title="First published version">There is no earlier version to compare against.</Banner>
          ) : (
            <>
              <p className="mt-0 text-xs">Changes from version {d.previous}:</p>
              <PolicyDiffViewer diff={d} />
            </>
          )
        }
      </ConfirmPreview>

      <ConfirmDialog
        open={Boolean(retiring)}
        onClose={() => setRetiring(null)}
        title={`Retire version ${retiring?.version}`}
        intro={retiring?.status === 'scheduled' ? 'This version has not started. Retiring cancels it and the earlier version regains its range.' : 'This ends the version today. Later days have no policy from this version unless another is published.'}
        confirmLabel="Retire version"
        danger
        onConfirm={async () => done(`Version ${retiring.version} retired`, await send('POST', paths.policyVersion(uuid, retiring.version, 'retire')))}
      />
      <ConfirmDialog
        open={removing != null}
        onClose={() => setRemoving(null)}
        title={`Delete draft version ${removing}`}
        intro="The draft and its rules are removed. Published versions are not affected."
        confirmLabel="Delete draft"
        danger
        onConfirm={async () => {
          await send('DELETE', paths.policyVersion(uuid, removing));
          done('Draft deleted');
        }}
      />
      <FormDialog
        open={newDraft}
        onClose={() => setNewDraft(false)}
        title="New draft version"
        fields={[
          { name: 'change_note', label: 'Change note', type: 'textarea', required: true },
          { name: 'base_version', label: 'Copy rules from', type: 'select', default: '', options: [{ value: '', label: 'Latest version' }, ...versions.map((v) => ({ value: String(v.version), label: `v${v.version} (${v.status})` }))] },
        ]}
        onSubmit={async (b) => {
          await send('POST', paths.policy(uuid, 'versions'), { change_note: b.change_note, ...(b.base_version ? { base_version: Number(b.base_version) } : {}) });
          done('Draft version created');
        }}
      />
    </Screen>
  );
}

export default guarded(PolicyDetailInner, { title: 'Policy', permission: 'leave.policy.manage|leave.manage' });
