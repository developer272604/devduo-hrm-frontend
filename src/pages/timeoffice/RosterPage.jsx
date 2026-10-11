import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Plus, Search, Send, ShieldCheck, Undo2, Users } from 'lucide-react';
import { Button, Card, ErrorState, Input, Pagination, Select, Skeleton, Tabs, useToast } from '../../components/ui';
import { Banner, Screen, StatusBadge, guarded } from '../../components/timeoffice/parts';
import { PreviewConfirm, ReasonDialog } from '../../components/timeoffice/dialogs';
import { FormDialog } from '../../components/timeoffice/CrudPanel';
import { useAuth } from '../../lib/auth';
import { useDebounced, useResource } from '../../lib/hooks';
import { addDays, listOf, pageOf, paths, send, titleCase, today, toOptions, unwrap, useLookup } from '../../lib/timeOfficeApi';

const VIEWS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][n - 1] }));
const SCOPES = ['custom', 'department', 'team', 'location', 'business_unit', 'employee_group'].map((v) => ({ value: v, label: v === 'custom' ? 'Hand-picked people' : titleCase(v) }));

export function rangeFor(view, anchor) {
  const d = new Date(`${anchor}T00:00:00`);
  if (view === 'day') return { from: anchor, to: anchor };
  if (view === 'week') {
    const from = addDays(anchor, -((d.getDay() + 6) % 7));
    return { from, to: addDays(from, 6) };
  }
  const from = new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA');
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('en-CA');
  return { from, to };
}
const datesIn = ({ from, to }) => {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};
const step = (view) => (view === 'month' ? 28 : view === 'week' ? 7 : 1);
const short = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric' });
const conflictLine = (c) => `${c.employee ? `${c.employee}${c.date ? `, ${c.date}` : ''}: ` : ''}${c.message ?? c.rule ?? titleCase(c.code)}`;

/**
 * Cell states come from the server grid: published (in the live roster), draft (unpublished edit), changed (a draft that
 * replaces published data) and derived (from shift assignments, not rostered). They must differ by more than colour:
 * border style plus a text tag.
 */
const CELL = {
  published: 'border-solid border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100',
  derived: 'border-solid border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
  draft: 'border-dashed border-amber-400 bg-white text-amber-900 dark:border-amber-600 dark:bg-slate-900 dark:text-amber-100',
  changed: 'border-double border-4 border-brand-400 bg-brand-50 text-brand-900 dark:border-brand-500 dark:bg-brand-950 dark:text-brand-100',
  empty: 'border-dotted border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900',
};
const TAG = { published: 'Published', derived: 'Assigned', draft: 'Draft', changed: 'Changed' };

/** What the cell shows: a pending draft wins, then the shift code, then the kind of day (weekly off, holiday). */
export function cellText(cell) {
  if (!cell) return '—';
  if (cell.draft) return cell.draft.type === 'off' ? 'Off' : (cell.draft.shift ?? 'Cleared');
  if (cell.shift) return cell.shift.code ?? cell.shift.name;
  if (cell.kind === 'holiday') return cell.holiday ?? 'Holiday';
  return cell.kind && cell.kind !== 'not_scheduled' ? titleCase(cell.kind) : '—';
}

export function RosterCell({ cell, label, onClick, disabled }) {
  const unscheduled = !cell || (cell.kind === 'not_scheduled' && !cell.draft);
  const status = unscheduled ? 'empty' : CELL[cell.state] ? cell.state : 'draft';
  const text = cellText(cell);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-status={status}
      aria-label={`${label}: ${unscheduled ? 'no shift' : `${text}, ${TAG[status]}`}`}
      className={`flex h-12 w-full min-w-16 flex-col items-center justify-center rounded-md border-2 px-1 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed ${CELL[status]}`}
    >
      <span className="max-w-full truncate">{text}</span>
      {!unscheduled && <span className="text-[9px] font-normal uppercase tracking-wide">{TAG[status]}</span>}
    </button>
  );
}

