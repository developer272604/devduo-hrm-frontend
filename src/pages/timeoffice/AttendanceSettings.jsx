import { useState } from 'react';
import { Button, Card, Checkbox, ErrorState, FormError, Input, MultiSelect, Skeleton, Tabs, useToast } from '../../components/ui';
import { Banner, Screen, guarded } from '../../components/timeoffice/parts';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import { paths, send, titleCase, unwrap, useAction } from '../../lib/timeOfficeApi';

const METHODS = ['web', 'mobile', 'biometric', 'import', 'api', 'admin', 'kiosk'];
const SECTION_HELP = {
  methods: 'Which ways of recording attendance are switched on for the organisation.',
  location: 'Whether and how location is captured with punches.',
  status_labels: 'Display names only. Internal status codes never change.',
  regularization: 'Rules for correcting missed or wrong punches.',
  cutoffs: 'Deadlines that trigger reminders.',
  notifications: 'Who is told about what.',
  punch: 'Rules applied to every punch.',
  processing: 'How calculation runs.',
  compliance: 'Limits that protect employees and the organisation.',
  swap: 'Shift swap rules.',
};

const setIn = (obj, path, value) => {
  const [h, ...rest] = path;
  return Array.isArray(obj) ? obj : { ...obj, [h]: rest.length ? setIn(obj?.[h] ?? {}, rest, value) : value };
};

/** Renders any settings value by type, so new server-side settings appear without a UI change. */
function Node({ path, value, onChange, disabled, errors }) {
  const name = path[path.length - 1];
  const label = titleCase(name);
  const key = path.join('.');
  const err = errors?.[key]?.join?.(' ') ?? errors?.[key];
  if (name === 'enabled' && Array.isArray(value))
    return <MultiSelect label="Enabled methods" options={METHODS.map((m) => ({ value: m, label: titleCase(m) }))} value={value} onChange={(v) => onChange(path, v)} />;
  if (typeof value === 'boolean') return <div className="mb-5"><Checkbox label={label} checked={value} disabled={disabled} onChange={(e) => onChange(path, e.target.checked)} /></div>;
  if (typeof value === 'number' || value === null)
    return <Input label={label} type="number" value={value ?? ''} disabled={disabled} error={err} onChange={(e) => onChange(path, e.target.value === '' ? null : Number(e.target.value))} />;
  if (Array.isArray(value)) return <Input label={label} hint="Separate entries with commas." value={value.join(', ')} disabled={disabled} error={err} onChange={(e) => onChange(path, e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} />;
  if (value && typeof value === 'object')
    return (
      <fieldset className="mb-4 rounded-lg border border-slate-200 px-4 pt-2 dark:border-slate-700">
        <legend className="px-1 text-xs font-semibold">{label}</legend>
        {Object.entries(value).map(([k, v]) => (
          <Node key={k} path={[...path, k]} value={v} onChange={onChange} disabled={disabled} errors={errors} />
        ))}
      </fieldset>
    );
  return <Input label={label} value={value ?? ''} disabled={disabled} error={err} onChange={(e) => onChange(path, e.target.value)} />;
}

function Section({ name, initial, canEdit, onSaved }) {
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const save = useAction();
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  return (
    <form
      className="p-6 pt-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await save.run(() => send('PUT', paths.settings(name), values))) {
          toast(`${titleCase(name)} settings saved`);
          onSaved();
        }
      }}
    >
      <p className="mt-0 text-xs text-slate-500">{SECTION_HELP[name]}</p>
      <FormError error={save.error} />
      {!canEdit && <Banner tone="info">You can view these settings but not change them.</Banner>}
      {Object.entries(values).map(([k, v]) => (
        <Node key={k} path={[k]} value={v} disabled={!canEdit} errors={save.error?.errors} onChange={(path, val) => setValues((s) => setIn(s, path, val))} />
      ))}
      {canEdit && (
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" disabled={!dirty} onClick={() => setValues(initial)}>Reset</Button>
          <Button type="submit" loading={save.busy} disabled={!dirty}>Save changes</Button>
        </div>
      )}
    </form>
  );
}

function AttendanceSettingsPage() {
  const { can } = useAuth();
  const resource = useResource(paths.settings());
  const [tab, setTab] = useState('methods');
  const sections = resource.data ? (unwrap(resource.data).sections ?? unwrap(resource.data)) : {};
  const names = Object.keys(sections);
  return (
    <Screen title="Attendance settings" description="Organisation-wide attendance rules." permission="attendance.manage">
      <Card>
        {resource.loading ? (
          <Skeleton />
        ) : resource.error ? (
          <ErrorState error={resource.error} onRetry={resource.reload} />
        ) : names.length === 0 ? (
          <Banner tone="info" title="No settings available" />
        ) : (
          <>
            <Tabs items={names.map((n) => ({ value: n, label: titleCase(n) }))} value={names.includes(tab) ? tab : names[0]} onChange={setTab} />
            <Section key={names.includes(tab) ? tab : names[0]} name={names.includes(tab) ? tab : names[0]} initial={sections[names.includes(tab) ? tab : names[0]]} canEdit={can('attendance.manage')} onSaved={resource.reload} />
          </>
        )}
      </Card>
    </Screen>
  );
}

export default guarded(AttendanceSettingsPage, { title: 'Attendance settings', permission: 'attendance.manage' });
