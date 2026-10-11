import { useState } from 'react';
import { Button, Card, Input, Modal, Tabs, useToast } from '../../components/ui';
import CrudPanel, { FormDialog } from '../../components/timeoffice/CrudPanel';
import { Screen, StatusBadge } from '../../components/timeoffice/parts';
import { useAuth } from '../../lib/auth';
import { paths, send, today, titleCase, toOptions, unwrap, useLookup } from '../../lib/timeOfficeApi';

const TABS = [
  { value: 'weeks', label: 'Work weeks' },
  { value: 'holidays', label: 'Holiday calendars' },
  { value: 'assignments', label: 'Assignments' },
];
const DAYS = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [7, 'Sunday']];
const DAY_OPTIONS = [{ value: 'full', label: 'Working day' }, { value: 'half', label: 'Half day' }, { value: 'off', label: 'Weekly off' }];
const defaultDay = (k) => (k >= 6 ? 'off' : 'full');
const dayFields = DAYS.map(([k, label]) => ({ name: `day_${k}`, label, type: 'select', options: DAY_OPTIONS, default: defaultDay(k) }));
const daysOf = (b) => Object.fromEntries(DAYS.map(([k]) => [k, b[`day_${k}`] || defaultDay(k)]));

const weekFields = [
  { name: 'name', label: 'Name', required: true },
  { name: 'code', label: 'Code', required: true },
  ...dayFields,
  { name: 'effective_from', label: 'Effective from', type: 'date', required: true, default: today() },
  { name: 'description', label: 'Description', type: 'textarea' },
];
/** Creating sends the day pattern. Editing sends metadata only: a started work week changes through a new version. */
const weekToPayload = (b, editing) => {
  const { effective_from, ...meta } = Object.fromEntries(Object.entries(b).filter(([k]) => !k.startsWith('day_')));
  return editing ? meta : { ...meta, effective_from, days: daysOf(b) };
};
const weekFromRow = (r) => ({ ...r, ...Object.fromEntries(DAYS.map(([k]) => [`day_${k}`, (r.days ?? []).find((d) => d.weekday === k)?.type ?? defaultDay(k)])) });
const weekOffs = (r) => (r.days ?? []).filter((d) => d.type === 'off').map((d) => titleCase(d.name).slice(0, 3)).join(', ') || 'None';

const calendarFields = [
  { name: 'name', label: 'Name', required: true },
  { name: 'code', label: 'Code', required: true },
  { name: 'country', label: 'Country (2 letters)', hint: 'For example IN or US.' },
  { name: 'region', label: 'Region or state' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'active', label: 'Active', type: 'checkbox', default: true },
];
const holidayFields = [
  { name: 'date', label: 'Date', type: 'date', required: true },
  { name: 'name', label: 'Holiday', required: true },
  { name: 'type', label: 'Type', type: 'select', default: 'mandatory', options: [{ value: 'mandatory', label: 'Mandatory holiday' }, { value: 'optional', label: 'Optional holiday' }, { value: 'restricted', label: 'Restricted holiday' }] },
  { name: 'portion', label: 'Portion of the day', type: 'select', default: 'full', options: [{ value: 'full', label: 'Full day' }, { value: 'first_half', label: 'First half' }, { value: 'second_half', label: 'Second half' }] },
  { name: 'recurrence', label: 'Repeats', type: 'select', default: 'none', options: [{ value: 'none', label: 'This date only' }, { value: 'yearly', label: 'Every year on this date' }] },
  { name: 'description', label: 'Description', type: 'textarea' },
];
/** A yearly repeat is the server's fixed-date rule. Other stored rules (for example "last Monday") are left untouched on edit. */
const holidayToPayload = (b, editing) => {
  const { recurrence, ...rest } = b;
  if (recurrence === 'yearly' && b.date) return { ...rest, recurrence: { rule: 'fixed', month: Number(b.date.slice(5, 7)), day: Number(b.date.slice(8, 10)) } };
  if (editing?.recurrence && editing.recurrence.rule !== 'fixed') return rest;
  return { ...rest, recurrence: null };
};
const holidayFromRow = (r) => ({ ...r, recurrence: r.recurrence?.rule === 'fixed' ? 'yearly' : 'none' });

