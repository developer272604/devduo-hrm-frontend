import { useState } from 'react';
import { Sprout } from 'lucide-react';
import { Button, Badge, useToast } from '../../../components/ui';
import CrudPanel from '../../../components/timeoffice/CrudPanel';
import { Banner, Screen, guarded } from '../../../components/timeoffice/parts';
import { ConfirmDialog } from '../../../components/leave/hr/kit';
import { useAuth } from '../../../lib/auth';
import { LEAVE_KINDS, options, paths, send, titleCase } from '../../../lib/leaveHrApi';

const fields = [
  { name: 'name', label: 'Name', required: true },
  { name: 'code', label: 'Code', required: true, hint: 'Upper case, unique. Frozen once a policy or request uses the type.' },
  { name: 'kind', label: 'Kind', type: 'select', required: true, default: 'custom', options: options(LEAVE_KINDS) },
  { name: 'category', label: 'Category', type: 'select', default: 'paid', options: options(['paid', 'unpaid', 'statutory', 'company']) },
  { name: 'unit', label: 'Unit', type: 'select', default: 'day', options: options(['day', 'half_day', 'quarter_day', 'hour']) },
  { name: 'color', label: 'Colour (hex)', hint: 'For example #7c3aed' },
  { name: 'sort_order', label: 'Sort order', type: 'number' },
  { name: 'tracks_balance', label: 'Tracks a balance', type: 'checkbox', default: true },
  { name: 'is_statutory', label: 'Statutory', type: 'checkbox' },
  { name: 'is_sensitive', label: 'Sensitive (medical detail is restricted)', type: 'checkbox' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'config', label: 'Configuration (JSON)', type: 'json', hint: 'countries, legal_entities, employee_types, evidence, limits, half_day_allowed, notes, holiday_pool' },
];
const columns = [
  { key: 'name', label: 'Leave type', render: (t) => <strong>{t.name}</strong> },
  { key: 'code', label: 'Code' },
  { key: 'kind', label: 'Kind', priority: 'md', render: (t) => titleCase(t.kind) },
  { key: 'unit', label: 'Unit', priority: 'md', render: (t) => titleCase(t.unit) },
  { key: 'category', label: 'Category', priority: 'lg', render: (t) => titleCase(t.category) },
  { key: 'flags', label: 'Flags', priority: 'lg', render: (t) => [t.is_statutory && 'Statutory', t.is_sensitive && 'Sensitive', t.tracks_balance === false && 'No balance'].filter(Boolean).join(', ') || '—' },
  { key: 'active', label: 'Status', render: (t) => <Badge tone={t.active ? 'green' : 'neutral'}>{t.active ? 'Active' : 'Inactive'}</Badge> },
];
const mobile = { title: 'name', subtitle: (t) => `${t.code} · ${titleCase(t.kind)}`, badge: (t) => <Badge tone={t.active ? 'green' : 'neutral'}>{t.active ? 'Active' : 'Inactive'}</Badge>, facts: [{ label: 'Unit', value: (t) => titleCase(t.unit) }, { label: 'Category', value: (t) => titleCase(t.category) }] };
const clean = (body) => Object.fromEntries(Object.entries(body).filter(([, v]) => v !== null));

function LeaveTypesPageInner() {
  const { can } = useAuth();
  const toast = useToast();
  const manage = can('leave.policy.manage|leave.manage');
  const [seed, setSeed] = useState(false);
  const [version, setVersion] = useState(0);
  const [remove, setRemove] = useState(null);
  return (
    <Screen
      title="Leave types"
      description="The kinds of leave your organisation offers. Entitlements and rules live in policies."
      permission="leave.policy.manage|leave.manage"
      action={manage && <Button variant="secondary" onClick={() => setSeed(true)}><Sprout size={14} /> Add starter types</Button>}
    >
      <Banner tone="info" title="Frozen once in use">
        Code, unit and balance tracking cannot change after a policy, request or ledger entry uses a type. Deactivate a type instead of deleting it.
      </Banner>
      <CrudPanel
        key={version}
        noun="leave type"
        listPath={paths.types}
        createPath={paths.types}
        itemPath={(t) => `${paths.types}/${t.uuid}`}
        fields={fields}
        columns={columns}
        mobile={mobile}
        canEdit={manage}
        toPayload={clean}
        empty={{ title: 'No leave types yet', description: manage ? 'Add the starter set (annual, casual, sick, unpaid, comp-off, optional) or create your own.' : 'Nothing has been set up yet.' }}
        rowActions={(t, reload) =>
          manage ? (
            <span className="flex gap-1.5">
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await send('PATCH', `${paths.types}/${t.uuid}`, { active: !t.active });
                    toast(t.active ? 'Leave type deactivated' : 'Leave type activated');
                    reload();
                  } catch (e) {
                    toast(e.message, 'error');
                  }
                }}
              >
                {t.active ? 'Deactivate' : 'Activate'}
              </Button>
              <Button variant="ghost" aria-label={`Delete ${t.name}`} onClick={() => setRemove({ t, reload })}>Delete</Button>
            </span>
          ) : null
        }
      />
      <ConfirmDialog
        open={seed}
        onClose={() => setSeed(false)}
        title="Add starter leave types"
        intro="Adds Annual, Casual, Sick, Unpaid, Comp-off and Optional holiday types that do not exist yet. Existing types are left alone and no entitlement is set."
        confirmLabel="Add starter types"
        onConfirm={async () => {
          await send('POST', paths.typesSeed);
          toast('Starter leave types added');
          setVersion((v) => v + 1);
        }}
      />
      <ConfirmDialog
        open={Boolean(remove)}
        onClose={() => setRemove(null)}
        title={`Delete ${remove?.t.name ?? 'leave type'}?`}
        intro="This cannot be undone. A type that policies, requests or ledger entries use cannot be deleted; deactivate it instead."
        confirmLabel="Delete leave type"
        danger
        onConfirm={async () => {
          await send('DELETE', `${paths.types}/${remove.t.uuid}`);
          toast('Leave type deleted');
          remove.reload();
        }}
      />
    </Screen>
  );
}

export default guarded(LeaveTypesPageInner, { title: 'Leave types', permission: 'leave.policy.manage|leave.manage' });
