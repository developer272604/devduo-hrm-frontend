import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, CircleAlert } from 'lucide-react';
import { Badge, Card, Input, Resource } from '../../components/ui';
import { Banner, Screen, StatusBadge, guarded } from '../../components/timeoffice/parts';
import { A, normalizeHref, titleCase, today } from '../../lib/timeOfficeApi';
import { useResource } from '../../lib/hooks';

/** Conditions that must be clear before payroll can rely on the period. Each is derived from a listed section. */
const BLOCKERS = ['processing_health', 'missing_punches', 'pending_regularizations', 'overtime_awaiting_approval', 'unscheduled_today', 'device_sync'];
const HIDDEN = new Set(['employee_uuid', 'uuid', 'name', 'employee_number', 'device_uuid']);

const unfinalizedCount = (u) => (u == null ? 0 : typeof u === 'number' ? u : Array.isArray(u) ? u.length : (u.count ?? u.days ?? 0));

export function readiness(sections = {}) {
  const known = Object.keys(sections);
  const items = BLOCKERS.filter((k) => sections[k]).map((k) => ({ key: k, title: sections[k].title, count: sections[k].count, href: normalizeHref(sections[k].action?.href) }));
  const cutoff = sections.attendance_locks?.payroll_cutoff;
  const open = unfinalizedCount(cutoff?.unfinalized);
  if (open > 0) items.push({ key: 'unfinalized', title: 'Days not yet finalized for the payroll period', count: open, href: '/time-office/locks' });
  const blockers = items.filter((i) => i.count > 0);
  return { known: known.length > 0, ready: known.length > 0 && blockers.length === 0, blockers, checked: items.length };
}

function Sample({ item }) {
  const extras = Object.entries(item).filter(([k, v]) => !HIDDEN.has(k) && v != null && typeof v !== 'object');
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5 text-xs">
      <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">
        {item.name ?? item.employee_number ?? '—'}
        {item.employee_number && item.name ? <span className="ml-1 font-normal text-slate-400">#{item.employee_number}</span> : null}
      </span>
      <span className="text-slate-500 dark:text-slate-400">{extras.map(([k, v]) => `${titleCase(k)} ${v}`).join(' · ')}</span>
    </li>
  );
}

function SectionCard({ id, section }) {
  const href = normalizeHref(section.action?.href);
  const samples = section.sample ?? [];
  const runs = section.recent_runs;
  return (
    <Card className="flex flex-col" title={section.title}>
      <div className="flex flex-1 flex-col px-6 pb-5" data-testid={`section-${id}`}>
        <div className="mb-2 flex items-center gap-2">
          <strong className="text-3xl font-semibold text-brand-800 dark:text-brand-200" aria-label={`${section.title}: ${section.count}`}>
            {section.count}
          </strong>
          {section.unit && <span className="text-xs text-slate-500">{section.unit}</span>}
          {section.count === 0 && <Badge tone="green">Clear</Badge>}
        </div>
        {section.error && <p className="m-0 mb-2 text-xs text-rose-700 dark:text-rose-300" role="alert">This section could not be loaded: {section.error}</p>}
        {section.rule && <p className="m-0 mb-2 text-[11px] text-slate-500">{section.rule}</p>}
        {section.by_date && (
          <ul className="m-0 mb-2 list-none p-0 text-xs text-slate-600 dark:text-slate-300">
            {Object.entries(section.by_date).map(([d, n]) => (
              <li key={d} className="flex justify-between"><span>{d}</span><span>{n}</span></li>
            ))}
          </ul>
        )}
        {runs?.length > 0 && (
          <ul className="m-0 mb-2 list-none p-0 text-xs">
            {runs.slice(0, 3).map((r) => (
              <li key={r.uuid} className="flex items-center justify-between gap-2 py-1">
                <span className="capitalize">{r.trigger} · {r.processed_days}/{r.total_days} days</span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
        {samples.length > 0 && (
          <ul className="m-0 mb-3 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800" aria-label={`${section.title} samples`}>
            {samples.slice(0, 5).map((s, i) => (
              <Sample key={s.uuid ?? s.employee_uuid ?? s.device_uuid ?? i} item={s} />
            ))}
            {samples.length > 5 && <li className="py-1 text-[11px] text-slate-500">Showing 5 of {section.count}</li>}
          </ul>
        )}
        <div className="mt-auto pt-2">
          <Link to={href} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
            {section.action?.label ?? 'Open'} <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </Card>
  );
}

export function PayrollReadiness({ sections }) {
  const r = readiness(sections);
  if (!r.known) return null;
  return r.ready ? (
    <Banner tone="success" title="Payroll readiness: ready">
      None of the {r.checked} checked conditions has unresolved items for this date.
    </Banner>
  ) : (
    <Banner tone="warn" title={`Payroll readiness: not ready (${r.blockers.length} unresolved)`}>
      <ul className="m-0 mt-1 list-none p-0">
        {r.blockers.map((b) => (
          <li key={b.key} className="flex items-center gap-1 py-0.5">
            <CircleAlert size={12} />
            <Link to={b.href} className="underline">
              {b.title}: {b.count}
            </Link>
          </li>
        ))}
      </ul>
    </Banner>
  );
}

function CommandCenterPage() {
  const [date, setDate] = useState(today());
  const resource = useResource(`${A}/command-center?date=${date}`);
  return (
    <Screen
      title="Time office command center"
      description="What needs attention today, with a direct link to fix each item."
      permission="attendance.manage|attendance.process|attendance.reports.view"
      action={<Input label="Date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />}
    >
      <Resource resource={resource}>
        {(data) => {
          const sections = data?.sections ?? {};
          const entries = Object.entries(sections);
          if (!entries.length)
            return <Banner tone="info" title="Nothing to show">No operational sections are available for your access on {date}.</Banner>;
          return (
            <>
              <PayrollReadiness sections={sections} />
              <p className="mb-4 flex items-center gap-1 text-xs text-slate-500">
                <CheckCircle2 size={12} /> {data.employees_in_view ?? 0} employees in view
              </p>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {entries.map(([id, s]) => (
                  <SectionCard key={id} id={id} section={s} />
                ))}
              </div>
            </>
          );
        }}
      </Resource>
    </Screen>
  );
}

export default guarded(CommandCenterPage, { title: 'Time office command center', permission: 'attendance.manage|attendance.process|attendance.reports.view' });
