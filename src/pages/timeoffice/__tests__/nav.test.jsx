import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let perms = [];
vi.mock('../../../lib/auth', () => ({
  useAuth: () => ({ can: (p) => !p || p.split('|').some((k) => perms.includes(k)), enabled: () => true }),
}));
import TimeOfficeLayout from '../TimeOfficeLayout';

afterEach(cleanup);
const show = () =>
  render(
    <MemoryRouter initialEntries={['/time-office']}>
      <Routes>
        <Route path="time-office" element={<TimeOfficeLayout />}>
          <Route index element={<p>child page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
const links = () => screen.getAllByRole('link').map((l) => l.textContent);

describe('Time office navigation', () => {
  it('shows only sections the user has permission for', () => {
    perms = ['attendance.roster.manage', 'attendance.reports.view'];
    show();
    expect(links()).toEqual(['Command center', 'Daily attendance', 'Roster', 'Shifts', 'Calendars', 'Reports']);
    expect(screen.queryByRole('link', { name: 'Devices' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.getByText('child page')).toBeInTheDocument();
  });
  it('shows every section to an administrator and marks the current one', () => {
    perms = ['attendance.manage', 'attendance.devices.manage', 'attendance.policy.manage', 'attendance.lock', 'attendance.process'];
    show();
    expect(links()).toHaveLength(14);
    expect(screen.getByRole('link', { name: 'Command center' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('navigation', { name: 'Time office sections' })).toBeInTheDocument();
  });
  it('renders no section links without any permission', () => {
    perms = [];
    show();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
