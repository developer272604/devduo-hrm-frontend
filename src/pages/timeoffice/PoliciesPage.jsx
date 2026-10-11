import { useEffect, useState } from 'react';
import { Button, Card, ErrorState, FormError, Input, Modal, Skeleton, Tabs, Textarea, useToast } from '../../components/ui';
import CrudPanel, { FormDialog } from '../../components/timeoffice/CrudPanel';
import RuleEditor from '../../components/timeoffice/RuleEditor';
import PolicySimulator from '../../components/timeoffice/PolicySimulator';
import { Banner, Impact, LockedBanner, Panel, Screen, StatusBadge, guarded } from '../../components/timeoffice/parts';
import { PreviewConfirm } from '../../components/timeoffice/dialogs';
import ResponsiveList from '../../components/ResponsiveList';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { paths, send, today, toOptions, unwrap, useAction, useList, titleCase } from '../../lib/timeOfficeApi';

const TABS = [
  { value: 'policies', label: 'Policies and versions' },
  { value: 'assignments', label: 'Assignments' },
  { value: 'resolve', label: 'Resolve debugger' },
  { value: 'simulate', label: 'Simulator' },
];
const policyFields = [
  { name: 'name', label: 'Name', required: true },
  { name: 'code', label: 'Code', required: true, hint: 'Letters, numbers, dashes. Cannot be changed later.' },
  { name: 'country', label: 'Country (2 letters)' },
  { name: 'description', label: 'Description', type: 'textarea' },
];

/** Edit a draft version's rules. Published versions are read-only: change them by creating a new version. */
function VersionEditor({ policy, version, onClose, onSaved }) {
  const [state, setState] = useState({ loading: true });
  const [rules, setRules] = useState(null);
  const [from, setFrom] = useState('');
  const save = useAction();
  const toast = useToast();
  const readOnly = version.status !== 'draft';
  useEffect(() => {
    api(`${paths.policies}/${policy.uuid}/versions/${version.version}`)
      .then((r) => {
        const v = unwrap(r);
        setRules(v.effective_rules ?? v.rules ?? {});
        setFrom(String(v.effective_from ?? '').slice(0, 10));
        setState({});
      })
      .catch((error) => setState({ error }));
  }, [policy.uuid, version.version]);
  return (
    <Modal open onClose={onClose} title={`${policy.name} v${version.version}`}>
      {state.loading && <Skeleton rows={3} />}
      {state.error && <ErrorState error={state.error} />}
      {rules && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await save.run(() => send('PATCH', `${paths.policies}/${policy.uuid}/versions/${version.version}`, { rules, effective_from: from }))) {
              toast('Draft saved');
              onSaved();
              onClose();
            }
          }}
        >
          {readOnly && <LockedBanner>{titleCase(version.status)} versions cannot be edited. Create a new version to change the rules.</LockedBanner>}
          <FormError error={save.error} />
          <Input label="Effective from" type="date" value={from} disabled={readOnly} required onChange={(e) => setFrom(e.target.value)} />
          <RuleEditor rules={rules} onChange={setRules} disabled={readOnly} errors={save.error?.errors ?? {}} />
          <div className="mt-4 flex justify-end gap-2.5">
            <Button variant="secondary" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>
            {!readOnly && <Button type="submit" loading={save.busy}>Save draft</Button>}
          </div>
        </form>
      )}
    </Modal>
  );
}

