import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let perms = [];
vi.mock('../../../../lib/auth', () => ({
  useAuth: () => ({ can: (p) => !p || p.split('|').some((k) => perms.includes(k)), enabled: () => true }),
}));
import LeaveHrLayout from '../LeaveHrLayout';
import { NAV } from '../../../../lib/leaveHrApi';

afterEach(cleanup);
const show = () =>
  render(
    <MemoryRouter initialEntries={['/leave/hr']}>
      <Routes>
        <Route path="leave/hr" element={<LeaveHrLayout />}>
          <Route index element={<p>child page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
const links = () => screen.queryAllByRole('link').map((l) => l.textContent);

describe('Leave operations navigation', () => {
  it('shows only the sections the user has permission for', () => {
    perms = ['leave.accrual.run', 'leave.reports.view'];
    show();
    expect(links()).toEqual(['Command center', 'Accrual runs', 'Carry-forward & expiry', 'Payroll contract', 'Reports', 'Data quality & setup']);
    expect(screen.queryByRole('link', { name: 'Policies' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Locks' })).not.toBeInTheDocument();
    expect(screen.getByText('child page')).toBeInTheDocument();
  });
  it('shows every section to a leave administrator and marks the current one', () => {
    perms = ['leave.manage', 'leave.simulate'];
    show();
    expect(links()).toHaveLength(NAV.length);
    expect(screen.getByRole('link', { name: 'Command center' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('navigation', { name: 'Leave operations sections' })).toBeInTheDocument();
  });
  it('maps single-purpose permissions to their own sections', () => {
    perms = ['leave.lock'];
    show();
    expect(links()).toEqual(['Locks']);
    cleanup();
    perms = ['leave.simulate'];
    show();
    expect(links()).toEqual(['Simulators']);
  });
  it('renders no section links without any leave permission', () => {
    perms = ['attendance.manage'];
    show();
    expect(links()).toHaveLength(0);
  });
});
