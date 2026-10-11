import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, ErrorState, Modal, Select, Skeleton, useToast } from '../../../components/ui';
import ResponsiveList from '../../../components/ResponsiveList';
import { FormDialog } from '../../../components/timeoffice/CrudPanel';
import { Banner, Screen, StatusBadge, guarded } from '../../../components/timeoffice/parts';
import { ConfirmDialog, ListCard } from '../../../components/leave/hr/kit';
import { useAuth } from '../../../lib/auth';
import { useResource } from '../../../lib/hooks';
import {
  dateOnly,
  options,
  paths,
  query,
  send,
  titleCase,
  today,
  unwrap,
  units,
  useList,
} from '../../../lib/leaveHrApi';

const TRIGGERS = ['transfer', 'separation', 'rehire', 'policy_change'];
const MODES = ['preserve', 'transfer', 'convert', 'expire'];
const emp = (e) => e?.name ?? e?.employee_number ?? (typeof e === 'string' ? e : '—');

const actionText = (a) => `${titleCase(a.kind)} ${units(a.units)}`;

/** The stored plan for one transfer: before/after, per-account actions, warnings and future leave. */
function Detail({ uuid, onClose, onChanged }) {
  const toast = useToast();
  const { can } = useAuth();
  const res = useResource(paths.transfer(uuid));
  const [mode, setMode] = useState('');
  const [apply, setApply] = useState(false);
  const [cancel, setCancel] = useState(false);
  const t = res.data ? unwrap(res.data) : null;
  const plan = t?.plan ?? {};
  const open = t && ['preview', 'pending'].includes(t.status);
  const manage = can('leave.manage');
  const done = (m) => {
    toast(m);
    onChanged();
    res.reload();
  };
  const changeText = (o) =>
    o
      ? Object.entries(o)
          .filter(([, v]) => v !== null && typeof v !== 'object')
          .map(([k, v]) => `${titleCase(k)}: ${v}`)
          .join(', ') || '—'
      : '—';
  return (
    <Modal open onClose={onClose} title="Transfer plan">
      {res.loading ? (
        <Skeleton rows={3} />
      ) : res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : (
        <div className="space-y-4 text-xs">
          <p className="m-0 flex flex-wrap items-center gap-2">
            <strong>{emp(t.employee)}</strong>{' '}
            <span>
              {titleCase(plan.trigger ?? t.trigger)} on{' '}
              {dateOnly(plan.effective_date ?? t.effective_date)}
            </span>{' '}
            <StatusBadge status={t.status} />
          </p>
          {plan.policy_changed && (
            <Banner tone="warn" title="Policy changes">
              From {plan.from_policy?.name ?? plan.from_policy ?? 'none'} to{' '}
              {plan.to_policy?.name ?? plan.to_policy ?? 'none'}.
            </Banner>
          )}
          {plan.organization && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <strong>Before</strong>
                <p className="m-0">{changeText(plan.organization.before)}</p>
              </div>
              <div>
                <strong>After</strong>
                <p className="m-0">{changeText(plan.organization.after)}</p>
              </div>
            </div>
          )}
          {(plan.warnings ?? []).length > 0 && (
            <Banner tone="warn" title="Warnings">
              <ul className="m-0 list-disc pl-4">
                {plan.warnings.map((w, i) => (
                  <li key={i}>
                    {typeof w === 'string' ? titleCase(w) : (w.message ?? titleCase(w.key))}
                  </li>
                ))}
              </ul>
            </Banner>
          )}
          {plan.can_apply === false && (
            <Banner tone="error" title="This plan cannot be applied">
              Resolve the blocked items below, then prepare a new preview.
            </Banner>
          )}
          <ResponsiveList
            label="Balance actions"
            rows={plan.items ?? []}
            rowKey={(i) => i.account_uuid ?? i.leave_type_code}
            columns={[
              { key: 'leave_type_code', label: 'Type' },
              { key: 'available', label: 'Available', render: (i) => units(i.available) },
              {
                key: 'actions',
                label: 'What happens',
                render: (i) =>
                  i.blocked
                    ? `Blocked: ${i.note ?? ''}`
                    : (i.actions ?? []).map(actionText).join('; ') || 'No change',
              },
              { key: 'note', label: 'Note', priority: 'lg', render: (i) => i.note ?? '—' },
            ]}
            mobile={{
              title: 'leave_type_code',
              subtitle: (i) => (i.actions ?? []).map(actionText).join('; ') || 'No change',
              facts: [{ label: 'Available', value: (i) => units(i.available) }],
            }}
            empty={{
              title: 'No balances affected',
              description: 'This employee has no open balance to move.',
            }}
          />
          {(plan.future_leave ?? []).length > 0 && (
            <Banner
              tone="info"
              title={`${plan.future_leave.length} future leave request(s) will be flagged for review`}
            >
              Applying does not cancel them.
            </Banner>
          )}
          {open && manage && (
            <>
              <Select
                label="Balance handling"
                value={mode}
                options={options(MODES, 'Follow the rules')}
                onChange={(e) => setMode(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setCancel(true)}>
                  Cancel this plan
                </Button>
                <Button disabled={plan.can_apply === false} onClick={() => setApply(true)}>
                  Apply plan
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      <ConfirmDialog
        open={apply}
        onClose={() => setApply(false)}
        title="Apply transfer plan"
        intro="Balance changes are posted to the ledger and cannot be undone; correct mistakes with adjustments. Applying twice is safe: each step is posted once."
        confirmLabel="Apply plan"
        onConfirm={async () => {
          await send('POST', paths.transfer(uuid, 'apply'), mode ? { balance_mode: mode } : {});
          done('Plan applied');
        }}
      />
      <ConfirmDialog
        open={cancel}
        onClose={() => setCancel(false)}
        title="Cancel this plan"
        intro="Nothing has been posted. The stored preview is discarded."
        confirmLabel="Cancel plan"
        danger
        onConfirm={async () => {
          await send('POST', paths.transfer(uuid, 'cancel'));
          done('Plan cancelled');
        }}
      />
    </Modal>
  );
}

function TypeMappings({ canWrite }) {
  const toast = useToast();
  const list = useList(paths.typeMappings);
  const [form, setForm] = useState(false);
  const [remove, setRemove] = useState(null);
  return (
    <>
      <ListCard
        title="Leave type mappings"
        list={list}
        action={
          canWrite && (
            <Button variant="secondary" onClick={() => setForm(true)}>
              <Plus size={14} /> Add mapping
            </Button>
          )
        }
        columns={[
          { key: 'from', label: 'From type', render: (m) => m.from?.code ?? m.from },
          { key: 'to', label: 'To type', render: (m) => m.to?.code ?? m.to },
          { key: 'ratio', label: 'Ratio', render: (m) => m.ratio ?? '1' },
          { key: 'purpose', label: 'Purpose', priority: 'md', render: (m) => m.purpose ?? '—' },
          {
            key: 'actions',
            label: 'Actions',
            render: (m) =>
              canWrite && (
                <Button variant="ghost" aria-label="Delete mapping" onClick={() => setRemove(m)}>
                  Delete
                </Button>
              ),
          },
        ]}
        mobile={{
          title: (m) => `${m.from?.code ?? m.from} to ${m.to?.code ?? m.to}`,
          subtitle: (m) => `Ratio ${m.ratio ?? 1}`,
        }}
        empty={{
          title: 'No mappings',
          description:
            'Mappings convert balances between leave types when an employee changes policy.',
        }}
      />
      <FormDialog
        open={form}
        onClose={() => setForm(false)}
        title="Add mapping"
        fields={[
          { name: 'from', label: 'From leave type code', required: true },
          { name: 'to', label: 'To leave type code', required: true },
          {
            name: 'ratio',
            label: 'Ratio',
            hint: 'Units of the new type per unit of the old. Default 1.',
          },
          { name: 'purpose', label: 'Purpose' },
        ]}
        onSubmit={async (b) => {
          await send(
            'POST',
            paths.typeMappings,
            Object.fromEntries(Object.entries(b).filter(([, v]) => v !== null)),
          );
          toast('Mapping added');
          list.reload();
        }}
      />
      <ConfirmDialog
        open={Boolean(remove)}
        onClose={() => setRemove(null)}
        title="Delete mapping"
        intro="Future conversions for these types will report an unmapped leave type."
        confirmLabel="Delete mapping"
        danger
        onConfirm={async () => {
          await send('DELETE', `${paths.typeMappings}/${remove.id ?? remove.uuid}`);
          toast('Mapping deleted');
          list.reload();
        }}
      />
    </>
  );
}

function TransfersPageInner() {
  const { can } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const list = useList(`${paths.transfers}?${query({ status })}`);
  const [form, setForm] = useState(false);
  const [open, setOpen] = useState(null);
  const columns = [
    { key: 'employee', label: 'Employee', render: (t) => emp(t.employee) },
    { key: 'trigger', label: 'Trigger', render: (t) => titleCase(t.trigger) },
    { key: 'effective_date', label: 'Effective', render: (t) => dateOnly(t.effective_date) },
    { key: 'status', label: 'Status', render: (t) => <StatusBadge status={t.status} /> },
    {
      key: 'balance_mode',
      label: 'Balance handling',
      priority: 'lg',
      render: (t) => titleCase(t.balance_mode ?? 'per rules'),
    },
  ];
  return (
    <Screen
      title="Transfers and separation"
      description="Plan what happens to leave balances when someone transfers, leaves or returns. Nothing is posted until you apply a stored preview."
      permission="leave.manage"
      action={
        <Button onClick={() => setForm(true)}>
          <Plus size={14} /> Prepare a plan
        </Button>
      }
    >
      <Banner tone="info" title="Automatic previews">
        Transfers, separations and rehires in People create a preview automatically. Review and
        apply or cancel them here.
      </Banner>
      <ListCard
        title="Plans"
        list={list}
        columns={columns}
        rowKey={(t) => t.uuid}
        onRowClick={(t) => setOpen(t.uuid)}
        extra={
          <div className="px-6 pb-3">
            <Select
              label="Status"
              value={status}
              options={options(['preview', 'applied', 'cancelled'], 'All')}
              onChange={(e) => setStatus(e.target.value)}
            />
          </div>
        }
        mobile={{
          title: (t) => emp(t.employee),
          subtitle: (t) => `${titleCase(t.trigger)} · ${dateOnly(t.effective_date)}`,
          badge: (t) => <StatusBadge status={t.status} />,
        }}
        empty={{
          title: 'No plans',
          description: 'Plans appear when an employee transfers, separates or returns.',
        }}
      />
      <TypeMappings canWrite={can('leave.policy.manage')} />
      <FormDialog
        open={form}
        onClose={() => setForm(false)}
        title="Prepare a plan"
        notice={
          <Banner tone="info">
            This stores a preview only. You will review it before anything is applied.
          </Banner>
        }
        fields={[
          { name: 'employee', label: 'Employee', type: 'employee', required: true },
          {
            name: 'trigger',
            label: 'What is happening',
            type: 'select',
            required: true,
            default: 'transfer',
            options: options(TRIGGERS),
          },
          {
            name: 'effective_date',
            label: 'Effective date',
            type: 'date',
            required: true,
            default: today(),
          },
          {
            name: 'previous_employee',
            label: 'Previous employee record',
            type: 'employee',
            showIf: (v) => v.trigger === 'rehire',
            required: true,
          },
          {
            name: 'balance_mode',
            label: 'Balance handling',
            type: 'select',
            default: '',
            options: options(MODES, 'Follow the rules'),
          },
        ]}
        submitLabel="Create preview"
        onSubmit={async (b) => {
          const r = unwrap(
            await send(
              'POST',
              paths.transferPreview,
              Object.fromEntries(Object.entries(b).filter(([, v]) => v !== null)),
            ),
          );
          toast('Preview stored');
          list.reload();
          if (r?.uuid) setOpen(r.uuid);
        }}
      />
      {open && <Detail uuid={open} onClose={() => setOpen(null)} onChanged={list.reload} />}
    </Screen>
  );
}

export default guarded(TransfersPageInner, {
  title: 'Transfers and separation',
  permission: 'leave.manage',
});
