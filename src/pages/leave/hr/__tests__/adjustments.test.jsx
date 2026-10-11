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
import AdjustmentsPage from '../AdjustmentsPage';
import { ToastProvider } from '../../../../components/ui';

afterEach(cleanup);
beforeEach(() => {
  api.mockReset();
});
const pending = { uuid: 'a1', employee: { name: 'Asha Rao' }, leave_type: { code: 'AL' }, kind: 'grant', units: '2.0000', status: 'pending', reason: 'Project support', requested_by: { name: 'Hari' } };
const mount = (calls, approve) => {
  mockApi(api, {
    '/adjustments/a1/approve': approve ?? ((p, o) => (calls.push([p, o.method, o.body]), { data: { ...pending, status: 'approved' } })),
    '/adjustments/bulk/preview': (p, o) => (
      calls.push([p, o.method, o.body]),
      { rows: [{ employee: { name: 'Asha Rao' }, current_available: '3.0000', delta: '1.0000', projected_available: '4.0000', will_apply: true, issues: [] }], summary: { employees: 1, will_apply: 1 } }
    ),
    '/adjustments/bulk': (p, o) => (calls.push([p, o.method, o.body]), { data: [], duplicate: false }),
    '/adjustments': { data: [pending] },
    '/types': { data: [{ uuid: 't1', code: 'AL', name: 'Annual' }] },
  });
  render(
    <ToastProvider>
      <MemoryRouter>
        <AdjustmentsPage />
      </MemoryRouter>
    </ToastProvider>,
  );
};

describe('Adjustments maker-checker', () => {
  it('lets a maker create requests but not approve them', async () => {
    perms = ['leave.adjust'];
    mount([]);
    expect((await screen.findAllByText('Asha Rao')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /New adjustment/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve adjustment/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reject adjustment/ })).not.toBeInTheDocument();
  });

  it('lets a checker approve a pending adjustment with a note', async () => {
    perms = ['leave.adjust.approve'];
    const calls = [];
    mount(calls);
    await screen.findAllByText('Asha Rao');
    expect(screen.queryByRole('button', { name: /New adjustment/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Approve adjustment for Asha Rao' })[0]);
    fireEvent.change(await screen.findByRole('textbox', { name: /Note/ }), { target: { value: 'Checked with manager' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(calls).toEqual([['/v1/leave/adjustments/a1/approve', 'POST', { note: 'Checked with manager' }]]));
  });

  it('shows the server refusal when the approver is the requester', async () => {
    perms = ['leave.adjust.approve'];
    mount([], () => Object.assign(new Error('The approver must be a different person than the requester.'), { status: 403 }));
    await screen.findAllByText('Asha Rao');
    fireEvent.click(screen.getAllByRole('button', { name: 'Approve adjustment for Asha Rao' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByText(/different person than the requester/)).toBeInTheDocument();
  });

  it('previews a bulk adjustment and creates the pending batch only on confirmation', async () => {
    perms = ['leave.adjust'];
    const calls = [];
    mount(calls);
    await screen.findAllByText('Asha Rao');
    fireEvent.click(screen.getByRole('button', { name: /Bulk adjustment/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Employee IDs/ }), { target: { value: 'e1, e2' } });
    fireEvent.click(within(dialog).getByRole('combobox', { name: /Leave type/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Annual (AL)' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Units/ }), { target: { value: '1' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Reason/ }), { target: { value: 'Year-end grant' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Preview impact' }));
    expect((await screen.findAllByText('4')).length).toBeGreaterThan(0);
    expect(calls.map((c) => c[0])).toEqual(['/v1/leave/adjustments/bulk/preview']);
    expect(calls[0][2].employees).toEqual(['e1', 'e2']);
    fireEvent.click(screen.getByRole('button', { name: 'Create pending batch' }));
    await waitFor(() => expect(calls.map((c) => c[0])).toEqual(['/v1/leave/adjustments/bulk/preview', '/v1/leave/adjustments/bulk']));
    expect(calls[1][2].idempotency_key).toBeTruthy();
  });
});
