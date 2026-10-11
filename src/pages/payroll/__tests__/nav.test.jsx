import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let perms = [];
vi.mock('../../../lib/auth', () => ({
  useAuth: () => ({ can: (p) => !p || p.split('|').some((k) => perms.includes(k)), enabled: () => true }),
}));
import PayrollLayout, { PayrollHome } from '../PayrollLayout';
import { PAYROLL_ACCESS, NAV } from '../../../lib/payrollApi';

afterEach(cleanup);
const show = (start = '/payroll/overview') =>
  render(
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        <Route path="payroll" element={<PayrollLayout />}>
          <Route index element={<PayrollHome />} />
          <Route path="my/payslips" element={<p>my payslips page</p>} />
          <Route path="overview" element={<p>child page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
const links = () => screen.queryAllByRole('link').map((l) => l.textContent);

describe('Payroll navigation', () => {
  it('shows an employee only their self-service sections', () => {
    perms = ['payroll.payslips.view_own', 'payroll.loans.view_own'];
    show();
    expect(links()).toEqual(['My payslips', 'Loans & advances']);
  });
  it('shows payroll operators the sections their keys unlock and hides the rest', () => {
    perms = ['payroll.view', 'payroll.run', 'payroll.payments.approve'];
    show();
    expect(links()).toEqual(expect.arrayContaining(['Command center', 'Readiness', 'Payroll runs', 'Payments']));
    expect(screen.queryByRole('link', { name: 'Accounting' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Country packs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My payslips' })).not.toBeInTheDocument();
  });
  it('renders no links without a payroll permission', () => {
    perms = ['people.view'];
    show();
    expect(links()).toHaveLength(0);
  });
  it('lands on the first allowed section from /payroll', () => {
    perms = ['payroll.payslips.view_own'];
    show('/payroll');
    expect(screen.getByText('my payslips page')).toBeInTheDocument();
  });
  it('module access covers every section key but not unrelated keys', () => {
    const keys = PAYROLL_ACCESS.split('|');
    NAV.forEach((n) => n.permission.split('|').forEach((k) => expect(keys).toContain(k)));
    expect(keys).not.toContain('people.view');
  });
});
