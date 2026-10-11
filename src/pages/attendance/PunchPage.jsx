import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, MapPin, WifiOff } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { useResource } from '../../lib/hooks';
import { fmtMinutes, fmtTime, newKey, punchStatus, sendPunch } from '../../lib/attendanceApi';
import { Button, Card, Checkbox, ErrorState, PageHeader, Skeleton } from '../../components/ui';

/** Server clock: offset from the server_time in the status payload, so the device clock is never trusted or shown. */
function useServerClock(serverTime, timeZone) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    if (!serverTime) return undefined;
    const offset = Date.parse(serverTime) - Date.now();
    const tick = () => setNow(new Date(Date.now() + offset));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [serverTime]);
  return now
    ? {
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone }),
        date: now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', timeZone }),
      }
    : null;
}

const getPosition = () =>
  new Promise((resolve, reject) => {
    const fail = (m) => reject(Object.assign(new Error(m), { location: true }));
    if (!navigator.geolocation) return fail('This device cannot share its location.');
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) =>
        fail(
          e.code === 1
            ? 'Location permission was denied. Allow location for this site in your browser settings and try again.'
            : 'We could not read your location. Move to an open area and try again.',
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });

function Fact({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="m-0 text-sm font-medium">{children}</dd>
    </div>
  );
}

export default function PunchPage() {
  const resource = useResource('/v1/attendance/me/status');
  const status = resource.data?.data;
  const clock = useServerClock(status?.server_time, status?.timezone);
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState(null); // {ok, message}
  const inflight = useRef(false);
  const key = useRef(null); // reused only while an attempt has no definite server answer
  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const submit = useCallback(async () => {
    if (inflight.current || !status) return; // duplicate-click protection
    inflight.current = true;
    setBusy(true);
    setResult(null);
    try {
      let position;
      if (status.location?.required) position = await getPosition();
      key.current ??= newKey();
      const res = await sendPunch({ direction: status.next_direction, key: key.current, position });
      key.current = null;
      setResult({ ok: true, message: res.message || 'Attendance recorded.' });
      resource.reload();
    } catch (e) {
      if (e instanceof ApiError) key.current = null;
      const api = e instanceof ApiError;
      const network = !api && !e.location;
      setResult({
        ok: false,
        network,
        message: api
          ? e.status === 423
            ? `This day is locked. ${e.message}`
            : e.message
          : network
            ? 'We could not reach the server.'
            : e.message,
      });
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }, [status, resource]);

  if (resource.loading && !status)
    return (
      <>
        <PageHeader title="Check in" description="Record your attendance." />
        <Skeleton rows={3} />
      </>
    );
  if (resource.error)
    return (
      <>
        <PageHeader title="Check in" description="Record your attendance." />
        <ErrorState error={resource.error} onRetry={resource.reload} />
      </>
    );

  const checkedIn = status.status === 'IN';
  const loc = status.location || {};
  const locationBlocked = loc.required && !consent;
  const disabled = busy || !online || !status.punch_enabled || locationBlocked;
  const sched = status.schedule;
  const shiftLine = sched
    ? sched.kind === 'working' || sched.shift
      ? `${sched.shift || 'Shift'} · ${fmtTime(sched.start, status.timezone)} – ${fmtTime(sched.end, status.timezone)}`
      : sched.holiday || String(sched.kind || 'No shift').replaceAll('_', ' ')
    : 'No shift information available';
  const last = status.last_punch;
  return (
    <>
      <PageHeader title="Check in" description="Record your attendance. Times come from the server." />
      <div className="mx-auto max-w-lg space-y-4">
        {!online && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <WifiOff size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>You are offline. Punching is paused because attendance can only be recorded by the server. Reconnect and try again.</span>
          </div>
        )}
        {status.missing_checkout && (
          <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Your last check-in was never closed. Checking in now starts a new session.{' '}
            <Link className="font-semibold underline" to="/attendance?tab=regularization">Request a regularization</Link> to fix yesterday.
          </div>
        )}
        <Card>
          <div className="space-y-5 p-5 text-center sm:p-8">
            <div>
              <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
                Server time · {status.timezone}
              </p>
              <p className="m-0 text-4xl font-semibold tabular-nums" aria-label="Server time">
                {clock?.time ?? '—'}
              </p>
              <p className="m-0 text-xs text-slate-500 dark:text-slate-400">{clock?.date}</p>
            </div>
            <p className="m-0 text-sm" role="status">
              {checkedIn ? 'You are checked in.' : status.status === 'OUT' ? 'You are checked out.' : 'You have not checked in yet.'}
            </p>

            {loc.required && (
              <div className="rounded-lg border border-slate-200 p-3 text-left text-xs dark:border-slate-700">
                <p className="m-0 mb-1 flex items-center gap-1.5 font-semibold">
                  <MapPin size={14} aria-hidden="true" /> Location is required
                </p>
                <p className="m-0 mb-2 text-slate-600 dark:text-slate-300">
                  {loc.purpose || 'Your employer needs your location to confirm where you are working.'} {loc.privacy_note}
                </p>
                <Checkbox
                  label="I agree to share my location for this check-in only"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
              </div>
            )}

            <Button
              className="w-full min-h-14 text-base"
              disabled={disabled}
              loading={busy}
              onClick={submit}
              aria-label={checkedIn ? 'Check out' : 'Check in'}
            >
              {busy ? 'Recording…' : checkedIn ? 'Check out' : 'Check in'}
            </Button>
            {!status.punch_enabled && (
              <p className="m-0 text-xs text-slate-500 dark:text-slate-400" role="note">
                Web check-in is turned off for your workspace. Use your assigned device or ask the time office.
              </p>
            )}
            {result && (
              <div
                role={result.ok ? 'status' : 'alert'}
                className={`flex items-start gap-2 rounded-lg border p-3 text-left text-sm ${result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200'}`}
              >
                {result.ok && <CheckCircle2 size={18} aria-hidden="true" className="mt-0.5 shrink-0" />}
                <span>
                  {result.message}
                  {result.network && ' Your punch may or may not have been saved. Tap again: it will not be recorded twice.'}
                </span>
              </div>
            )}
          </div>
        </Card>

        <Card title="Today">
          <dl className="m-0 grid grid-cols-2 gap-4 px-6 pb-6">
            <Fact label="Shift">{shiftLine}</Fact>
            <Fact label="Worked so far">{fmtMinutes(status.worked_minutes_so_far)}</Fact>
            <Fact label="Expected end">{status.expected_end ? fmtTime(status.expected_end, status.timezone) : '—'}</Fact>
            <Fact label="Last punch">
              {last ? `${last.direction === 'IN' ? 'In' : 'Out'} at ${(last.local_time || '').slice(11, 16)}` : 'None yet'}
            </Fact>
          </dl>
          <p className="m-0 border-t border-slate-100 px-6 py-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {status.worked_minutes_note}
          </p>
        </Card>
        <p className="text-center text-xs">
          <Link className="text-brand-700 underline dark:text-brand-300" to="/attendance">View my attendance</Link>
        </p>
      </div>
    </>
  );
}