function Legend() {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-4 p-0 px-5 pb-3 text-[11px] text-slate-600 dark:text-slate-300" aria-label="Legend">
      {['published', 'derived', 'draft', 'changed', 'empty'].map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={`inline-block size-4 rounded-sm border-2 ${CELL[s]}`} />
          {s === 'empty' ? 'No shift' : `${TAG[s]}${s === 'changed' ? ' since publish' : ''}`}
        </li>
      ))}
    </ul>
  );
}

/** The grid, edits, bulk tools and publish flow for one roster. */
function RosterBoard({ roster, canEdit, onChanged }) {
  const toast = useToast();
  const [view, setView] = useState('week');
  const [anchor, setAnchor] = useState(() => {
    const t = today();
    return t < roster.start_date ? roster.start_date : t > roster.end_date ? roster.end_date : t;
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(null); // {type:'cell', row, date, cell} | 'bulk' | 'copy'
  const [bulkRequest, setBulkRequest] = useState(null);
  const [publishing, setPublishing] = useState(null); // 'publish' | 'unpublish'
  const [validation, setValidation] = useState(null);
  const q = useDebounced(search);
  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const dates = useMemo(() => datesIn(range), [range]);
  const shifts = useLookup(`${paths.shifts}?active_only=1`);
  const qs = new URLSearchParams({ view, from: range.from, to: range.to, page: String(page), per_page: '50' });
  if (q) qs.set('search', q);
  const resource = useResource(`${paths.roster(roster.uuid, 'grid')}?${qs}`);
  const rows = resource.data ? listOf(resource.data) : [];
  const live = resource.data?.roster ?? roster;
  const counts = rows.flatMap((r) => Object.values(r.cells ?? {})).reduce((a, c) => ({ ...a, [c.state]: (a[c.state] ?? 0) + 1 }), {});
  const shiftOptions = toOptions(shifts, 'Choose a shift').map((o) => (o.value === '' ? { value: '', label: 'Choose a shift' } : o));
  const shiftUuid = (code) => shifts.find((s) => s.code === code)?.uuid ?? '';
  const employeeUuids = rows.map((r) => r.employee_uuid);
  const saved = (msg) => {
    toast(msg);
    resource.reload();
    onChanged();
  };
  const url = (part) => paths.roster(roster.uuid, part);
  const rosterOutside = (d) => d < roster.start_date || d > roster.end_date;

  const cellFields = [
    { name: 'entry_type', label: 'Entry type', type: 'select', default: 'shift', options: [{ value: 'shift', label: 'Working shift' }, { value: 'off', label: 'Day off' }] },
    { name: 'shift_uuid', label: 'Shift', type: 'select', options: shiftOptions, default: '', showIf: (v) => v.entry_type === 'shift' },
    { name: 'reason', label: 'Reason', type: 'textarea', hint: 'Required when the day is already published; employees will see the change.' },
  ];
  const bulkFields = [
    { name: 'entry_type', label: 'Entry type', type: 'select', default: 'shift', options: [{ value: 'shift', label: 'Working shift' }, { value: 'off', label: 'Day off' }] },
    { name: 'shift_uuid', label: 'Shift', type: 'select', options: shiftOptions, default: '', showIf: (v) => v.entry_type === 'shift' },
    { name: 'from', label: 'From', type: 'date', required: true, default: range.from < roster.start_date ? roster.start_date : range.from, min: roster.start_date, max: roster.end_date },
    { name: 'to', label: 'To', type: 'date', required: true, default: range.to > roster.end_date ? roster.end_date : range.to, min: roster.start_date, max: roster.end_date },
    { name: 'weekdays', label: 'Only on these days (none selected means every day)', type: 'multi', options: WEEKDAYS, default: [] },
  ];
  const copyFields = [
    { name: 'target_from', label: 'Copy this range to start on', type: 'date', required: true, default: addDays(range.to, 1), min: roster.start_date, max: roster.end_date },
  ];
  const bulkBody = (b, preview) => ({
    employee_uuids: employeeUuids,
    entry_type: b.entry_type,
    shift_uuid: b.entry_type === 'shift' ? b.shift_uuid : undefined,
    from: b.from,
    to: b.to,
    weekdays: b.weekdays?.length ? b.weekdays.map(Number) : undefined,
    preview,
    acknowledge_warnings: !preview,
  });

  async function check() {
    try {
      setValidation(unwrap(await send('POST', url('validate'))));
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-end gap-3 p-5">
          <div className="flex items-center gap-1" role="group" aria-label="Period">
            <Button variant="secondary" aria-label="Previous period" onClick={() => { setAnchor(addDays(range.from, -step(view))); setPage(1); }}><ChevronLeft size={16} /></Button>
            <strong className="min-w-40 text-center text-xs">{range.from}{range.to !== range.from ? ` to ${range.to}` : ''}</strong>
            <Button variant="secondary" aria-label="Next period" onClick={() => { setAnchor(addDays(range.to, 1)); setPage(1); }}><ChevronRight size={16} /></Button>
            <Button variant="secondary" onClick={() => { setAnchor(today()); setPage(1); }}>Today</Button>
          </div>
          <Select label="View" options={VIEWS} value={view} onChange={(e) => { setView(e.target.value); setPage(1); }} />
          <Input label="Find a person" type="search" value={search} placeholder="Name or number" onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <div className="mb-5"><Button variant="secondary" onClick={check}><ShieldCheck size={14} /> Check conflicts</Button></div>
        </div>
        {(range.to < roster.start_date || range.from > roster.end_date) && <div className="px-5"><Banner tone="info">This roster covers {roster.start_date} to {roster.end_date}. Move to a date inside it to plan shifts.</Banner></div>}
        {validation && (
          <div className="px-5" role="region" aria-label="Conflicts">
            {validation.count === 0 ? (
              <Banner tone="success" title="No roster conflicts" />
            ) : (
              <Banner tone={validation.blocking ? 'error' : 'warn'} title={`${validation.count} roster conflict${validation.count === 1 ? '' : 's'}${validation.blocking ? ' (publishing is blocked)' : ''}`}>
                <ul className="m-0 mt-1 list-disc pl-4">
                  {validation.conflicts.slice(0, 8).map((c, i) => (
                    <li key={i}>{conflictLine(c)}</li>
                  ))}
                </ul>
                {validation.count > 8 && <p className="m-0 mt-1">and {validation.count - 8} more</p>}
              </Banner>
            )}
          </div>
        )}
        {resource.loading ? (
          <Skeleton rows={5} />
        ) : resource.error ? (
          <ErrorState error={resource.error} onRetry={resource.reload} />
        ) : rows.length === 0 ? (
          <div className="px-6 py-10 text-center text-xs text-slate-500">No one to roster for this selection. Add people with Bulk assign, or change the search or period.</div>
        ) : (
          <>
            <Legend />
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-separate border-spacing-1 text-xs" aria-label="Roster grid">
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 min-w-40 bg-white px-2 py-2 text-left font-medium text-slate-500 dark:bg-slate-900">Employee</th>
                    {dates.map((d) => (
                      <th key={d} scope="col" className="px-1 py-2 text-center font-medium text-slate-500 dark:text-slate-400">{short(d)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.employee_uuid}>
                      <th scope="row" className="sticky left-0 z-10 bg-white px-2 py-1 text-left font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        {r.name}
                        <span className="block text-[10px] font-normal text-slate-400">{r.employee_number}</span>
                      </th>
                      {dates.map((d) => (
                        <td key={d} className="p-0">
                          <RosterCell cell={r.cells?.[d]} label={`${r.name}, ${d}`} disabled={!canEdit || rosterOutside(d)} onClick={() => setDialog({ type: 'cell', row: r, date: d, cell: r.cells?.[d] })} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800 md:hidden" aria-label="Roster list">
              {rows.map((r) => (
                <li key={r.employee_uuid} className="px-4 py-3">
                  <strong className="text-sm">{r.name}</strong>
                  <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
                    {dates.slice(0, 31).map((d) => (
                      <li key={d} className="flex items-center gap-3">
                        <span className="w-16 shrink-0 text-[11px] text-slate-500">{short(d)}</span>
                        <div className="flex-1">
                          <RosterCell cell={r.cells?.[d]} label={`${r.name}, ${d}`} disabled={!canEdit || rosterOutside(d)} onClick={() => setDialog({ type: 'cell', row: r, date: d, cell: r.cells?.[d] })} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <p className="m-0 flex flex-wrap gap-2 px-5 py-3 text-[11px] text-slate-500">
              {Object.entries(counts).map(([k, n]) => (
                <StatusBadge key={k} status={k}>{n} {k}</StatusBadge>
              ))}
            </p>
            <Pagination data={pageOf(resource.data)} onChange={setPage} />
          </>
        )}
      </Card>
      {canEdit && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setDialog('bulk')} disabled={rows.length === 0}><Users size={14} /> Bulk assign</Button>
          <Button variant="secondary" onClick={() => setDialog('copy')} disabled={rows.length === 0}><Copy size={14} /> Copy range</Button>
          <Button variant="secondary" onClick={() => setPublishing('unpublish')} disabled={live.status !== 'published'}><Undo2 size={14} /> Unpublish</Button>
          <Button onClick={() => setPublishing('publish')} disabled={!live.has_unpublished_changes}><Send size={14} /> Publish</Button>
        </div>
      )}

      <FormDialog
        open={dialog?.type === 'cell'}
        onClose={() => setDialog(null)}
        title={dialog?.type === 'cell' ? `${dialog.row.name} · ${dialog.date}` : ''}
        fields={cellFields}
        row={dialog?.type === 'cell' ? { entry_type: dialog.cell?.draft?.type ?? (dialog.cell?.kind === 'weekly_off' ? 'off' : 'shift'), shift_uuid: shiftUuid(dialog.cell?.draft?.shift ?? dialog.cell?.shift?.code) } : null}
        submitLabel={dialog?.cell?.shift || dialog?.cell?.draft ? 'Change' : 'Assign'}
        onSubmit={async (b) => {
          await send('POST', url('entries'), { employee_uuid: dialog.row.employee_uuid, date: dialog.date, entry_type: b.entry_type, shift_uuid: b.entry_type === 'shift' ? b.shift_uuid : undefined, reason: b.reason, expected_version: live.publication_version });
          saved('Saved to the draft roster');
        }}
      >
        {() =>
          dialog?.cell ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {dialog.cell.draft && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await send('POST', url('entries/discard'), { employee_uuid: dialog.row.employee_uuid, date: dialog.date });
                    setDialog(null);
                    saved('Draft discarded');
                  }}
                >
                  Discard this draft
                </Button>
              )}
              {dialog.cell.source === 'roster' && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await send('POST', url('entries/clear'), { employee_uuid: dialog.row.employee_uuid, date: dialog.date });
                    setDialog(null);
                    saved('Entry cleared in the draft');
                  }}
                >
                  Clear this day
                </Button>
              )}
            </div>
          ) : null
        }
      </FormDialog>
      <FormDialog
        open={dialog === 'bulk'}
        onClose={() => setDialog(null)}
        title="Bulk assign a shift"
        fields={bulkFields}
        submitLabel="Preview"
        notice={<Banner tone="info">Applies to everyone currently listed ({rows.length}). You see the conflicts before anything is saved.</Banner>}
        onSubmit={async (b) => setBulkRequest(b)}
      />
      <PreviewConfirm
        open={Boolean(bulkRequest)}
        onClose={() => setBulkRequest(null)}
        title="Confirm bulk assignment"
        intro="Nothing is saved until you confirm. Assignments go to the draft roster."
        load={async () => {
          const d = unwrap(await send('POST', url('bulk-assign'), bulkBody(bulkRequest, true)));
          return { cells: d.cells, locked_days: d.locked.length, conflicts: d.conflicts.map(conflictLine), blocked: d.locked.length > 0 || d.conflicts.some((c) => c.level === 'block') };
        }}
        onConfirm={async () => {
          await send('POST', url('bulk-assign'), bulkBody(bulkRequest, false));
          saved('Shift assigned in the draft roster');
        }}
        confirmLabel="Assign to draft"
      />
      <FormDialog
        open={dialog === 'copy'}
        onClose={() => setDialog(null)}
        title={`Copy ${range.from} to ${range.to}`}
        fields={copyFields}
        submitLabel="Copy to draft"
        onSubmit={async (b) => {
          await send('POST', url('copy'), { employee_uuids: employeeUuids, source_from: range.from, target_from: b.target_from, days: dates.length });
          saved('Range copied into the draft roster');
        }}
      />
      <PreviewConfirm
        open={publishing === 'publish'}
        onClose={() => setPublishing(null)}
        title="Publish roster"
        intro="Employees and managers will see this schedule, and attendance will be calculated against it."
        load={async () => {
          const [check, changes] = await Promise.all([send('POST', url('validate')).then(unwrap), fetchChanges(url('changes'))]);
          return { unpublished_entries: live.draft_entries, replacing_published_entries: changes.length, conflicts: check.conflicts.map(conflictLine), blocked: check.blocking, warnings: check.count };
        }}
        onConfirm={async (preview) => {
          await send('POST', url('publish'), { acknowledge_warnings: preview.warnings > 0, expected_version: live.publication_version });
          saved('Roster published');
        }}
        confirmLabel="Publish"
      />
      <ReasonDialog
        open={publishing === 'unpublish'}
        onClose={() => setPublishing(null)}
        title="Unpublish roster"
        intro="Published shifts return to draft. Employees stop seeing them and attendance falls back to their shift assignments."
        danger
        confirmLabel="Unpublish"
        onConfirm={async (reason) => {
          await send('POST', url('unpublish'), { reason });
          saved('Roster unpublished');
        }}
      />
    </>
  );
}

const fetchChanges = async (path) => listOf(await send('GET', path));

function RosterPagePage() {
  const { can } = useAuth();
  const toast = useToast();
  const [picked, setPicked] = useState('');
  const [creating, setCreating] = useState(false);
  const list = useResource(paths.rosters);
  const canEdit = can('attendance.roster.manage');
  const rosters = list.data ? listOf(list.data) : [];
  const roster = rosters.find((r) => r.uuid === picked) ?? rosters[0];
  const createFields = [
    { name: 'name', label: 'Name', required: true, hint: 'For example "Chennai support - November".' },
    { name: 'start_date', label: 'First day', type: 'date', required: true, default: today() },
    { name: 'end_date', label: 'Last day', type: 'date', required: true, default: addDays(today(), 27), hint: 'A roster covers at most about three months.' },
    { name: 'scope_type', label: 'Who it is for', type: 'select', default: 'custom', options: SCOPES },
    { name: 'scope_id', label: 'Record ID', showIf: (v) => v.scope_type !== 'custom', required: true },
  ];

  return (
    <Screen
      title="Roster"
      description="Plan who works when. Drafts stay private until you publish."
      permission="attendance.roster.manage|attendance.manage"
      action={canEdit && <Button onClick={() => setCreating(true)}><Plus size={14} /> New roster</Button>}
    >
      {list.loading ? (
        <Skeleton rows={3} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : !roster ? (
        <Card>
          <div className="px-6 py-10 text-center text-xs text-slate-500">No rosters yet. {canEdit ? 'Create one to start planning shifts.' : 'Ask a time office administrator to create one.'}</div>
        </Card>
      ) : (
        <>
          <Card className="mb-5">
            <Tabs items={rosters.slice(0, 8).map((r) => ({ value: r.uuid, label: r.name }))} value={roster.uuid} onChange={setPicked} />
            <p className="m-0 flex flex-wrap items-center gap-2 px-5 py-3 text-xs text-slate-600 dark:text-slate-300">
              <StatusBadge status={roster.status} />
              {roster.start_date} to {roster.end_date}
              {roster.has_unpublished_changes && <span>· {roster.draft_entries} unpublished change{roster.draft_entries === 1 ? '' : 's'}</span>}
            </p>
          </Card>
          <RosterBoard key={roster.uuid} roster={roster} canEdit={canEdit} onChanged={list.reload} />
        </>
      )}
      <FormDialog
        open={creating}
        onClose={() => setCreating(false)}
        title="New roster"
        fields={createFields}
        submitLabel="Create roster"
        onSubmit={async (b) => {
          const r = unwrap(await send('POST', paths.rosters, { ...b, scope_id: b.scope_type === 'custom' ? undefined : b.scope_id }));
          toast('Roster created');
          setPicked(r.uuid);
          list.reload();
        }}
      />
    </Screen>
  );
}

export default guarded(RosterPagePage, { title: 'Roster', permission: 'attendance.roster.manage|attendance.manage' });