function PolicyDetail({ policy, canEdit, onClose, onChanged }) {
  const toast = useToast();
  const [edit, setEdit] = useState(null);
  const [publish, setPublish] = useState(null);
  const [retire, setRetire] = useState(null);
  const [creating, setCreating] = useState(false);
  const versions = [...(policy.versions ?? [])].sort((a, b) => b.version - a.version);
  const base = `${paths.policies}/${policy.uuid}/versions`;
  return (
    <Modal open onClose={onClose} title={policy.name}>
      <p className="mt-0 text-xs text-slate-500">Versions are effective-dated. Only a published version affects attendance; a draft can be edited and simulated safely.</p>
      {canEdit && <div className="mb-3"><Button onClick={() => setCreating(true)}>New version</Button></div>}
      <ResponsiveList
        label="Policy versions"
        rows={versions}
        rowKey={(v) => v.version}
        onRowClick={setEdit}
        columns={[
          { key: 'version', label: 'Version', render: (v) => `v${v.version}` },
          { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v.status} /> },
          { key: 'effective_from', label: 'Effective', render: (v) => `${String(v.effective_from ?? '').slice(0, 10)} to ${v.effective_to ? String(v.effective_to).slice(0, 10) : 'open'}` },
          { key: 'change_note', label: 'Note', priority: 'md' },
          {
            key: 'actions',
            label: 'Actions',
            render: (v) =>
              canEdit ? (
                <span className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {v.status === 'draft' && <Button variant="secondary" onClick={() => setPublish(v)}>Publish</Button>}
                  {v.status === 'published' && <Button variant="secondary" onClick={() => setRetire(v)}>Retire</Button>}
                </span>
              ) : null,
          },
        ]}
        mobile={{ title: (v) => `Version ${v.version}`, subtitle: 'change_note', badge: (v) => <StatusBadge status={v.status} />, facts: [{ label: 'From', value: (v) => String(v.effective_from ?? '').slice(0, 10) }] }}
        empty={{ title: 'No versions', description: 'Create the first version.' }}
      />
      {edit && <VersionEditor policy={policy} version={edit} onClose={() => setEdit(null)} onSaved={onChanged} />}
      <FormDialog
        open={creating}
        onClose={() => setCreating(false)}
        title="New version"
        fields={[
          { name: 'change_note', label: 'What changes in this version?', type: 'textarea', required: true },
          { name: 'effective_from', label: 'Effective from', type: 'date', default: today() },
          { name: 'base_version', label: 'Copy rules from version', type: 'number', default: versions[0]?.version ?? '' },
        ]}
        onSubmit={async (b) => {
          await send('POST', base, b);
          toast('Draft version created');
          onChanged();
        }}
      />
      <PreviewConfirm
        open={Boolean(publish)}
        onClose={() => setPublish(null)}
        title={`Publish v${publish?.version}`}
        intro="Publishing makes these rules apply to new calculations from the effective date. Existing locked days are not changed."
        notice="Run the simulator first to see the impact on real attendance."
        load={async () => ({
          policy: policy.name,
          version: publish.version,
          effective_from: String(publish.effective_from ?? '').slice(0, 10),
          currently_published: versions.filter((v) => v.status === 'published').map((v) => `v${v.version} from ${String(v.effective_from).slice(0, 10)}`),
          effect_on_current: versions.some((v) => v.status === 'published') ? 'The currently published version ends the day before this one starts.' : 'No version is published yet.',
        })}
        onConfirm={async () => {
          const r = await send('POST', `${base}/${publish.version}/publish`);
          toast(r?.warnings?.length ? `Published with ${r.warnings.length} warning(s)` : 'Version published');
          onChanged();
        }}
        confirmLabel="Publish version"
      />
      <PreviewConfirm
        open={Boolean(retire)}
        onClose={() => setRetire(null)}
        title={`Retire v${retire?.version}`}
        intro="A retired version no longer applies to new calculations."
        danger
        load={async () => ({ policy: policy.name, version: retire.version, note: 'Assignments that rely on this version need another published version.' })}
        onConfirm={async () => {
          await send('POST', `${base}/${retire.version}/retire`);
          toast('Version retired');
          onChanged();
        }}
        confirmLabel="Retire version"
      />
    </Modal>
  );
}

function Resolver() {
  const [employee, setEmployee] = useState('');
  const [date, setDate] = useState(today());
  const [result, setResult] = useState(null);
  const action = useAction();
  return (
    <Panel title="Which policy applies?">
      <form
        className="px-6 pb-6"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await action.run(() => api(`${paths.policyResolve}?employee=${encodeURIComponent(employee)}&date=${date}`));
          if (r) setResult(unwrap(r));
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <Input label="Employee ID" required value={employee} onChange={(e) => setEmployee(e.target.value)} />
          <Input label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="mb-5"><Button type="submit" loading={action.busy}>Resolve</Button></div>
        </div>
        <FormError error={action.error} />
        {result && (
          <div className="space-y-3 text-xs">
            <Banner tone={result.policy ? 'success' : 'warn'} title={result.policy ? `${result.policy.name} v${result.policy.version}` : 'No policy applies'}>
              {result.explanation}
            </Banner>
            {result.considered?.length > 0 && (
              <>
                <h3 className="m-0 text-sm">Assignments considered</h3>
                <Impact data={{ considered: result.considered.map((c) => (typeof c === 'string' ? c : Object.values(c).filter((x) => typeof x !== 'object').join(' · '))) }} />
              </>
            )}
          </div>
        )}
      </form>
    </Panel>
  );
}

