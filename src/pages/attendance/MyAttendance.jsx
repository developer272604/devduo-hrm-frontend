import { Link, useSearchParams } from 'react-router-dom';
import { useResource } from '../../lib/hooks';
import { PageHeader, EmptyState, Resource, Card, Tabs, Button } from '../../components/ui';
import { fmtMinutes } from '../../lib/attendanceApi';
import StatusBadge from '../../components/attendance/StatusBadge';
import CalendarSection from '../../components/attendance/CalendarSection';
import RequestSection from '../../components/attendance/RequestSection';
import ScheduleSection from '../../components/attendance/ScheduleSection';
import AttendanceHistory from './AttendanceHistory';

const TABS = [
  { value: 'today', label: 'Today' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'history', label: 'History' },
  { value: 'regularization', label: 'Regularization' },
  { value: 'overtime', label: 'Overtime' },
  { value: 'onduty', label: 'On duty / remote' },
  { value: 'schedule', label: 'Shift schedule' },
  { value: 'swaps', label: 'Shift swaps' },
];

function TodaySummary({ data }) {
  const t = data.today,
    pend = data.pending_requests || {},
    month = data.month;
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="space-y-2 p-5">
            <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
              {data.date} · {data.employee.timezone}
            </p>
            <h2 className="m-0 text-lg font-semibold">{t.shift?.name || 'No shift assigned'}</h2>
            <p className="m-0 text-sm">
              {t.shift ? `${t.shift.start_time} – ${t.shift.end_time}` : 'Contact your time office to review your schedule.'}
            </p>
            <StatusBadge status={t.status} label={t.status_label} />
          </div>
        </Card>
        <Card>
          <div className="space-y-2 p-5">
            <p className="m-0 text-xs text-slate-500 dark:text-slate-400">Recorded work today</p>
            <p className="m-0 text-3xl font-semibold">{fmtMinutes(t.worked_minutes_so_far)}</p>
            <p className="m-0 text-xs text-slate-500 dark:text-slate-400">{t.confidence?.meaning}</p>
            <Link
              to="/attendance/punch"
              className="inline-flex min-h-10 items-center rounded-lg bg-brand-500 px-4 text-xs font-semibold text-white hover:bg-brand-600"
            >
              {t.checked_in ? 'Go to check out' : 'Go to check in'}
            </Link>
          </div>
        </Card>
        <Card>
          <div className="space-y-2 p-5">
            <p className="m-0 text-xs text-slate-500 dark:text-slate-400">Needs attention</p>
            <p className="m-0 text-3xl font-semibold">{data.open_exceptions.count}</p>
            {data.open_exceptions.recent.map((issue) => (
              <p className="m-0 text-xs" key={issue.uuid}>
                {issue.date} · {issue.title}
              </p>
            ))}
            {data.open_exceptions.count === 0 && (
              <p className="m-0 text-xs text-slate-500 dark:text-slate-400">Nothing needs your attention.</p>
            )}
          </div>
        </Card>
      </div>
      <Card title="This month so far">
        <dl className="m-0 grid grid-cols-2 gap-4 px-6 pb-5 text-sm sm:grid-cols-4">
          {[
            ['Days recorded', month.days_recorded],
            ['Worked', fmtMinutes(month.worked_minutes)],
            ['Late arrivals', month.late_arrivals],
            ['Missing punches', month.missing_punches],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-slate-500 dark:text-slate-400">{k}</dt>
              <dd className="m-0 text-lg font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        {Object.values(pend).some(Boolean) && (
          <p className="m-0 border-t border-slate-100 px-6 py-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
            Waiting for approval: {pend.regularizations} regularization, {pend.overtime} overtime, {pend.on_duty} on duty, {pend.shift_swaps} shift swap
          </p>
        )}
      </Card>
    </div>
  );
}

export default function MyAttendance() {
  const resource = useResource('/v1/attendance/me');
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'today';
  const setTab = (value) => {
    const next = new URLSearchParams(params);
    next.set('tab', value);
    setParams(next, { replace: true });
  };
  return (
    <>
      <PageHeader
        title="My attendance"
        description="Your schedule, recorded time, and the explanation behind each day."
        action={
          <Link to="/attendance/punch">
            <Button>Check in / out</Button>
          </Link>
        }
      />
      <Resource resource={resource}>
        {(data) =>
          data.employee ? (
            <>
              <Card>
                <Tabs items={TABS} value={tab} onChange={setTab} />
                <div role="tabpanel" aria-label={TABS.find((t) => t.value === tab).label}>
                  {tab === 'today' && <TodaySummary data={data} />}
                  {tab === 'calendar' && (
                    <div className="p-4 sm:p-6">
                      <CalendarSection employee={data.employee.uuid} today={data.date} />
                    </div>
                  )}
                  {tab === 'history' && (
                    <div className="p-4 sm:p-6">
                      <AttendanceHistory employee={data.employee.uuid} />
                    </div>
                  )}
                  {['regularization', 'overtime', 'onduty', 'swaps'].includes(tab) && (
                    <div className="p-4 sm:p-6">
                      <RequestSection key={tab} kind={tab} />
                    </div>
                  )}
                  {tab === 'schedule' && (
                    <div className="p-4 sm:p-6">
                      <ScheduleSection today={data.date} />
                    </div>
                  )}
                </div>
              </Card>
            </>
          ) : (
            <EmptyState title="Employee profile not linked" description={data.message} />
          )
        }
      </Resource>
    </>
  );
}
