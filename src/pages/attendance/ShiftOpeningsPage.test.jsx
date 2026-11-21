import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/ui';
import { api } from '../../lib/api';
import ShiftOpeningsPage, { RosterOpenShifts } from './ShiftOpeningsPage';

vi.mock('../../lib/api', async (load) => ({ ...(await load()), api: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const opening = { uuid: 'shift1', status: 'open', work_date: '2026-11-24', shift: 'Day shift' };

it('submits an employee bid and updates the application status', async () => {
  let applied = false;
  api.mockImplementation(async (_path, options) => {
    if (options?.method === 'POST') {
      applied = options.body.apply;
      return null;
    }
    return { data: [{ ...opening, bid_at: applied ? '2026-11-21' : null }], last_page: 1 };
  });
  render(<ShiftOpeningsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Apply for shift' }));
  expect(await screen.findByRole('button', { name: 'Withdraw bid' })).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith('/v1/shift-openings/shift1/bid', {
    method: 'POST',
    body: { apply: true },
  });
});

it('awards an application and refreshes the roster draft', async () => {
  const onRosterChanged = vi.fn();
  api.mockImplementation(async (path, options) => {
    if (options?.method === 'POST') return null;
    if (path.includes('/bids'))
      return { data: [{ uuid: 'emp1', name: 'Asha Rao', bid_at: '2026-11-21' }], last_page: 1 };
    return { data: [opening], last_page: 1 };
  });
  render(
    <ToastProvider>
      <RosterOpenShifts
        roster={{ uuid: 'r1' }}
        shiftOptions={[]}
        onRosterChanged={onRosterChanged}
      />
    </ToastProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'View applications' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Award shift' }));
  fireEvent.click(screen.getByRole('dialog').querySelector('button[type="submit"]'));
  expect(await screen.findByText('Shift awarded. Roster draft updated.')).toBeInTheDocument();
  expect(onRosterChanged).toHaveBeenCalledOnce();
  expect(api).toHaveBeenCalledWith('/v1/shift-openings/shift1/decision', {
    method: 'POST',
    body: { action: 'award', employee_uuid: 'emp1' },
  });
});
