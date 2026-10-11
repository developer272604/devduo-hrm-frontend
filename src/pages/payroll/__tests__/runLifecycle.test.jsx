import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../../lib/auth', () => ({ useAuth: () => ({ can: () => true, enabled: () => true }) }));
vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn(), download: vi.fn() }));
import { api } from '../../../lib/api';
import RunDetailPage from '../RunDetailPage';
import { ToastProvider } from '../../../components/ui';
import { calls, mockApi } from './helpers';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function setup(initial = 'inputs') {
  const state = { status: initial };
  const move = (to) => () => {
    state.status = to;
    return { ok: true };
  };
  mockApi(api, {
    '/progress': () => ({ status: state.status, pass: 1, total: 2, done: 2, failed: 0, finished_at: 'now' }),
    '/calculate': move('review'),
    '/submit': move('approval'),
    '/approve': move('approved'),
    '/lock': move('locked'),
    '/totals': { stored: { employees: 2, currency: 'USD', gross: '10000.0000', net: '8600.0000', reconciled: true } },
    '/runs/r1': () => ({
      data: { uuid: 'r1', status: state.status, run_type: 'regular', period: { label: 'October 2026' }, validation: { blocking: 0 }, control_totals: { currency: 'USD', employee_count: 2, gross_total: '10000.0000', net_total: '8600.0000', failed_count: 0 } },
    }),
  });
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/payroll/runs/r1']}>
        <Routes>
          <Route path="/payroll/runs/:uuid" element={<RunDetailPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
  return state;
}
const dialogButton = (name) => within(screen.getByRole('dialog')).getByRole('button', { name });

describe('Payroll run lifecycle', () => {
  it('calculates with progress polling, then submits, approves and locks after a preview', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Calculate' }));
    await waitFor(() => expect(calls(api, '/calculate')).toHaveLength(1));
    expect(await screen.findByRole('button', { name: 'Submit for approval' })).toBeInTheDocument();
    expect(calls(api, '/progress', 'GET').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(calls(api, '/approve')).toHaveLength(0);
    fireEvent.click(dialogButton('Approve run'));
    await waitFor(() => expect(calls(api, '/approve')).toHaveLength(1));

    fireEvent.click(await screen.findByRole('button', { name: 'Lock run' }));
    expect(await screen.findByText('Preview (nothing has been changed yet)')).toBeInTheDocument();
    expect(calls(api, '/lock')).toHaveLength(0);
    expect(dialogButton('Lock run')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('I have reviewed the totals and want to lock this run'));
    fireEvent.click(dialogButton('Lock run'));
    await waitFor(() => expect(calls(api, '/lock')).toHaveLength(1));
    expect(await screen.findByRole('button', { name: 'Request reopen' })).toBeInTheDocument();
  });
  it('offers no calculation once the run is locked', async () => {
    setup('locked');
    await screen.findByRole('button', { name: 'Request reopen' });
    expect(screen.queryByRole('button', { name: 'Calculate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lock run' })).not.toBeInTheDocument();
  });
});
