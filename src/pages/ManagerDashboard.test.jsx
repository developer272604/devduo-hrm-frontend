import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import ManagerDashboard from './ManagerDashboard';

const auth = vi.hoisted(() => ({ allowed: [], modules: [] }));
vi.mock('../lib/api', async (load) => ({ ...(await load()), api: vi.fn() }));
vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    can: (value) => value.split('|').some((key) => auth.allowed.includes(key)),
    enabled: (module) => auth.modules.includes(module),
  }),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const show = () =>
  render(
    <MemoryRouter>
      <ManagerDashboard />
    </MemoryRouter>,
  );

it('loads scoped manager summaries and omits links for disabled modules', async () => {
  auth.allowed = ['attendance.team.view', 'leave.approve', 'performance.reports.view'];
  auth.modules = ['attendance', 'leave'];
  api.mockImplementation(async (path) =>
    path.includes('attendance')
      ? {
          team_size: 20,
          groups: {
            in: { count: 13 },
            on_leave: { count: 2 },
            pending_regularizations: { count: 9 },
          },
        }
      : { data: [], meta: { total: 4 } },
  );
  show();
  expect(await screen.findByText('13')).toBeInTheDocument();
  expect(await screen.findByText('4')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Daily attendance and team schedules/ })).toHaveAttribute(
    'href',
    '/attendance/team',
  );
  expect(screen.queryByText('Pending corrections')).not.toBeInTheDocument();
  expect(screen.queryByText('Performance dashboard')).not.toBeInTheDocument();
  expect(api).toHaveBeenCalledTimes(2);
});

it('blocks direct access without any manager workflow permissions', () => {
  auth.allowed = ['attendance.view', 'leave.view', 'performance.self'];
  auth.modules = ['attendance', 'leave', 'performance'];
  show();
  expect(screen.getByRole('alert')).toHaveTextContent('Access restricted');
  expect(api).not.toHaveBeenCalled();
});
