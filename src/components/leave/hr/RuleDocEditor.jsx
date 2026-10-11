import { useEffect, useState } from 'react';
import { Checkbox, Input, Select, Textarea } from '../../ui';
import { getPath, setPath } from '../../timeoffice/RuleEditor';

const dec = (path, label, help) => ({ path, label, type: 'dec', help });
const int = (path, label, help) => ({ path, label, type: 'int', help });
const bool = (path, label, help) => ({ path, label, type: 'bool', help });
const pick = (path, label, values, help) => ({ path, label, type: 'select', options: values.map((v) => ({ value: v, label: v.replace(/_/g, ' ') })), help });
const list = (path, label, help) => ({ path, label, type: 'list', help });
const text = (path, label, help) => ({ path, label, type: 'text', help });

/** Policy-wide rule document (`rules`). Keys not listed here can be edited in the raw JSON box. */
export const POLICY_GROUPS = [
  {
    title: 'Sandwich rule',
    fields: [
      bool('sandwich.enabled', 'Charge weekly offs and holidays between leave days'),
      bool('sandwich.count_holidays', 'Count holidays'),
      bool('sandwich.count_weekly_offs', 'Count weekly offs'),
      list('sandwich.apply_to', 'Applies to leave types', 'Type codes, comma separated. Empty means all.'),
    ],
  },
  {
    title: 'Approvals',
    fields: [list('approvals.steps', 'Approval steps', 'In order, for example manager, hr.'), int('approvals.escalate_after_hours', 'Escalate to HR after (hours)')],
  },
  {
    title: 'Request windows',
    fields: [
      int('notice_days', 'Notice (days)'),
      int('backdate_days', 'Back-dating allowed (days)'),
      int('future_days', 'Booking horizon (days)'),
      text('cycle', 'Cycle code', 'Must match an existing cycle at publish time.'),
      text('notes', 'Notes'),
    ],
  },
];

/** Per leave type rule document (`type_rules[].rules`). */
export const TYPE_GROUPS = [
  {
    title: 'Entitlement',
    fields: [
      pick('entitlement.basis', 'Basis', ['annual', 'monthly', 'weekly', 'daily', 'pay_period', 'anniversary', 'manual']),
      dec('entitlement.amount', 'Amount per occurrence', 'Up to 4 decimals.'),
      pick('entitlement.timing', 'Credit timing', ['start', 'end']),
      int('entitlement.start_after_days', 'Start accruing after (days)'),
      pick('entitlement.proration.joiner', 'Joiner proration', ['daily', 'full', 'none', 'cutoff']),
      pick('entitlement.proration.leaver', 'Leaver proration', ['daily', 'full', 'none', 'cutoff']),
    ],
  },
  {
    title: 'Eligibility',
    fields: [
      int('eligibility.probation_days', 'Probation (days)'),
      int('eligibility.min_tenure_days', 'Minimum tenure (days)'),
      bool('eligibility.requires_confirmation', 'Employee must be confirmed'),
      bool('eligibility.block_during_notice', 'Block during notice period'),
    ],
  },
  {
    title: 'Limits',
    fields: [
      dec('limits.min_units', 'Minimum per request'),
      dec('limits.max_units', 'Maximum per request'),
      dec('limits.max_consecutive', 'Maximum consecutive'),
      dec('limits.negative_limit', 'Negative balance limit'),
      dec('limits.max_balance', 'Maximum balance'),
      bool('limits.advance_leave', 'Allow borrowing from the period entitlement'),
    ],
  },
  {
    title: 'Carry-forward',
    fields: [
      pick('carry_forward.mode', 'Mode', ['none', 'full', 'capped', 'percentage']),
      dec('carry_forward.cap', 'Cap (units)'),
      dec('carry_forward.percent', 'Percent'),
      int('carry_forward.valid_days', 'Carried units valid for (days)'),
    ],
  },
  {
    title: 'Other',
    fields: [
      pick('unit', 'Unit', ['day', 'half_day', 'quarter_day', 'hour']),
      pick('pay_class', 'Pay class', ['paid', 'unpaid', 'statutory', 'lop', 'comp_off']),
      pick('consumption_order', 'Consumption order', ['fifo', 'expiry_first', 'current_first', 'carried_first']),
      int('notice_days', 'Notice (days)'),
      int('backdate_days', 'Back-dating (days)'),
      text('notes', 'Notes'),
    ],
  },
];

