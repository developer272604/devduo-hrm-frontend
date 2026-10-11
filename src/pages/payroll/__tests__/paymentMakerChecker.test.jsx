import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../../lib/auth', () => ({ useAuth: () => ({ can: () => true, enabled: () => true }) }));
vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn(), download: vi.fn() }));
import { api } from '../../../lib/api';
import { PaymentDetailPage } from '../PaymentsPages';
import { ToastProvider } from '../../../components/ui';
import { apiError, calls, mockApi } from './helpers';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const batch = (extra = {}) => ({
  data: {
    uuid: 'b1',
    status: 'prepared',
    currency: 'USD',
    total_amount: '8600.0000',
    employee_count: 2,
    can_approve: true,
    reconciliation: { net_total: '8600.0000', instructed: '8600.0000', excluded_net: '0.0000', difference: '0.0000' },
    exceptions: [],
    instructions: [{ uuid: 'i1', employee_name: 'Asha Rao', amount: '4300.0000', status: 'prepared', account: '********9012' }],
    files: [],
    ...extra,
  },
});
const show = () =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/payroll/payments/b1']}>
        <Routes>
          <Route path="/payroll/payments/:uuid" element={<PaymentDetailPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );

describe('Payment maker-checker', () => {
  it('disables approval and explains why when the viewer prepared the batch', async () => {
    mockApi(api, { '/payments/b1': batch({ can_approve: false }) });
    show();
    expect(await screen.findByText('Another approver is needed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve batch' })).toBeDisabled();
  });
  it('approves through a confirmation dialog', async () => {
    mockApi(api, { '/payments/b1/approve': { ok: true }, '/payments/b1': batch() });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Approve batch' }));
    expect(screen.getByRole('dialog', { name: 'Approve payment batch?' })).toBeInTheDocument();
    expect(calls(api, '/approve')).toHaveLength(0);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Approve batch'));
    await waitFor(() => expect(calls(api, '/approve')).toHaveLength(1));
  });
  it('shows the server maker-checker refusal inside the dialog', async () => {
    mockApi(api, { '/payments/b1/approve': apiError('The preparer cannot approve this batch.', 403), '/payments/b1': batch() });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Approve batch' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Approve batch'));
    expect(await screen.findByText('The preparer cannot approve this batch.')).toBeInTheDocument();
    await waitFor(() => expect(calls(api, '/approve')).toHaveLength(1));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('hides bank file generation until the batch is approved', async () => {
    mockApi(api, { '/payments/b1': batch() });
    show();
    await screen.findAllByText('Asha Rao');
    expect(screen.queryByRole('button', { name: 'Generate bank file' })).not.toBeInTheDocument();
  });
});
