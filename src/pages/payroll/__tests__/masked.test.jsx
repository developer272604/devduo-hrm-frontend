import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../lib/auth', () => ({ useAuth: () => ({ can: () => true, enabled: () => true }) }));
vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn(), download: vi.fn() }));
import { api } from '../../../lib/api';
import { Amount } from '../../../components/payroll/kit';
import { MyPayslipsPage } from '../SelfPages';
import { TotalsTab } from '../RunTabs';
import { ToastProvider } from '../../../components/ui';
import { apiError, mockApi } from './helpers';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('masked amounts', () => {
  it('hides null and asterisk amounts and announces why', () => {
    render(
      <>
        <Amount value={null} currency="USD" />
        <Amount value="***" />
        <Amount value="1200.0000" currency="USD" />
      </>,
    );
    expect(screen.getAllByText(/Hidden: you do not have permission/)).toHaveLength(2);
    expect(screen.getByText('USD 1200.0000')).toBeInTheDocument();
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });
  it('shows a payslip list without leaking a missing net amount', async () => {
    mockApi(api, { '/me/payslips': { data: [{ uuid: 'p1', status: 'published', period: { label: 'Oct 2026' }, currency: 'USD', net: null }] } });
    render(
      <MemoryRouter>
        <MyPayslipsPage />
      </MemoryRouter>,
    );
    expect(await screen.findAllByText('Oct 2026')).not.toHaveLength(0);
    expect(screen.getAllByText(/Hidden: you do not have permission/).length).toBeGreaterThan(0);
  });
  it('masks every run total when the API returns null amounts', async () => {
    mockApi(api, { '/totals': { stored: { employees: 12, currency: 'USD', gross: null, net: null, total_deductions: null, total_taxes: null, reimbursements: null, employer_contributions: null, employer_cost: null, reconciled: true } } });
    render(
      <ToastProvider>
        <TotalsTab run={{ uuid: 'r1' }} />
      </ToastProvider>,
    );
    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getAllByText(/Hidden: you do not have permission/)).toHaveLength(7);
  });
  it('shows Access restricted when totals are forbidden', async () => {
    mockApi(api, { '/totals': apiError('No permission', 403) });
    render(<TotalsTab run={{ uuid: 'r1' }} />);
    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });
});
