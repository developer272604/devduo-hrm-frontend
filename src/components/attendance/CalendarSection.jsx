import { useEffect, useState } from 'react';
import { Card, Skeleton, ErrorState } from '../ui';
import { monthDays } from '../../lib/attendanceApi';
import MonthCalendar from './MonthCalendar';
import DayDrawer from './DayDrawer';

/** Month grid + day drawer for the signed-in employee. */
export default function CalendarSection({ employee, today }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [state, setState] = useState({ loading: true, rows: [], error: null });
  const [selected, setSelected] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    monthDays(employee, month, c.signal)
      .then((rows) => setState({ loading: false, rows, error: null }))
      .catch((error) => error.name !== 'AbortError' && setState({ loading: false, rows: [], error }));
    return () => c.abort();
  }, [employee, month, reload]);
  return (
    <Card>
      <div className="p-4 sm:p-6">
        {state.error ? (
          <ErrorState error={state.error} onRetry={() => setReload((v) => v + 1)} />
        ) : (
          <>
            {state.loading && <Skeleton rows={1} />}
            <div className={state.loading ? 'hidden' : ''}>
              <MonthCalendar month={month} days={state.rows} today={today} onMonthChange={setMonth} onSelect={setSelected} />
              {state.rows.length === 0 && !state.loading && (
                <p className="mb-0 mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  No attendance has been processed for this month yet.
                </p>
              )}
            </div>
          </>
        )}
      </div>
      <DayDrawer day={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}
