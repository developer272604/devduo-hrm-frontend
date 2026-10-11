import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import PunchPage from './PunchPage';
import TeamAttendance from './TeamAttendance';
import MonthCalendar from '../../components/attendance/MonthCalendar';
import CalendarSection from '../../components/attendance/CalendarSection';
import RequestSection from '../../components/attendance/RequestSection';
import { requestConfigs, validateRegularization } from '../../components/attendance/requestConfigs';

vi.mock('../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
vi.mock('../../lib/auth', () => ({ useAuth: () => ({ can: () => true, enabled: () => true }) }));

const wrap = (ui) =>
  render(
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>,
  );
beforeEach(() => {
  api.mockReset();
});
afterEach(cleanup);

const status = (over = {}) => ({
  data: {
    status: 'none',
    next_direction: 'IN',
    punch_enabled: true,
    server_time: '2026-10-09T04:00:00Z',
    timezone: 'UTC',
    worked_minutes_so_far: 0,
    expected_end: null,
    schedule: {
      kind: 'working',
      shift: 'GEN',
      start: '2026-10-09T04:30:00Z',
      end: '2026-10-09T13:00:00Z',
    },
    last_punch: null,
    location: { required: false },
    ...over,
  },
});

describe('PunchPage', () => {
  it('punches once even on double click, using an idempotency key', async () => {
    let resolve;
    api.mockImplementation((path) => {
      if (path.endsWith('/me/status')) return Promise.resolve(status());
      return new Promise((r) => (resolve = () => r({ message: 'Checked in at 09:00.' })));
    });
    wrap(<PunchPage />);
    const btn = await screen.findByRole('button', { name: 'Check in' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    const posts = api.mock.calls.filter(([, o]) => o?.method === 'POST');
    await waitFor(() => expect(resolve).toBeTypeOf('function'));
    expect(posts).toHaveLength(1);
    expect(posts[0][1].body).toMatchObject({
      direction: 'IN',
      idempotency_key: expect.any(String),
    });
    expect(posts[0][1].body.latitude).toBeUndefined();
    resolve();
    expect(await screen.findByText('Checked in at 09:00.')).toBeInTheDocument();
  });

  it('requires consent before location is requested', async () => {
    api.mockResolvedValue(
      status({
        location: {
          required: true,
          purpose: 'Confirm you are on site.',
          privacy_note: 'Never tracked.',
        },
      }),
    );
    wrap(<PunchPage />);
    expect(await screen.findByText(/Confirm you are on site\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check in' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Check in' })).toBeEnabled();
  });

  it('shows a locked-day server error', async () => {
    api.mockImplementation((path) =>
      path.endsWith('/me/status')
        ? Promise.resolve(status())
        : Promise.reject(new ApiError('Attendance for 2026-10-09 is locked', 423)),
    );
    wrap(<PunchPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Check in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('locked');
  });

  it('pauses when offline', async () => {
    api.mockResolvedValue(status());
    wrap(<PunchPage />);
    await screen.findByRole('button', { name: 'Check in' });
    fireEvent(window, new Event('offline'));
    expect(await screen.findByText(/You are offline/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check in' })).toBeDisabled();
  });
});

describe('Calendar and day drawer', () => {
  const days = [
    {
      uuid: 'd1',
      attendance_date: '2026-10-05',
      status: 'present',
      net_minutes: 480,
      required_minutes: 480,
      late_minutes: 0,
      overtime_minutes: 0,
    },
    {
      uuid: 'd2',
      attendance_date: '2026-10-06',
      status: 'missing_punch',
      net_minutes: 0,
      required_minutes: 480,
      late_minutes: 0,
      overtime_minutes: 0,
    },
  ];
  it('renders statuses accessibly and reports selection', () => {
    const onSelect = vi.fn();
    render(
      <MonthCalendar month="2026-10" days={days} onSelect={onSelect} onMonthChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole('gridcell', { name: /Missing punch/ }));
    expect(onSelect).toHaveBeenCalledWith(days[1]);
    expect(screen.getByRole('gridcell', { name: /Present/ })).toBeInTheDocument();
  });

  it('opens the explanation drawer, tolerating a punch load failure', async () => {
    api.mockImplementation((path) => {
      if (path.includes('/days?')) return Promise.resolve({ data: days, last_page: 1 });
      if (path.includes('/days/d2'))
        return Promise.resolve({
          ...days[1],
          explanation: {
            headline: 'Marked missing punch',
            lines: [{ label: 'Pairs', value: 'One in, no out' }],
            facts: [],
            actions: ['Request regularization'],
          },
        });
      return Promise.reject(new ApiError('Punches unavailable', 500));
    });
    wrap(<CalendarSection employee="e1" today="2026-10-09" />);
    fireEvent.click(await screen.findByRole('gridcell', { name: /Missing punch/ }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Marked missing punch')).toBeInTheDocument();
    expect(within(dialog).getByText('One in, no out')).toBeInTheDocument();
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Punches unavailable');
    expect(within(dialog).getByText('Why is this attendance marked this way?')).toBeInTheDocument();
  });
});

describe('Regularization', () => {
  it('validates pure rules', () => {
    expect(
      validateRegularization(
        { date: '2099-01-01', type: '', requested_in: '', requested_out: '', reason: '' },
        '2026-10-09',
      ),
    ).toMatchObject({
      date: expect.stringMatching(/future/),
      type: expect.any(String),
      requested_in: expect.any(String),
      reason: expect.any(String),
    });
    expect(
      validateRegularization(
        {
          date: '2026-10-01',
          type: 'forgot_out',
          requested_in: '09:00',
          requested_out: '',
          reason: 'x',
        },
        '2026-10-09',
      ),
    ).toEqual({ requested_out: expect.any(String) });
  });

  it('blocks an invalid submit, then submits with an idempotency key', async () => {
    api.mockImplementation((path, opts) =>
      opts?.method === 'POST' ? Promise.resolve({ data: {} }) : Promise.resolve({ data: [] }),
    );
    wrap(<RequestSection kind="regularization" />);
    fireEvent.click(await screen.findByRole('button', { name: 'New request' }));
    const form = await screen.findByRole('form', { name: /New regularization/ });
    fireEvent.click(within(form).getByRole('button', { name: 'Submit request' }));
    expect((await within(form).findAllByRole('alert')).length).toBeGreaterThan(0);
    expect(api.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false);

    fireEvent.change(within(form).getByLabelText('Attendance date'), {
      target: { value: '2026-10-01' },
    });
    fireEvent.click(within(form).getByRole('combobox', { name: /What happened/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Forgot check-in' }));
    fireEvent.change(within(form).getByLabelText('In time'), { target: { value: '09:00' } });
    fireEvent.change(within(form).getByLabelText('Reason'), {
      target: { value: 'Badge reader down' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Submit request' }));
    await waitFor(() => expect(api.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(true));
    const post = api.mock.calls.find(([, o]) => o?.method === 'POST');
    expect(post[0]).toBe('/v1/attendance/regularizations');
    expect(post[1].body).toMatchObject({
      date: '2026-10-01',
      type: 'forgot_in',
      requested_in: '09:00',
      idempotency_key: expect.any(String),
    });
  });
});

describe('Shift swaps', () => {
  it('submits the colleague shift date separately from the requester date', async () => {
    api.mockImplementation((path, opts = {}) => {
      if (opts.method === 'POST') return Promise.resolve({ data: { uuid: 'swap-1' } });
      if (path.startsWith('/v1/directory'))
        return Promise.resolve({ data: [{ uuid: 'ben', display_name: 'Ben Lee' }] });
      return Promise.resolve({ data: [] });
    });
    wrap(<RequestSection kind="swaps" />);
    fireEvent.click(await screen.findByRole('button', { name: 'New request' }));
    const form = await screen.findByRole('form', { name: /New shift swap request/ });
    fireEvent.change(within(form).getByLabelText('Date of your shift'), {
      target: { value: '2026-11-09' },
    });
    fireEvent.change(within(form).getByLabelText('Colleague shift date'), {
      target: { value: '2026-11-10' },
    });
    fireEvent.change(within(form).getByLabelText('Search colleagues'), {
      target: { value: 'Ben' },
    });
    fireEvent.click(within(form).getAllByRole('combobox')[1]);
    fireEvent.click(await screen.findByRole('option', { name: 'Ben Lee' }));
    fireEvent.change(within(form).getByLabelText('Reason'), { target: { value: 'Family event' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Submit request' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        '/v1/shift-swaps',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            work_date: '2026-11-09',
            counterpart_date: '2026-11-10',
            counterpart_uuid: 'ben',
          }),
        }),
      ),
    );
    expect(
      requestConfigs.swaps.fields.some(
        (field) => field.name === 'counterpart_date' && field.showIf({ type: 'swap' }),
      ),
    ).toBe(true);
  });
});

describe('TeamAttendance', () => {
  const team = {
    date: '2026-10-09',
    team_size: 2,
    groups: {
      in: {
        count: 1,
        employees: [
          {
            employee_uuid: 'a',
            name: 'Asha Rao',
            employee_number: 'E1',
            status: 'present',
            status_label: 'Present',
            first_in: '2026-10-09T04:00:00Z',
            last_out: null,
            late_minutes: 0,
          },
        ],
      },
      absent: { count: 0, employees: [] },
      pending_regularizations: {
        count: 2,
        requests: [
          { uuid: 'r1', name: 'Ben Roy', date: '2026-10-08', type: 'forgot_out' },
          { uuid: 'r2', name: 'Cy Lee', date: '2026-10-07', type: 'wrong_punch' },
        ],
      },
    },
  };
  it('lists who is in, with an empty state per group', async () => {
    api.mockResolvedValue(team);
    wrap(<TeamAttendance />);
    expect((await screen.findAllByText('Asha Rao')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: /Absent/ }));
    expect(screen.getByText(/No one in/)).toBeInTheDocument();
  });

  it('approves inline and keeps other rows when one fails', async () => {
    api.mockImplementation((path, opts) => {
      if (opts?.method === 'POST')
        return path.includes('r1')
          ? Promise.reject(new ApiError('Not your approval', 403))
          : Promise.resolve({});
      return Promise.resolve(team);
    });
    wrap(<TeamAttendance />);
    fireEvent.click(await screen.findByRole('tab', { name: /Pending requests/ }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Approve Ben Roy' })[0]);
    expect(await screen.findByText('Not your approval')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Approve Cy Lee' }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Approve Cy Lee' })[0]);
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        '/v1/attendance/regularizations/r2/approve',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });
});