function Holidays({ calendar, canEdit, onClose }) {
  const toast = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [dialog, setDialog] = useState(null); // 'generate' | 'copy'
  const [version, setVersion] = useState(0);
  const root = `${paths.holidayCalendars}/${calendar.uuid}`;
  return (
    <Modal open onClose={onClose} title={`Holidays: ${calendar.name}`}>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Input label="Year" type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value) || year)} />
        {canEdit && (
          <div className="mb-5 flex gap-2">
            <Button variant="secondary" onClick={() => setDialog('generate')}>Generate repeating holidays</Button>
            <Button variant="secondary" onClick={() => setDialog('copy')}>Copy calendar</Button>
          </div>
        )}
      </div>
      <CrudPanel
        key={`${year}-${version}`}
        title="Holidays"
        noun="holiday"
        listPath={`${root}?year=${year}`}
        createPath={`${root}/holidays`}
        pick={(r) => unwrap(r).holidays ?? []}
        itemPath={(r) => `${root}/holidays/${r.id}`}
        canEdit={canEdit}
        fields={holidayFields}
        toPayload={holidayToPayload}
        fromRow={holidayFromRow}
        columns={[
          { key: 'date', label: 'Date' },
          { key: 'name', label: 'Holiday' },
          { key: 'type', label: 'Type', render: (r) => titleCase(r.type) },
          { key: 'portion', label: 'Portion', render: (r) => titleCase(r.portion) },
        ]}
        mobile={{ title: 'name', subtitle: 'date', badge: (r) => <StatusBadge status={r.type} /> }}
      />
      <FormDialog
        open={dialog === 'generate'}
        onClose={() => setDialog(null)}
        title="Generate repeating holidays"
        fields={[{ name: 'year', label: 'Year', type: 'number', required: true, default: year }]}
        submitLabel="Generate"
        onSubmit={async (b) => {
          await send('POST', `${root}/generate`, b);
          toast('Repeating holidays generated');
          setYear(b.year);
          setVersion((v) => v + 1);
        }}
      />
      <FormDialog
        open={dialog === 'copy'}
        onClose={() => setDialog(null)}
        title="Copy calendar"
        fields={[
          { name: 'name', label: 'New calendar name', required: true, default: `${calendar.name} (copy)` },
          { name: 'code', label: 'New calendar code', required: true },
          { name: 'source_year', label: 'Copy holidays from year', type: 'number', default: year },
          { name: 'target_year', label: 'Into year', type: 'number', default: year + 1 },
        ]}
        submitLabel="Copy"
        onSubmit={async (b) => {
          await send('POST', `${root}/copy`, b);
          toast('Calendar copied');
        }}
      />
    </Modal>
  );
}

function Assignments({ canEdit }) {
  const weeks = useLookup(paths.workWeeks);
  const calendars = useLookup(paths.holidayCalendars);
  const target = [
    { name: 'target_type', label: 'Applies to', type: 'select', required: true, default: 'tenant', options: ['tenant', 'country', 'legal_entity', 'location', 'business_unit', 'department', 'team', 'employee_group', 'employee_type', 'employee'].map((v) => ({ value: v, label: v === 'tenant' ? 'Whole organisation' : titleCase(v) })) },
    { name: 'target_id', label: 'Record, employee or country ID', hint: 'Leave empty for the whole organisation.', showIf: (v) => v.target_type !== 'tenant' },
  ];
  const dates = [
    { name: 'effective_from', label: 'Effective from', type: 'date', required: true, default: today() },
    { name: 'effective_to', label: 'Effective to', type: 'date' },
    { name: 'priority', label: 'Priority (higher wins ties)', type: 'number', default: 0 },
    { name: 'is_override', label: 'Override (beats more specific assignments)', type: 'checkbox', default: false },
    { name: 'supersede', label: 'End any assignment already covering this target the day before', type: 'checkbox', default: false },
  ];
  const cols = (key, label) => [
    { key: 'target', label: 'Applies to', render: (r) => r.target_name ?? `${titleCase(r.target_type)} ${r.target_id ?? ''}` },
    { key, label, render: (r) => r[key]?.name ?? '—' },
    { key: 'effective_from', label: 'From', priority: 'md' },
    { key: 'effective_to', label: 'To', priority: 'md', render: (r) => r.effective_to ?? 'Open-ended' },
  ];
  return (
    <>
      <CrudPanel
        title="Work week assignments"
        noun="work week assignment"
        listPath={paths.workWeekAssignments}
        itemPath={(r) => `${paths.workWeekAssignments}/${r.id}`}
        canEdit={canEdit}
        fields={[...target, { name: 'work_week_uuid', label: 'Work week', type: 'select', required: true, options: toOptions(weeks.map((w) => ({ ...w, name: `${w.name} (v${w.version})` })), 'Choose…') }, ...dates]}
        fromRow={(r) => ({ ...r, work_week_uuid: r.work_week?.uuid ?? '' })}
        columns={cols('work_week', 'Work week')}
        mobile={{ title: (r) => r.target_name ?? titleCase(r.target_type), subtitle: (r) => r.work_week?.name, facts: [{ label: 'From', value: 'effective_from' }] }}
      />
      <CrudPanel
        title="Holiday calendar assignments"
        noun="calendar assignment"
        listPath={paths.holidayCalendarAssignments}
        itemPath={(r) => `${paths.holidayCalendarAssignments}/${r.id}`}
        canEdit={canEdit}
        fields={[...target, { name: 'calendar_uuid', label: 'Holiday calendar', type: 'select', required: true, options: toOptions(calendars, 'Choose…') }, ...dates]}
        fromRow={(r) => ({ ...r, calendar_uuid: r.calendar?.uuid ?? '' })}
        columns={cols('calendar', 'Calendar')}
        mobile={{ title: (r) => r.target_name ?? titleCase(r.target_type), subtitle: (r) => r.calendar?.name, facts: [{ label: 'From', value: 'effective_from' }] }}
      />
    </>
  );
}

