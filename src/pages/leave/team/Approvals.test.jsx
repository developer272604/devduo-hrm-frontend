import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../../components/ui';
import { api, ApiError } from '../../../lib/api';
import Approvals from './Approvals';
import TeamLeave from './TeamLeave';

vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
vi.mock('../../../lib/auth', () => ({ useAuth: () => ({ can: () => true, enabled: () => true, session: { user: { name: 'Mira' } } }) }));

beforeEach(() => {
  api.mockReset();
});
afterEach(cleanup);
const wrap = (ui) =>
  render(
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>,
  );

const row = {
  uuid: 'r1',
  employee: { uuid: 'e1', name: 'Ravi Kumar' },
  type: { uuid: 't1', name: 'Annual leave' },
  status: 'pending',
  start_date: '2026-10-15',
  end_date: '2026-10-16',
  charged_units: '2.0000',
  unit: 'half_day',
  conflicts: [{ kind: 'staffing', severity: 'warning', message: 'Two teammates are already away on 2026-10-15.' }],
};
const detail = (over = {}) => ({
  data: {
    ...row,
    projected_balance: '5.0000',
    requested_units: '2.0000',
    reason: 'Family wedding',
    can_decide: true,
    history: [{ action: 'submitted', actor: { name: 'Ravi Kumar' }, at: '2026-10-10T09:00:00Z' }],
    segments: [],
    ...over,
  },
});

function mock({ approvals = { data: [row] }, det = detail(), decide } = {}) {
  api.mockImplementation((path, opts = {}) => {
    if (path === '/v1/leave/approvals') return approvals instanceof Promise ? approvals : Promise.resolve(approvals);
    if (path === '/v1/leave/requests/r1') return Promise.resolve(det);
    if (path.startsWith('/v1/leave/time-story')) return Promise.resolve({ events: [], total: 0, truncated: false });
    if (path.startsWith('/v1/leave/explain/requests')) return Promise.resolve({ sentence: 'Two working days.', segments: [] });
    if (opts.method === 'POST') return decide ? decide(path, opts) : Promise.resolve({ data: {} });
    return Promise.reject(new Error(`unexpected ${path}`));
  });
}
const decisions = () => api.mock.calls.filter(([, o]) => o?.method === 'POST');

describe('Approvals queue', () => {
  it('lists pending requests and opens the impact context', async () => {
    mock();
    wrap(<Approvals />);
    const table = await screen.findByRole('table', { name: 'Leave approvals' });
    expect(within(table).getByText('Ravi Kumar')).toBeInTheDocument();
    fireEvent.click(within(table).getByRole('button', { name: 'Review' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Two teammates are already away on 2026-10-15.')).toBeInTheDocument();
    expect(within(dialog).getByText('Family wedding')).toBeInTheDocument();
    expect(within(dialog).getByText('Balance after')).toBeInTheDocument();
  });

  it('requires a comment to reject, then posts it', async () => {
    mock();
    wrap(<Approvals />);
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Reject' }));
    const form = (await screen.findAllByRole('dialog')).at(-1);
    fireEvent.click(within(form).getByRole('button', { name: 'Reject request' }));
    expect(await within(form).findByText(/Give a reason/)).toBeInTheDocument();
    expect(decisions()).toHaveLength(0);
    fireEvent.change(within(form).getByLabelText(/Reason for rejecting/), { target: { value: 'Release freeze' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Reject request' }));
    await waitFor(() => expect(decisions()).toHaveLength(1));
    expect(decisions()[0][0]).toBe('/v1/leave/requests/r1/reject');
    expect(decisions()[0][1].body).toEqual({ comment: 'Release freeze' });
  });

  it('approves with an optional comment', async () => {
    mock();
    wrap(<Approvals />);
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    const form = (await screen.findAllByRole('dialog')).at(-1);
    fireEvent.click(within(form).getByRole('button', { name: 'Approve request' }));
    await waitFor(() => expect(decisions()).toHaveLength(1));
    expect(decisions()[0][0]).toBe('/v1/leave/requests/r1/approve');
    expect(decisions()[0][1].body).toEqual({});
  });

  it('shows a refused decision (409) without closing the dialog', async () => {
    mock({ decide: () => Promise.reject(new ApiError('Already decided.', 409)) });
    wrap(<Approvals />);
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    const form = (await screen.findAllByRole('dialog')).at(-1);
    fireEvent.click(within(form).getByRole('button', { name: 'Approve request' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Already decided.');
  });

  it('respects medical privacy: no reason, no type, no explain action', async () => {
    mock({
      approvals: { data: [{ ...row, type: { name: 'Leave', sensitive: true } }] },
      det: detail({ type: { name: 'Leave', sensitive: true }, reason: null, reason_hidden: true }),
    });
    wrap(<Approvals />);
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/confidential leave/)).toBeInTheDocument();
    expect(within(dialog).queryByText('Family wedding')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Explain this charge/ })).not.toBeInTheDocument();
  });

  it('has empty, loading and 403 states', async () => {
    mock({ approvals: { data: [] } });
    wrap(<Approvals />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(await screen.findByText('Nothing waiting for you')).toBeInTheDocument();
    cleanup();
    mock({ approvals: Promise.reject(new ApiError('Forbidden', 403)) });
    wrap(<Approvals />);
    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });
});

describe('Team leave', () => {
  it('shows availability and who is away for the chosen day', async () => {
    api.mockImplementation((path) => {
      if (path.startsWith('/v1/leave/team/calendar'))
        return Promise.resolve({ data: [{ request: { uuid: 'r1' }, employee: { name: 'Ravi Kumar' }, type: { name: 'Annual leave' }, status: 'approved', dates: [new Date().toLocaleDateString('en-CA')] }] });
      if (path.startsWith('/v1/leave/team/availability'))
        return Promise.resolve({ headcount: 8, away: 2, available: 6, available_percent: 75, away_list: [{ employee: { name: 'Ravi Kumar' }, type: { name: 'Annual leave' } }], holidays: [] });
      return Promise.reject(new Error(`unexpected ${path}`));
    });
    wrap(<TeamLeave />);
    const list = await screen.findByRole('list', { name: 'People away' });
    expect(within(list).getByText('Ravi Kumar')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });
});
