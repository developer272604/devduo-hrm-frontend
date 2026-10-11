import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
vi.mock('../../../lib/auth', () => ({ useAuth: () => ({ can: () => true, enabled: () => true }) }));
import { api } from '../../../lib/api';
import { mockApi } from './helpers';
import DailyAttendance from '../DailyAttendance';
import ResponsiveList from '../../../components/ResponsiveList';
import { ToastProvider } from '../../../components/ui';

afterEach(cleanup);
beforeEach(() => {
  api.mockReset();
});

const rows = Array.from({ length: 3 }, (_, i) => ({
  uuid: `d${i}`,
  employee_uuid: `e${i}`,
  employee_name: `Employee ${i}`,
  date: '2026-10-08',
  status: 'present',
  shift: 'GEN',
  first_in: '2026-10-08T09:00:00Z',
  last_out: '2026-10-08T18:00:00Z',
  net_minutes: 480,
  required_minutes: 480,
  late_minutes: 0,
  early_exit_minutes: 0,
  overtime_minutes: 0,
  open_exceptions: 0,
  finalization: 'open',
}));

describe('Daily attendance responsive switch', () => {
  it('renders a dense table for desktop, reduced columns for tablet and cards for mobile from one data set', async () => {
    mockApi(api, {
      '/reports/daily': { data: rows, meta: { page: 1, last_page: 1, total: 3 } },
      '/organization/': { data: [] },
      '/shifts': { data: [] },
      '/views': { data: [] },
    });
    render(<MemoryRouter><ToastProvider><DailyAttendance /></ToastProvider></MemoryRouter>);
    const table = await screen.findByRole('table', { name: 'Daily attendance' });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers).toHaveLength(13);
    const hiddenOnTablet = headers.filter((h) => h.className.includes('lg:table-cell'));
    const hiddenOnMobile = headers.filter((h) => h.className.includes('md:table-cell') && !h.className.includes('lg:table-cell'));
    expect(hiddenOnTablet.length).toBeGreaterThan(0);
    expect(hiddenOnMobile.length).toBeGreaterThan(0);
    expect(table.parentElement.className).toContain('hidden');
    expect(table.parentElement.className).toContain('md:block');
    const cards = screen.getByRole('list', { name: 'Daily attendance' });
    expect(cards.className).toContain('md:hidden');
    expect(within(cards).getAllByRole('listitem')).toHaveLength(3);
    expect(within(cards).getAllByText('Employee 1')).toHaveLength(1);
  });

  it('opens the day detail drawer from a row', async () => {
    mockApi(api, {
      '/reports/daily': { data: rows, meta: { page: 1, last_page: 1, total: 3 } },
      '/days/e0/2026-10-08': { uuid: 'd0', status: 'present', explanation: { steps: ['Matched the General shift', 'No late arrival'] }, calculation_version: 3, finalization: 'open' },
      '/organization/': { data: [] },
      '/shifts': { data: [] },
      '/views': { data: [] },
    });
    render(<MemoryRouter><ToastProvider><DailyAttendance /></ToastProvider></MemoryRouter>);
    const table = await screen.findByRole('table', { name: 'Daily attendance' });
    fireEvent.click(within(table).getByText('Employee 0'));
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByText('Matched the General shift')).toBeInTheDocument();
    expect(within(drawer).getByText(/Calculation trace \(version 3\)/)).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Adjust' })).toBeInTheDocument();
  });
});

describe('ResponsiveList', () => {
  it('shows the empty state instead of either layout when there are no rows', () => {
    render(<ResponsiveList columns={[{ key: 'a', label: 'A' }]} rows={[]} empty={{ title: 'Nothing here', description: 'x' }} />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