export default function CalendarsPage() {
  const { can } = useAuth();
  const canEdit = can('attendance.roster.manage');
  const [tab, setTab] = useState('weeks');
  const [open, setOpen] = useState(null);
  const [versioning, setVersioning] = useState(null);
  const toast = useToast();
  return (
    <Screen title="Calendars" description="Weekly offs, holidays and which people they apply to." permission="attendance.roster.manage|attendance.manage">
      <Card className="mb-5">
        <Tabs items={TABS} value={tab} onChange={setTab} />
      </Card>
      {tab === 'weeks' && (
        <CrudPanel
          title="Work weeks"
          noun="work week"
          listPath={paths.workWeeks}
          itemPath={(r) => `${paths.workWeeks}/${r.uuid}`}
          canEdit={canEdit}
          fields={weekFields}
          toPayload={weekToPayload}
          fromRow={weekFromRow}
          rowActions={(r, reload) => canEdit && <Button variant="secondary" onClick={() => setVersioning({ row: r, reload })}>New version</Button>}
          columns={[
            { key: 'name', label: 'Work week' },
            { key: 'code', label: 'Code', priority: 'md' },
            { key: 'version', label: 'Version', priority: 'md', render: (r) => `v${r.version}` },
            { key: 'offs', label: 'Weekly offs', render: weekOffs },
            { key: 'effective_from', label: 'From', priority: 'md' },
            { key: 'active', label: 'Status', render: (r) => <StatusBadge status={r.active === false ? 'inactive' : 'active'} /> },
          ]}
          mobile={{ title: 'name', subtitle: 'code', badge: (r) => <StatusBadge status={r.active === false ? 'inactive' : 'active'} />, facts: [{ label: 'From', value: 'effective_from' }] }}
        />
      )}
      {tab === 'holidays' && (
        <CrudPanel
          title="Holiday calendars"
          noun="holiday calendar"
          listPath={paths.holidayCalendars}
          itemPath={(r) => `${paths.holidayCalendars}/${r.uuid}`}
          canEdit={canEdit}
          fields={calendarFields}
          rowActions={(r) => <Button variant="secondary" onClick={() => setOpen(r)}>Holidays</Button>}
          columns={[
            { key: 'name', label: 'Calendar' },
            { key: 'country', label: 'Country', priority: 'md' },
            { key: 'region', label: 'Region', priority: 'lg' },
            { key: 'active', label: 'Status', render: (r) => <StatusBadge status={r.active === false ? 'inactive' : 'active'} /> },
          ]}
          mobile={{ title: 'name', subtitle: (r) => [r.country, r.region].filter(Boolean).join(' · '), badge: (r) => <StatusBadge status={r.active === false ? 'inactive' : 'active'} /> }}
        />
      )}
      {tab === 'assignments' && <Assignments canEdit={canEdit} />}
      {open && <Holidays calendar={open} canEdit={canEdit} onClose={() => setOpen(null)} />}
      <FormDialog
        open={Boolean(versioning)}
        onClose={() => setVersioning(null)}
        title={versioning ? `New version of ${versioning.row.name}` : ''}
        fields={[{ name: 'effective_from', label: 'Effective from', type: 'date', required: true, default: today() }, ...dayFields]}
        row={versioning ? { ...weekFromRow(versioning.row), effective_from: undefined } : null}
        submitLabel="Create version"
        onSubmit={async (b) => {
          await send('POST', `${paths.workWeeks}/${versioning.row.uuid}/versions`, { effective_from: b.effective_from, days: daysOf(b) });
          toast('New work week version created');
          versioning.reload();
        }}
      />
    </Screen>
  );
}