function PoliciesPagePage() {
  const { can } = useAuth();
  const canEdit = can('attendance.policy.manage');
  const [tab, setTab] = useState('policies');
  const list = useList(paths.policies);
  const [open, setOpen] = useState(null);
  const current = open && list.rows.find((p) => p.uuid === open);
  const assignFields = [
    { name: 'policy', label: 'Policy', type: 'select', required: true, options: toOptions(list.rows.map((p) => ({ id: p.uuid, name: p.name })), 'Choose…') },
    { name: 'target_type', label: 'Applies to', type: 'select', required: true, default: 'tenant', options: ['tenant', 'legal_entity', 'location', 'department', 'employee_group', 'employee'].map((v) => ({ value: v, label: titleCase(v) })) },
    { name: 'target_id', label: 'Record or employee ID', hint: 'Leave empty for the whole organisation.' },
    { name: 'effective_from', label: 'Effective from', type: 'date', required: true, default: today() },
    { name: 'effective_to', label: 'Effective to', type: 'date' },
    { name: 'priority', label: 'Priority', type: 'number', default: 0, hint: 'Among equally specific assignments the higher number wins.' },
    { name: 'is_override', label: 'Override (beats more specific assignments)', type: 'checkbox' },
    { name: 'note', label: 'Note', type: 'textarea' },
  ];
  return (
    <Screen title="Attendance policies" description="Versioned rules for lateness, breaks, overtime and more." permission="attendance.policy.manage|attendance.manage">
      <Card className="mb-5">
        <Tabs items={TABS} value={tab} onChange={setTab} />
      </Card>
      {tab === 'policies' && (
        <CrudPanel
          title="Policies"
          noun="policy"
          listPath={paths.policies}
          canEdit={canEdit}
          fields={policyFields}
          itemPath={(r) => `${paths.policies}/${r.uuid}`}
          columns={[
            { key: 'name', label: 'Policy' },
            { key: 'code', label: 'Code', priority: 'md' },
            { key: 'versions', label: 'Versions', render: (r) => (r.versions ?? []).map((v) => `v${v.version} ${v.status}`).join(', ') || 'None' },
            { key: 'active', label: 'Status', render: (r) => <StatusBadge status={r.active === false ? 'inactive' : 'active'} /> },
          ]}
          rowActions={(r) => <Button variant="secondary" onClick={() => setOpen(r.uuid)}>Versions</Button>}
          mobile={{ title: 'name', subtitle: 'code', badge: (r) => <StatusBadge status={r.active === false ? 'inactive' : 'active'} />, facts: [{ label: 'Versions', value: (r) => (r.versions ?? []).length }] }}
          onSaved={list.reload}
        />
      )}
      {tab === 'assignments' && (
        <CrudPanel
          title="Policy assignments"
          noun="assignment"
          listPath={paths.policyAssignments}
          itemPath={(r) => `${paths.policyAssignments}/${r.id}`}
          canEdit={canEdit}
          fields={assignFields}
          fromRow={(r) => ({ ...r, policy: r.policy_uuid })}
          columns={[
            { key: 'policy', label: 'Policy' },
            { key: 'target', label: 'Applies to', render: (r) => r.target_label ?? titleCase(r.target_type) },
            { key: 'effective_from', label: 'From', priority: 'md' },
            { key: 'effective_to', label: 'To', priority: 'md', render: (r) => r.effective_to ?? 'Open-ended' },
            { key: 'priority', label: 'Priority', priority: 'lg' },
            { key: 'is_override', label: 'Override', priority: 'lg', render: (r) => (r.is_override ? 'Yes' : 'No') },
          ]}
          mobile={{ title: 'policy', subtitle: (r) => r.target_label ?? titleCase(r.target_type), facts: [{ label: 'From', value: 'effective_from' }, { label: 'Priority', value: 'priority' }] }}
        />
      )}
      {tab === 'resolve' && <Resolver />}
      {tab === 'simulate' && (list.loading ? <Skeleton /> : list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : <PolicySimulator policies={list.rows} />)}
      {current && <PolicyDetail policy={current} canEdit={canEdit} onClose={() => setOpen(null)} onChanged={list.reload} />}
    </Screen>
  );
}

export default guarded(PoliciesPagePage, { title: 'Attendance policies', permission: 'attendance.policy.manage|attendance.manage' });
