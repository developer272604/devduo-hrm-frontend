import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Badge, Button, useToast } from '../../../components/ui';
import { FormDialog } from '../../../components/timeoffice/CrudPanel';
import { Banner, Screen, StatusBadge, guarded } from '../../../components/timeoffice/parts';
import { ListCard } from '../../../components/leave/hr/kit';
import { useAuth } from '../../../lib/auth';
import { HR, paths, send, unwrap, useList } from '../../../lib/leaveHrApi';

const fields = [
  { name: 'name', label: 'Policy name', required: true },
  { name: 'code', label: 'Code', required: true },
  { name: 'country', label: 'Country (ISO-2, optional)', hint: 'For example IN. Leave empty for all countries.' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'effective_from', label: 'Version 1 effective from', type: 'date' },
  { name: 'change_note', label: 'Change note', hint: 'Recorded on version 1.' },
];
export const liveVersion = (p) => (p.versions ?? []).find((v) => v.status === 'active') ?? (p.versions ?? []).find((v) => v.status === 'scheduled');

function PoliciesPageInner() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const list = useList(paths.policies);
  const [form, setForm] = useState(false);
  const manage = can('leave.policy.manage|leave.manage');
  const open = (p) => navigate(`${HR}/policies/${p.uuid}`);
  const columns = [
    { key: 'name', label: 'Policy', render: (p) => <strong>{p.name}</strong> },
    { key: 'code', label: 'Code' },
    { key: 'live', label: 'In effect', render: (p) => { const v = liveVersion(p); return v ? <span>v{v.version} <StatusBadge status={v.status} /></span> : 'No published version'; } },
    { key: 'versions', label: 'Versions', priority: 'md', render: (p) => (p.versions ?? []).length },
    { key: 'country', label: 'Country', priority: 'lg', render: (p) => p.country ?? 'All' },
    { key: 'active', label: 'State', render: (p) => <Badge tone={p.active === false ? 'neutral' : 'green'}>{p.active === false ? 'Inactive' : 'Active'}</Badge> },
  ];
  const mobile = { title: 'name', subtitle: 'code', badge: (p) => <Badge tone={p.active === false ? 'neutral' : 'green'}>{p.active === false ? 'Inactive' : 'Active'}</Badge>, facts: [{ label: 'In effect', value: (p) => { const v = liveVersion(p); return v ? `v${v.version}` : 'None'; } }, { label: 'Versions', value: (p) => (p.versions ?? []).length }] };
  return (
    <Screen
      title="Leave policies"
      description="A policy holds effective-dated versions. Published versions never change; to change a rule, draft a new version."
      permission="leave.policy.manage|leave.manage"
      action={manage && <Button onClick={() => setForm(true)}><Plus size={14} /> New policy</Button>}
    >
      <Banner tone="info" title="How versions work">
        Draft, then publish (or schedule). Publishing closes the previous version the day before and cannot be undone; use Retire to end a version.
      </Banner>
      <ListCard
        title="Policies"
        list={list}
        columns={columns}
        mobile={mobile}
        onRowClick={open}
        empty={{ title: 'No policies yet', description: manage ? 'Create a policy, add leave type rules to its draft, then publish it.' : 'Nothing has been set up yet.' }}
      />
      <FormDialog
        open={form}
        onClose={() => setForm(false)}
        title="New policy"
        fields={fields}
        onSubmit={async (b) => {
          const body = Object.fromEntries(Object.entries(b).filter(([, v]) => v !== null));
          const r = unwrap(await send('POST', paths.policies, body));
          toast('Policy created with a draft version');
          list.reload();
          if (r?.uuid) navigate(`${HR}/policies/${r.uuid}`);
        }}
      />
    </Screen>
  );
}

export default guarded(PoliciesPageInner, { title: 'Leave policies', permission: 'leave.policy.manage|leave.manage' });