const valueOf = (rules, f) => {
  const v = getPath(rules, f.path);
  if (f.type === 'list') return Array.isArray(v) ? v.join(', ') : '';
  return v ?? '';
};
/** Removes empty containers left behind after clearing a field, so unknown-key validation never sees `{}` noise. */
const prune = (o) => {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  const out = {};
  Object.entries(o).forEach(([k, v]) => {
    const p = prune(v);
    if (p !== undefined && !(p && typeof p === 'object' && !Array.isArray(p) && !Object.keys(p).length)) out[k] = p;
  });
  return out;
};

function RawJson({ rules, onChange, disabled }) {
  const [textValue, setText] = useState(() => JSON.stringify(rules ?? {}, null, 2));
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setText(JSON.stringify(rules ?? {}, null, 2));
    setBad(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(rules)]);
  return (
    <details className="mt-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <summary className="cursor-pointer text-xs font-semibold">Advanced: rule document as JSON</summary>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">Use for rules without a form field, such as tenure bands or expiry. Unknown keys are rejected when saving.</p>
      <Textarea
        label="Rule document"
        value={textValue}
        disabled={disabled}
        error={bad ? 'Not valid JSON. The last valid rules are kept.' : undefined}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value || '{}');
            setBad(false);
            onChange(parsed);
          } catch {
            setBad(true);
          }
        }}
      />
    </details>
  );
}

/** Form for a rule document. `groups` is POLICY_GROUPS or TYPE_GROUPS; `rules` is the whole document. */
export default function RuleDocEditor({ groups, rules, onChange, disabled, errors = {} }) {
  const change = (next) => onChange(prune(next));
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <fieldset key={g.title} className="rounded-lg border border-slate-200 px-4 pb-1 pt-2 dark:border-slate-700" disabled={disabled}>
          <legend className="px-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{g.title}</legend>
          <div className="grid gap-x-4 sm:grid-cols-2">
            {g.fields.map((f) => {
              const value = valueOf(rules, f);
              const set = (v) => change(setPath(rules ?? {}, f.path, v));
              const error = errors[f.path]?.join?.(' ') ?? errors[f.path];
              if (f.type === 'bool')
                return (
                  <div key={f.path} className="mb-4">
                    <Checkbox label={f.label} checked={Boolean(getPath(rules, f.path))} onChange={(e) => set(e.target.checked ? true : undefined)} />
                    {f.help && <small className="block text-[11px] text-slate-500 dark:text-slate-400">{f.help}</small>}
                  </div>
                );
              if (f.type === 'select')
                return <Select key={f.path} label={f.label} options={[{ value: '', label: 'Not set' }, ...f.options]} value={value} error={error} onChange={(e) => set(e.target.value || undefined)} />;
              if (f.type === 'list')
                return (
                  <Input
                    key={`${f.path}:${value}`}
                    label={f.label}
                    hint={f.help}
                    error={error}
                    defaultValue={value}
                    onBlur={(e) => {
                      const items = e.target.value.split(',').map((x) => x.trim()).filter(Boolean);
                      set(items.length ? items : undefined);
                    }}
                  />
                );
              return (
                <Input
                  key={f.path}
                  label={f.label}
                  hint={f.help}
                  error={error}
                  inputMode={f.type === 'dec' || f.type === 'int' ? 'decimal' : undefined}
                  value={value}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '') return set(undefined);
                    if (f.type === 'int') return set(Number.isNaN(Number(v)) ? undefined : Number(v));
                    return set(v);
                  }}
                />
              );
            })}
          </div>
        </fieldset>
      ))}
      <RawJson rules={rules} onChange={onChange} disabled={disabled} />
    </div>
  );
}
