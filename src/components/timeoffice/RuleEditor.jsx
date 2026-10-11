import { Checkbox, Input, Select } from '../ui';

const GRACE = [
  { value: 'beyond_grace', label: 'Count only the minutes after the grace' },
  { value: 'from_start', label: 'Count the whole delay once grace is exceeded' },
];
const num = (path, label, help) => ({ path, label, type: 'number', help });
const bool = (path, label, help) => ({ path, label, type: 'bool', help });
const pick = (path, label, options, help) => ({ path, label, type: 'select', options, help });

/** Rule groups shown in the editor. Help text states the semantics so nothing is implied. */
export const RULE_GROUPS = [
  {
    title: 'Working hours',
    fields: [
      num('hours.full_day_minutes', 'Full-day minutes', 'Net work needed for a full day when the shift does not define it.'),
      num('hours.half_day_minutes', 'Half-day minutes', 'Net work needed to count a half day.'),
      num('hours.minimum_minutes', 'Minimum minutes for a present day', 'Below this the day is absent even with punches. Empty means no floor.'),
    ],
  },
  {
    title: 'Late arrival',
    fields: [
      num('late.grace_minutes', 'Grace (minutes)', 'Example with a 09:00 start and 10 minutes of grace: arriving 09:18 counts 8 minutes after grace, or 18 from the start.'),
      pick('late.grace_mode', 'Grace mode', GRACE, 'This decides whether grace is forgiven or only a threshold.'),
      num('late.allowed_occurrences_per_month', 'Allowed late days per month', 'Occurrences beyond this are flagged. Empty means not tracked.'),
      num('late.half_day_after_minutes', 'Half day if later than (minutes)', 'Arrival later than this after start counts as half day at most.'),
    ],
  },
  {
    title: 'Early exit',
    fields: [
      num('early_exit.grace_minutes', 'Grace (minutes)', 'Leaving this many minutes before the end is not counted.'),
      pick('early_exit.grace_mode', 'Grace mode', GRACE),
      num('early_exit.allowed_occurrences_per_month', 'Allowed early exits per month'),
    ],
  },
  {
    title: 'Breaks',
    fields: [
      pick('breaks.mode', 'Break handling', [
        { value: 'punch', label: 'From punches (OUT then IN inside the day)' },
        { value: 'fixed', label: 'Always deduct a fixed time' },
        { value: 'auto_deduct', label: 'Deduct automatically when no break punches' },
        { value: 'none', label: 'No break deduction' },
      ]),
      num('breaks.fixed_minutes', 'Fixed deduction (minutes)', 'Used by "fixed".'),
      num('breaks.auto_deduct_after_minutes', 'Auto-deduct after (minutes worked)', 'Used by "auto deduct".'),
      num('breaks.auto_deduct_minutes', 'Auto-deduct (minutes)'),
      bool('breaks.paid', 'Breaks are paid'),
    ],
  },
  {
    title: 'Punch pairing and missing punches',
    fields: [
      pick('pairing.strategy', 'Pairing', [
        { value: 'strict', label: 'Trust IN and OUT directions' },
        { value: 'alternating', label: 'Alternate IN, OUT when direction is unknown' },
        { value: 'first_last', label: 'First IN and last OUT of the day' },
      ]),
      num('pairing.duplicate_window_seconds', 'Duplicate window (seconds)', 'Repeat punches inside this window are treated as duplicates.'),
      bool('missing_punch.auto_fill', 'Auto-fill missing punches', 'Off by default: missing punches are never invented unless you approve a rule.'),
    ],
  },
  {
    title: 'Overtime',
    fields: [
      bool('overtime.enabled', 'Overtime enabled'),
      bool('overtime.post_shift', 'Count time after the shift'),
      bool('overtime.pre_shift', 'Count time before the shift'),
      bool('overtime.weekly_off', 'Count work on weekly offs'),
      bool('overtime.holiday', 'Count work on holidays'),
      bool('overtime.requires_approval', 'Requires approval', 'Unapproved overtime is calculated but not payable.'),
      num('overtime.minimum_minutes', 'Minimum overtime (minutes)', 'Shorter overtime is ignored.'),
      num('overtime.maximum_minutes_per_day', 'Maximum per day (minutes)'),
      num('overtime.rounding_minutes', 'Round to (minutes)'),
      pick('overtime.rounding_mode', 'Rounding', [{ value: 'down', label: 'Down' }, { value: 'up', label: 'Up' }, { value: 'nearest', label: 'Nearest' }]),
    ],
  },
  {
    title: 'Regularization',
    fields: [
      bool('regularization.enabled', 'Employees can request regularization'),
      num('regularization.window_days', 'Request window (days after the date)'),
      num('regularization.max_per_month', 'Maximum requests per month'),
    ],
  },
  {
    title: 'Punch restrictions',
    fields: [
      pick('punch_restrictions.geofence', 'Location rule', [
        { value: 'anywhere', label: 'Anywhere' },
        { value: 'inside', label: 'Inside a geofence' },
        { value: 'remote_work', label: 'Anywhere only on approved remote or on-duty days' },
        { value: 'approved_location', label: 'Approved locations only' },
      ]),
      bool('punch_restrictions.require_photo', 'Require a photo'),
      bool('punch_restrictions.capture_location', 'Capture location'),
    ],
  },
];

export const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
export const setPath = (obj, path, value) => {
  const [head, ...rest] = path.split('.');
  return { ...obj, [head]: rest.length ? setPath(obj?.[head] ?? {}, rest.join('.'), value) : value };
};

/** Semantic rule form. `rules` is the full effective rule set; `onChange` receives the updated set. */
export default function RuleEditor({ rules, onChange, disabled, errors = {} }) {
  return (
    <div className="space-y-4">
      {RULE_GROUPS.map((g) => (
        <fieldset key={g.title} className="rounded-lg border border-slate-200 px-4 pb-1 pt-2 dark:border-slate-700" disabled={disabled}>
          <legend className="px-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{g.title}</legend>
          <div className="grid gap-x-4 sm:grid-cols-2">
            {g.fields.map((f) => {
              const value = getPath(rules, f.path);
              const set = (v) => onChange(setPath(rules, f.path, v));
              const error = errors[f.path];
              if (f.type === 'bool')
                return (
                  <div key={f.path} className="mb-4">
                    <Checkbox label={f.label} checked={Boolean(value)} onChange={(e) => set(e.target.checked)} />
                    {f.help && <small className="block text-[11px] text-slate-500 dark:text-slate-400">{f.help}</small>}
                  </div>
                );
              if (f.type === 'select')
                return <Select key={f.path} label={f.label} options={f.options} value={value ?? ''} error={error} onChange={(e) => set(e.target.value)} />;
              return (
                <Input
                  key={f.path}
                  label={f.label}
                  hint={f.help}
                  error={error}
                  type="number"
                  min={0}
                  value={value ?? ''}
                  onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))}
                />
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
