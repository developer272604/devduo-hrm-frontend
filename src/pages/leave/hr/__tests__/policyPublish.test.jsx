import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let perms = [];
vi.mock('../../../../lib/auth', () => ({
  useAuth: () => ({ can: (p) => !p || p.split('|').some((k) => perms.includes(k)), enabled: () => true }),
}));
vi.mock('../../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
import { api } from '../../../../lib/api';
import { mockApi } from '../../../timeoffice/__tests__/helpers';
import PolicyDetailPage from '../PolicyDetailPage';
import PoliciesPage from '../PoliciesPage';
import { ToastProvider } from '../../../../components/ui';

afterEach(cleanup);
beforeEach(() => {
  api.mockReset();
  perms = ['leave.policy.manage'];
});
const policy = {
  data: {
    uuid: 'p1',
    name: 'General policy',
    code: 'GEN',
    versions: [
      { version: 1, status: 'active', effective_from: '2026-01-01', effective_to: null },
      { version: 2, status: 'draft', effective_from: '2026-11-01', effective_to: null, change_note: 'More casual leave' },
    ],
  },
};
const diff = {
  data: {
    from: { policy_name: 'General policy', version: 1, status: 'active', effective_from: '2026-01-01' },
    to: { policy_name: 'General policy', version: 2, status: 'draft', effective_from: '2026-11-01' },
    meta_changes: [{ field: 'effective_from', before: '2026-01-01', after: '2026-11-01' }],
    changes: [{ section: 'CASUAL', section_label: 'Casual leave', path: 'entitlement.amount', change: 'changed', before: '6.0000', after: '8.0000' }],
    summary: { total: 1, added: 0, removed: 0, changed: 1 },
    identical: false,
  },
};
const mount = (calls) => {
  mockApi(api, {
    '/policies/p1/diff': diff,
    '/policies/p1/versions/2/publish': (p, o) => (calls.push({ p, method: o.method }), { data: { version: 2, status: 'scheduled' }, closed: [1], warnings: [{ message: 'Back-dated start' }] }),
    '/policies/p1': policy,
    '/types': { data: [] },
    '/policies': { data: [] },
  });
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/leave/hr/policies/p1']}>
        <Routes>
          <Route path="leave/hr/policies/:uuid" element={<PolicyDetailPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
};

describe('Policy publish flow', () => {
  it('shows the difference first and publishes only after acknowledgement', async () => {
    const calls = [];
    mount(calls);
    fireEvent.click(await screen.findByRole('button', { name: 'Publish version 2' }));
    const viewer = await screen.findByTestId('policy-diff');
    expect(viewer).toHaveTextContent('entitlement.amount');
    expect(viewer).toHaveTextContent('6.0000');
    expect(viewer).toHaveTextContent('8.0000');
    expect(calls).toHaveLength(0);
    const confirm = screen.getByRole('button', { name: 'Publish version' });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /can no longer be edited/ }));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(calls).toEqual([{ p: '/v1/leave/policies/p1/versions/2/publish', method: 'POST' }]));
    expect(await screen.findByText('Back-dated start')).toBeInTheDocument();
  });

  it('shows Access restricted without the policy permission and makes no request', () => {
    perms = ['leave.reports.view'];
    mockApi(api, {});
    render(<ToastProvider><MemoryRouter><PoliciesPage /></MemoryRouter></ToastProvider>);
    expect(screen.getByText('Access restricted')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it('shows the server 403 as Access restricted on the policy list', async () => {
    mockApi(api, { '/policies': Object.assign(new Error('Forbidden'), { status: 403 }) });
    render(<ToastProvider><MemoryRouter><PoliciesPage /></MemoryRouter></ToastProvider>);
    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });
});
