import { useState } from 'react';
import { Card, Tabs } from '../../components/ui';
import CrudPanel from '../../components/timeoffice/CrudPanel';
import { Banner, Screen, StatusBadge } from '../../components/timeoffice/parts';
import { useAuth } from '../../lib/auth';
import { paths, today, titleCase, useLookup, toOptions, minutes } from '../../lib/timeOfficeApi';

const TABS = [
  { value: 'shifts', label: 'Shifts' },
  { value: 'rotations', label: 'Rotations' },
  { value: 'assignments', label: 'Assignments' },
];
const hhmm = (t) => (t ? String(t).slice(0, 5) : '—');
const KIND = { fixed: 'Fixed', flexible: 'Flexible', split: 'Split' };

/** True when the shift ends at or before it starts, i.e. it finishes on the next calendar day. */
export const crossesMidnight = (v) => Boolean(v.start_time && v.end_time && v.end_time <= v.start_time);

const shiftFields = [
  { name: 'name', label: 'Name', required: true },
  { name: 'code', label: 'Code', required: true, hint: 'Short unique code, for example GEN or NIGHT.' },
  { name: 'kind', label: 'Type', type: 'select', required: true, default: 'fixed', options: [{ value: 'fixed', label: 'Fixed hours' }, { value: 'flexible', label: 'Flexible hours' }, { value: 'split', label: 'Split (two or more work blocks)' }] },
  { name: 'timezone', label: 'Time zone', required: true, default: 'Asia/Kolkata', hint: 'IANA name, for example Asia/Kolkata. Times below are local to it.' },
  { name: 'start_time', label: 'Starts', type: 'time', required: true },
  { name: 'end_time', label: 'Ends', type: 'time', required: true },
  { name: 'flex_start_from', label: 'Earliest start', type: 'time', showIf: (v) => v.kind === 'flexible' },
  { name: 'flex_start_to', label: 'Latest start', type: 'time', showIf: (v) => v.kind === 'flexible' },
  { name: 'core_start', label: 'Core hours start', type: 'time', showIf: (v) => v.kind === 'flexible' },
  { name: 'core_end', label: 'Core hours end', type: 'time', showIf: (v) => v.kind === 'flexible' },
  { name: 'required_minutes', label: 'Required minutes to complete', type: 'number', showIf: (v) => v.kind === 'flexible', min: 1 },
  { name: 'segments', label: 'Work and break blocks (JSON list)', type: 'json', showIf: (v) => v.kind === 'split', hint: 'Each block: {"kind":"work","paid":true,"start":"09:00","end":"13:00"}. Use kind "break" for breaks.' },
  { name: 'minimum_minutes', label: 'Minimum minutes for a present day', type: 'number', min: 0 },
  { name: 'half_day_minutes', label: 'Half-day minutes', type: 'number', min: 0 },
  { name: 'full_day_minutes', label: 'Full-day minutes', type: 'number', min: 0 },
  { name: 'punch_window_before', label: 'Accept IN punches this many minutes before start', type: 'number', default: 120 },
  { name: 'punch_window_after', label: 'Accept OUT punches this many minutes after end', type: 'number', default: 240 },
  { name: 'overtime_eligible', label: 'Eligible for overtime', type: 'checkbox', default: true },
  { name: 'active', label: 'Active', type: 'checkbox', default: true },
];

function CrossMidnightNote({ values }) {
  return crossesMidnight(values) ? (
    <Banner tone="info" title="Cross-midnight shift">
      This shift ends the next day. The whole shift counts toward the day it starts on.
    </Banner>
  ) : null;
}

const rotationFields = [
  { name: 'name', label: 'Name', required: true },
  { name: 'code', label: 'Code', required: true },
  { name: 'cycle_length', label: 'Cycle length (days)', type: 'number', required: true, min: 1, max: 366 },
  { name: 'days', label: 'Days of the cycle (JSON list)', type: 'json', required: true, hint: 'One entry per day of the cycle: a shift ID, or null for a day off. For example ["<shift id>", "<shift id>", null].' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'active', label: 'Active', type: 'checkbox', default: true },
];
const rotationFromRow = (r) => ({ ...r, days: (r.days ?? []).map((d) => d.shift?.uuid ?? null) });

const TARGETS = ['employee', 'team', 'department', 'employee_group', 'business_unit', 'location', 'employee_type', 'legal_entity', 'country', 'tenant'].map((v) => ({ value: v, label: v === 'tenant' ? 'Whole organisation' : titleCase(v) }));

