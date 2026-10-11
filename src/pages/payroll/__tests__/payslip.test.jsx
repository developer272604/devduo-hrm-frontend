import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../../lib/auth', () => ({ useAuth: () => ({ can: () => true, enabled: () => true }) }));
vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn(), download: vi.fn() }));
import { api, download } from '../../../lib/api';
import { MyPayslipDetailPage } from '../SelfPages';
import { ToastProvider } from '../../../components/ui';
import { apiError, mockApi } from './helpers';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const payslip = {
  uuid: 'p1',
  version: 2,
  status: 'published',
  period: { label: 'October 2026', start: '2026-10-01', end: '2026-10-31' },
  currency: 'USD',
  snapshot: {
    country: 'ZZ',
    payable_days: '22.000000',
    working_days: '22.000000',
    totals: { gross: '5000.0000', deductions: '200.0000', taxes: '500.0000', reimbursements: '0.0000', net: '4300.0000' },
    lines: { earnings: [{ code: 'BASE', name: 'Basic salary', amount: '5000.0000' }], deductions: [{ code: 'LOAN', name: 'Loan recovery', amount: '200.0000' }], taxes: [{ code: 'TAX', name: 'Income tax', amount: '500.0000' }] },
    ytd: null,
    bank: { bank_name: 'Test Bank', account: '****1234' },
  },
};
const show = () =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/payroll/my/payslips/p1']}>
        <Routes>
          <Route path="/payroll/my/payslips/:uuid" element={<MyPayslipDetailPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );

describe('My payslip', () => {
  it('shows totals, grouped lines, masked bank account and a print link', async () => {
    mockApi(api, { '/me/payslips/p1': { data: payslip } });
    show();
    expect(await screen.findByText('Basic salary')).toBeInTheDocument();
    expect(screen.getByText('USD 4300.0000')).toBeInTheDocument();
    expect(screen.getByText('Loan recovery')).toBeInTheDocument();
    expect(screen.getByText(/\*\*\*\*1234/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Print view' })).toHaveAttribute('href', '/api/v1/payroll/me/payslips/p1/print');
  });
  it('requests a signed link and downloads through it', async () => {
    mockApi(api, {
      '/download-link': { url: '/api/v1/payroll/me/payslips/p1/download?signature=abc', expires_at: '2026-10-10T10:00:00Z' },
      '/me/payslips/p1': { data: payslip },
    });
    download.mockResolvedValue();
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Download' }));
    await waitFor(() => expect(download).toHaveBeenCalledWith('/v1/payroll/me/payslips/p1/download?signature=abc', 'payslip-p1.html'));
  });
  it('shows Access restricted for a forbidden payslip', async () => {
    mockApi(api, { '/me/payslips/p1': apiError('Forbidden', 403) });
    show();
    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });
});
