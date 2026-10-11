import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  ErrorState,
  FormError,
  Input,
  Select,
  Skeleton,
  useToast,
} from '../../../components/ui';
import { Banner, Screen, guarded } from '../../../components/timeoffice/parts';
import { paths, send, unwrap, useAction } from '../../../lib/leaveHrApi';
import { useResource } from '../../../lib/hooks';

const sections = [
  {
    title: 'Leave request rules',
    fields: [
      ['requests.backdate_days', 'Backdate limit (days)', 'number'],
      ['requests.future_days', 'Future request limit (days)', 'number'],
      ['requests.advance_notice_days', 'Advance notice (days)', 'number'],
      ['requests.pending_expiry_days', 'Expire pending requests after (days, blank disables)', 'nullableNumber'],
      ['requests.require_reason', 'Require a reason', 'boolean'],
      [
        'requests.allow_withdraw_after_approval',
        'Allow employee cancellation after approval',
        'boolean',
      ],
    ],
  },
  {
    title: 'Approvals',
    fields: [
      ['approvals.escalate_after_hours', 'Escalate after (hours)', 'number'],
      ['approvals.auto_approve_for_hr', 'Allow HR self-approval', 'boolean'],
      ['approvals.steps', 'Approval steps', 'steps'],
    ],
  },
  {
    title: 'Balances and accrual',
    fields: [
      ['balance.allow_negative_default', 'Allow negative balances by default', 'boolean'],
      ['balance.default_negative_limit', 'Default negative limit (days)', 'number'],
      ['balance.carry_negative_forward', 'Carry negative balances into the next leave period', 'boolean'],
      ['balance.maker_checker', 'Require a second person to approve adjustments', 'boolean'],
      ['accrual.run_day_of_month', 'Monthly accrual day', 'number'],
      ['accrual.catch_up_days', 'Accrual catch-up window (days)', 'number'],
      ['accrual.nightly_enabled', 'Run nightly accruals', 'boolean'],
      ['accrual.auto_carry_forward', 'Automatically carry forward balances', 'boolean'],
    ],
  },
  {
    title: 'Units, comp-off and expiry',
    fields: [
      ['units.minutes_per_day', 'Minutes in a leave day', 'number'],
      ['units.minutes_per_half_day', 'Minutes in a half day', 'number'],
      ['units.minutes_per_quarter_day', 'Minutes in a quarter day', 'number'],
      ['units.rounding', 'Rounding', 'rounding'],
      ['comp_off.require_approval', 'Require comp-off approval', 'boolean'],
      ['comp_off.default_validity_days', 'Comp-off validity (days)', 'number'],
      ['expiry.notify_days_before', 'Expiry reminders (days before)', 'list'],
    ],
  },
  {
    title: 'Privacy, restrictions and integrations',
    fields: [
      ['privacy.managers_see_reason', 'Managers may see request reasons', 'boolean'],
      ['privacy.managers_see_medical', 'Managers may see medical details', 'boolean'],
      ['privacy.medical_retention_days', 'Medical document retention (days)', 'number'],
      ['restrictions.never_block_statutory', 'Never block statutory leave', 'boolean'],
      ['integration.sync_attendance', 'Sync approved leave to attendance', 'boolean'],
      ['integration.payroll_contract', 'Enable leave payroll contract', 'boolean'],
      ['integration.cutoff_day', 'Payroll cutoff day (optional)', 'nullableNumber'],
    ],
  },
];

const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const set = (object, path, value) => {
  const [head, ...tail] = path.split('.');
  return {
    ...object,
    [head]: tail.length ? set(object[head] ?? {}, tail.join('.'), value) : value,
  };
};

function SettingsPageInner() {
  const resource = useResource(paths.settings);
  const toast = useToast();
  const action = useAction();
  const [values, setValues] = useState(null);
  useEffect(() => {
    if (resource.data) setValues(unwrap(resource.data));
  }, [resource.data]);

  async function save(event) {
    event.preventDefault();
    const result = await action.run(() => send('PUT', paths.settings, values));
    if (result) {
      setValues(unwrap(result));
      toast('Leave settings saved');
    }
  }

  return (
    <Screen
      title="Leave settings"
      description="Configure tenant-wide defaults used when a leave policy does not override them."
      permission="leave.manage|leave.policy.manage"
    >
      {resource.loading ? (
        <Skeleton rows={5} />
      ) : resource.error ? (
        <ErrorState error={resource.error} onRetry={resource.reload} />
      ) : (
        values && (
          <form onSubmit={save} className="space-y-5">
            <Banner tone="info" title="Policy precedence">
              Published policy rules take precedence over these defaults. Statutory entitlements
              remain the organisation’s responsibility to validate.
            </Banner>
            <FormError error={action.error} />
            {sections.map((section) => (
              <Card key={section.title} title={section.title}>
                <div className="grid gap-x-5 px-6 pb-5 sm:grid-cols-2 lg:grid-cols-3">
                  {section.fields.map(([path, label, type]) => {
                    const value = get(values, path);
                    if (type === 'boolean')
                      return (
                        <div key={path} className="py-2">
                          <Checkbox
                            label={label}
                            checked={Boolean(value)}
                            onChange={(e) => setValues((v) => set(v, path, e.target.checked))}
                          />
                        </div>
                      );
                    if (type === 'steps')
                      return (
                        <fieldset
                          key={path}
                          className="mb-5 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                        >
                          <legend className="px-1 text-xs font-semibold">{label}</legend>
                          {['manager', 'hr'].map((step) => (
                            <div key={step} className="py-1">
                              <Checkbox
                                label={step === 'hr' ? 'HR' : 'Manager'}
                                checked={value.includes(step)}
                                onChange={(e) =>
                                  setValues((v) =>
                                    set(
                                      v,
                                      path,
                                      e.target.checked
                                        ? [...value, step]
                                        : value.filter((x) => x !== step),
                                    ),
                                  )
                                }
                              />
                            </div>
                          ))}
                        </fieldset>
                      );
                    if (type === 'rounding')
                      return (
                        <Select
                          key={path}
                          label={label}
                          value={value}
                          options={['floor', 'nearest', 'ceil'].map((x) => ({
                            value: x,
                            label: x,
                          }))}
                          onChange={(e) => setValues((v) => set(v, path, e.target.value))}
                        />
                      );
                    const display = type === 'list' ? value.join(', ') : (value ?? '');
                    return (
                      <Input
                        key={path}
                        label={label}
                        type={type === 'list' ? 'text' : 'number'}
                        value={display}
                        min={type === 'list' ? undefined : 0}
                        onChange={(e) =>
                          setValues((v) =>
                            set(
                              v,
                              path,
                              type === 'list'
                                ? e.target.value
                                    .split(',')
                                    .map((x) => x.trim())
                                    .filter(Boolean)
                                    .map(Number)
                                : type === 'nullableNumber' && e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                            ),
                          )
                        }
                      />
                    );
                  })}
                </div>
              </Card>
            ))}
            <div className="flex justify-end">
              <Button type="submit" loading={action.busy}>
                Save settings
              </Button>
            </div>
          </form>
        )
      )}
    </Screen>
  );
}

export default guarded(SettingsPageInner, {
  title: 'Leave settings',
  permission: 'leave.manage|leave.policy.manage',
});