function Assignments({ canEdit }) {
  const shifts = useLookup(paths.shifts);
  const rotations = useLookup(paths.shiftRotations);
  const fields = [
    { name: 'target_type', label: 'Applies to', type: 'select', required: true, default: 'employee', options: TARGETS },
    { name: 'target_id', label: 'Employee ID / record ID / country code', hint: 'Leave empty for the whole organisation.', showIf: (v) => v.target_type !== 'tenant' },
    { name: 'shift_uuid', label: 'Shift', type: 'select', options: toOptions(shifts, 'None') },
    { name: 'rotation_uuid', label: 'Rotation (instead of a shift)', type: 'select', options: toOptions(rotations, 'None') },
    { name: 'rotation_anchor', label: 'Rotation day 1 falls on', type: 'date' },
    { name: 'effective_from', label: 'Effective from', type: 'date', required: true, default: today() },
    { name: 'effective_to', label: 'Effective to', type: 'date' },
    { name: 'priority', label: 'Priority (higher wins ties)', type: 'number', default: 0 },
    { name: 'is_override', label: 'Override (beats more specific assignments)', type: 'checkbox', default: false },
    { name: 'supersede', label: 'End any assignment already covering this target the day before', type: 'checkbox', default: false },
    { name: 'note', label: 'Note', type: 'textarea' },
  ];
  return (
    <CrudPanel
      title="Shift assignments"
      noun="assignment"
      listPath={paths.shiftAssignments}
      itemPath={(r) => `${paths.shiftAssignments}/${r.id}`}
      canEdit={canEdit}
      fields={fields}
      fromRow={(r) => ({ ...r, shift_uuid: r.shift?.uuid ?? '', rotation_uuid: r.rotation?.uuid ?? '' })}
      columns={[
        { key: 'target', label: 'Applies to', render: (r) => r.target_name ?? `${titleCase(r.target_type)} ${r.target_id ?? ''}` },
        { key: 'shift', label: 'Shift / rotation', render: (r) => r.shift?.name ?? r.rotation?.name ?? '—' },
        { key: 'effective_from', label: 'From', priority: 'md' },
        { key: 'effective_to', label: 'To', priority: 'md', render: (r) => r.effective_to ?? 'Open-ended' },
        { key: 'priority', label: 'Priority', priority: 'lg' },
      ]}
      mobile={{ title: (r) => r.target_name ?? titleCase(r.target_type), subtitle: (r) => r.shift?.name ?? r.rotation?.name, facts: [{ label: 'From', value: 'effective_from' }, { label: 'To', value: (r) => r.effective_to ?? 'Open' }] }}
    />
  );
}

export default function ShiftsPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState('shifts');
  const canEdit = can('attendance.roster.manage');
  return (
    <Screen title="Shifts" description="Shift definitions, rotations and who they apply to." permission="attendance.roster.manage|attendance.manage">
      <Card className="mb-5">
        <Tabs items={TABS} value={tab} onChange={setTab} />
      </Card>
      {tab === 'shifts' && (
        <CrudPanel
          title="Shifts"
          noun="shift"
          listPath={paths.shifts}
          itemPath={(r) => `${paths.shifts}/${r.uuid ?? r.id}`}
          canEdit={canEdit}
          fields={shiftFields}
          formChildren={(v) => <CrossMidnightNote values={v} />}
          columns={[
            { key: 'name', label: 'Shift' },
            { key: 'code', label: 'Code', priority: 'md' },
            { key: 'kind', label: 'Type', priority: 'md', render: (r) => KIND[r.kind] ?? r.kind },
            { key: 'hours', label: 'Hours', render: (r) => (r.kind === 'flexible' ? `Flexible, ${minutes(r.required_minutes)}` : `${hhmm(r.start_time)} to ${hhmm(r.end_time)}${crossesMidnight(r) || r.crosses_midnight ? ' (+1 day)' : ''}`) },
            { key: 'overtime_eligible', label: 'Overtime', priority: 'lg', render: (r) => (r.overtime_eligible ? 'Eligible' : 'No') },
            { key: 'active', label: 'Status', render: (r) => <StatusBadge status={r.active === false ? 'inactive' : 'active'} /> },
          ]}
          mobile={{ title: 'name', subtitle: (r) => `${r.code} · ${KIND[r.kind] ?? r.kind}`, badge: (r) => <StatusBadge status={r.active === false ? 'inactive' : 'active'} />, facts: [{ label: 'Hours', value: (r) => (r.kind === 'flexible' ? 'Flexible' : `${hhmm(r.start_time)} to ${hhmm(r.end_time)}${r.crosses_midnight ? ' (+1)' : ''}`) }] }}
        />
      )}
      {tab === 'rotations' && (
        <CrudPanel
          title="Rotations"
          noun="rotation"
          listPath={paths.shiftRotations}
          itemPath={(r) => `${paths.shiftRotations}/${r.uuid ?? r.id}`}
          canEdit={canEdit}
          fields={rotationFields}
          fromRow={rotationFromRow}
          columns={[
            { key: 'name', label: 'Rotation' },
            { key: 'code', label: 'Code', priority: 'md' },
            { key: 'cycle_length', label: 'Cycle (days)' },
            { key: 'active', label: 'Status', render: (r) => <StatusBadge status={r.active === false ? 'inactive' : 'active'} /> },
          ]}
          mobile={{ title: 'name', subtitle: (r) => `${r.code} · ${r.cycle_length}-day cycle`, badge: (r) => <StatusBadge status={r.active === false ? 'inactive' : 'active'} /> }}
        />
      )}
      {tab === 'assignments' && <Assignments canEdit={canEdit} />}
    </Screen>
  );
}
