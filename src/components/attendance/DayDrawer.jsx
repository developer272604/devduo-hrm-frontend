import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Drawer, Skeleton, ErrorState } from '../ui';
import { dayDetail, dayPunches, fmtMinutes, punchesToTimeline } from '../../lib/attendanceApi';
import StatusBadge from './StatusBadge';
import ExplanationPanel from './ExplanationPanel';
import ReconstructionTimeline from './ReconstructionTimeline';

/** Detail drawer for one attendance day: explanation + punches considered + reconstruction. Punch failure is partial, not fatal. */
export default function DayDrawer({ day, onClose, own = true }) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    if (!day) return undefined;
    let live = true;
    setState({ loading: true });
    const date = day.attendance_date.slice(0, 10);
    Promise.allSettled([dayDetail(day.uuid), own ? dayPunches(date) : Promise.resolve(null)]).then(
      ([d, p]) => {
        if (live)
          setState({
            loading: false,
            detail: d.status === 'fulfilled' ? d.value : null,
            error: d.status === 'rejected' ? d.reason : null,
            punches: p.status === 'fulfilled' ? p.value?.data : null,
            punchError: p.status === 'rejected' ? p.reason : null,
          });
      },
    );
    return () => {
      live = false;
    };
  }, [day, own]);
  const detail = state.detail || day;
  const canRegularize = day && ['missing_punch', 'incomplete', 'absent', 'half_day'].includes(day.status);
  return (
    <Drawer open={!!day} onClose={onClose} title={day ? `Attendance for ${day.attendance_date.slice(0, 10)}` : 'Attendance'}>
      {state.loading ? (
        <Skeleton rows={3} />
      ) : state.error ? (
        <ErrorState error={state.error} />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={detail.status} />
            {detail.finalization && detail.finalization !== 'open' && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {detail.finalization === 'locked' ? 'Locked for changes' : detail.finalization.replaceAll('_', ' ')}
              </span>
            )}
          </div>
          <dl className="m-0 grid grid-cols-2 gap-3 text-sm">
            {[
              ['Worked', fmtMinutes(detail.net_minutes)],
              ['Required', fmtMinutes(detail.required_minutes)],
              ['Late', fmtMinutes(detail.late_minutes)],
              ['Overtime', fmtMinutes(detail.overtime_minutes)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-slate-500 dark:text-slate-400">{k}</dt>
                <dd className="m-0">{v}</dd>
              </div>
            ))}
          </dl>
          <ExplanationPanel explanation={state.detail?.explanation} />
          {state.punchError ? (
            <p role="alert" className="m-0 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              The punches for this day could not be loaded ({state.punchError.message}). The explanation above is still accurate.
            </p>
          ) : state.punches ? (
            <ReconstructionTimeline items={punchesToTimeline(state.punches)} />
          ) : null}
          {own && canRegularize && (
            <Link
              className="inline-flex min-h-10 items-center rounded-lg bg-brand-500 px-4 text-xs font-semibold text-white hover:bg-brand-600"
              to={`/attendance?tab=regularization&date=${day.attendance_date.slice(0, 10)}`}
              onClick={onClose}
            >
              Request regularization
            </Link>
          )}
        </div>
      )}
    </Drawer>
  );
}
