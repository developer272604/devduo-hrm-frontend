import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let perms = [];
vi.mock('../../../../lib/auth', () => ({
  useAuth: () => ({ can: (p) => !p || p.split('|').some((k) => perms.includes(k)), enabled: () => true }),
}));
vi.mock('../../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
import { api } from '../../../../lib/api';
import { mockApi } from '../../../timeoffice/__tests__/helpers';
import LocksPage from '../LocksPage';
import { ToastProvider } from '../../../../components/ui';

afterEach(cleanup);
beforeEach(() => {
  api.mockReset();
});
const locked = { uuid: 'l1', scope_type: 'tenant', scope_label: 'Whole organisation', start_date: '2026-09-01', end_date: '2026-09-30', status: 'locked', reason: 'Payroll close', unlock_requested: false };
const requested = { ...locked, uuid: 'l2', start_date: '2026-08-01', end_date: '2026-08-31', unlock_requested: true, unlock_reason: 'Late correction' };
const preview = { data: { employees: 40, employee_days: 1200, unresolved: { pending_requests: 3, pending_adjustments: 1 }, requires_acknowledgement: true, conflicts: [], can_lock: true } };
const wrap = (ui) => render(<ToastProvider><MemoryRouter>{ui}</MemoryRouter></ToastProvider>);
const mount = (calls, rows = [locked]) => {
  mockApi(api, {
    '/locks/preview': (p, o) => (calls.push([p, o.body]), preview),
    '/locks/l1/unlock-request': (p, o) => (calls.push([p, o.body]), { data: {} }),
    '/locks/l2/unlock-approve': (p, o) => (calls.push([p, o.method]), { data: {} }),
    '/locks': (p, o) => (o.method === 'POST' ? (calls.push([p, o.body]), { data: locked }) : { data: rows }),
  });
  wrap(<LocksPage />);
};

describe('Leave locks', () => {
  it('previews impact, requires acknowledging unresolved items, then locks', async () => {
    perms = ['leave.lock'];
    const calls = [];
    mount(calls);
    await screen.findAllByText('Whole organisation');
    fireEvent.click(screen.getByRole('button', { name: /Lock a period/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Why is this period/ }), { target: { value: 'September close' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Preview impact' }));
    const ack = await screen.findByRole('checkbox', { name: /3 pending request\(s\) and 1 pending adjustment\(s\)/ });
    expect(calls.map((c) => c[0])).toEqual(['/v1/leave/locks/preview']);
    expect(calls[0][1]).not.toHaveProperty('reason');
    const confirm = screen.getByRole('button', { name: /Lock period/ });
    expect(confirm).toBeDisabled();
    fireEvent.click(ack);
    fireEvent.click(confirm);
    await waitFor(() => expect(calls.map((c) => c[0])).toEqual(['/v1/leave/locks/preview', '/v1/leave/locks']));
    expect(calls[1][1]).toMatchObject({ scope_type: 'tenant', reason: 'September close', acknowledge_unresolved: true });
  });

  it('requests an unlock with a reason', async () => {
    perms = ['leave.lock'];
    const calls = [];
    mount(calls);
    await screen.findAllByText('Whole organisation');
    expect(screen.queryByRole('button', { name: /Approve unlock/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Request unlock of Whole organisation/ })[0]);
    fireEvent.change(await screen.findByRole('textbox', { name: /Why must this be unlocked/ }), { target: { value: 'Missed sick leave' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(calls).toEqual([['/v1/leave/locks/l1/unlock-request', { reason: 'Missed sick leave' }]]));
  });

  it('lets an unlock approver approve a waiting request', async () => {
    perms = ['leave.unlock'];
    const calls = [];
    mount(calls, [requested]);
    await screen.findAllByText('Late correction');
    fireEvent.click(screen.getAllByRole('button', { name: /Approve unlock of/ })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve and unlock' }));
    await waitFor(() => expect(calls).toEqual([['/v1/leave/locks/l2/unlock-approve', 'POST']]));
  });

  it('shows the server refusal when approving your own request', async () => {
    perms = ['leave.unlock'];
    mockApi(api, {
      '/locks/l2/unlock-approve': Object.assign(new Error('You cannot approve your own unlock request.'), { status: 422 }),
      '/locks': { data: [requested] },
    });
    wrap(<LocksPage />);
    await screen.findAllByText('Late correction');
    fireEvent.click(screen.getAllByRole('button', { name: /Approve unlock of/ })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve and unlock' }));
    expect(await screen.findByText('You cannot approve your own unlock request.')).toBeInTheDocument();
  });
});
