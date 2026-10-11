import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
vi.mock('../../../lib/auth', () => ({ useAuth: () => ({ can: () => true, enabled: () => true }) }));
import { api } from '../../../lib/api';
import { mockApi } from './helpers';
import CommandCenter, { readiness } from '../CommandCenter';

afterEach(cleanup);
beforeEach(() => {
  api.mockReset();
});
const section = (title, count, extra = {}) => ({
  title,
  count,
  sample: [],
  action: { label: `Open ${title}`, href: '/attendance/time-office/approvals?kind=overtime' },
  ...extra,
});
const show = () => render(<MemoryRouter><CommandCenter /></MemoryRouter>);

describe('CommandCenter', () => {
  it('shows each section with count, samples and a deep link, and a not-ready payroll indicator', async () => {
    mockApi(api, {
      'command-center': {
        date: '2026-10-09',
        employees_in_view: 12,
        sections: {
          missing_punches: section('Missing punches', 2, {
            sample: [{ employee_uuid: 'e1', name: 'Asha Rao', employee_number: 'E-1', date: '2026-10-09' }],
            action: { label: 'Resolve missing punches', href: '/attendance/time-office/missing-punches?date=2026-10-09' },
          }),
          overtime_awaiting_approval: section('Overtime awaiting approval', 0),
          processing_health: section('Attendance processing health', 0, { recent_runs: [] }),
        },
      },
    });
    show();
    const card = await screen.findByTestId('section-missing_punches');
    expect(within(card).getByLabelText('Missing punches: 2')).toBeInTheDocument();
    expect(within(card).getByText(/Asha Rao/)).toBeInTheDocument();
    const link = within(card).getByRole('link', { name: /Resolve missing punches/ });
    expect(link.getAttribute('href')).toMatch(/^\/time-office\/exceptions\?/);
    expect(link.getAttribute('href')).toContain('type=missing_in');
    expect(screen.getByText(/Payroll readiness: not ready \(1 unresolved\)/)).toBeInTheDocument();
    expect(within(screen.getByTestId('section-overtime_awaiting_approval')).getByText('Clear')).toBeInTheDocument();
    expect(screen.getByText('12 employees in view')).toBeInTheDocument();
  });

  it('reports ready when every checked condition is clear', async () => {
    mockApi(api, { 'command-center': { date: 'x', sections: { missing_punches: section('Missing punches', 0), device_sync: section('Devices not synced', 0) } } });
    show();
    expect(await screen.findByText('Payroll readiness: ready')).toBeInTheDocument();
  });

  it('derives readiness from unfinalized payroll-cutoff days too', () => {
    const r = readiness({
      missing_punches: section('Missing', 0),
      attendance_locks: section('Locks', 1, { payroll_cutoff: { configured: true, unfinalized: 4 } }),
    });
    expect(r.ready).toBe(false);
    expect(r.blockers.map((b) => b.key)).toEqual(['unfinalized']);
  });

  it('shows the error state with retry when the request fails', async () => {
    mockApi(api, { 'command-center': Object.assign(new Error('Server unavailable'), { status: 500 }) });
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows a skeleton while loading and an empty message without sections', async () => {
    mockApi(api, { 'command-center': { date: 'x', sections: {} } });
    show();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Nothing to show')).toBeInTheDocument());
  });
});
