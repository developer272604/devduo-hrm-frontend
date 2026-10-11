import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmployeeDirectory from './EmployeeDirectory';
import CoworkerDirectory from './CoworkerDirectory';
import { ToastProvider } from '../../components/ui';
import { api } from '../../lib/api';

let permissions = [];
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ can: (p) => permissions.includes(p), enabled: () => true }),
}));
vi.mock('../../lib/api', async (original) => ({
  ...(await original()),
  api: vi.fn(),
  download: vi.fn(),
}));

const people = [
  { uuid: 'u1', display_name: 'Alex Morgan', employee_number: 'E-001', designation: 'Engineer', department: 'Platform', location: 'Pune', status: 'active', has_photo: false },
  { uuid: 'u2', display_name: 'Sam Rivera', employee_number: 'E-002', designation: 'Designer', department: 'Design', location: 'Remote', status: 'probation', has_photo: false },
];
function route(path, options = {}) {
  if (path.startsWith('/v1/employees?') || path.startsWith('/v1/directory?'))
    return Promise.resolve({ data: people, current_page: 1, last_page: 1, total: 2 });
  if (path.startsWith('/v1/people/bulk/actions')) return Promise.resolve([{ key: 'activate', label: 'Activate' }]);
  if (path.startsWith('/v1/people/bulk/preview'))
    return Promise.resolve({ affected_count: 1, counts: { ok: 1, skipped: 0, error: 0 }, rows: [{ uuid: 'u1', name: 'Alex Morgan', status: 'ok' }], confirmation_token: 'tok' });
  if (path.startsWith('/v1/people/bulk/apply')) return Promise.resolve({ status: 'completed', applied: 1 });
  if (path.startsWith('/v1/people/views')) return Promise.resolve([]);
  if (path.startsWith('/v1/people/directory/columns')) return Promise.resolve([]);
  void options;
  return Promise.resolve({ data: [] });
}
const mount = (ui) =>
  render(
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>,
  );
const lastList = () => api.mock.calls.map(([p]) => p).filter((p) => p.startsWith('/v1/employees?')).at(-1);

beforeEach(() => {
  permissions = ['people.view', 'people.manage'];
  api.mockImplementation(route);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Employee directory', () => {
  it('renders desktop rows and mobile cards from the same data', async () => {
    mount(<EmployeeDirectory />);
    expect(await screen.findByRole('table', { name: 'Employees' })).toBeInTheDocument();
    const cards = screen.getByRole('list', { name: 'Employees' });
    expect(within(cards).getAllByRole('listitem')).toHaveLength(2);
    expect(within(cards).getByText('Alex Morgan')).toBeInTheDocument();
    expect(within(cards).getByText('Engineer · E-001')).toBeInTheDocument();
  });

  it('sends search and status filters to the API and resets the page', async () => {
    mount(<EmployeeDirectory />);
    await screen.findByRole('table', { name: 'Employees' });
    fireEvent.change(screen.getByPlaceholderText('Search people…'), { target: { value: 'alex' } });
    await waitFor(() => expect(lastList()).toContain('q=alex'));
    fireEvent.click(screen.getByRole('combobox', { name: /Status/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Probation' }));
    await waitFor(() => expect(lastList()).toContain('status=probation'));
    expect(lastList()).toContain('page=1');
  });

  it('shows an empty state with a way to clear filters', async () => {
    api.mockImplementation((p) => (p.startsWith('/v1/employees?') ? Promise.resolve({ data: [], current_page: 1, last_page: 1, total: 0 }) : route(p)));
    mount(<EmployeeDirectory />);
    fireEvent.change(await screen.findByPlaceholderText('Search people…'), { target: { value: 'zzz' } });
    expect(await screen.findByText('No matching employees')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('shows an error state with retry when the list fails', async () => {
    api.mockImplementation((p) => (p.startsWith('/v1/employees?') ? Promise.reject(Object.assign(new Error('Server down'), { status: 500 })) : route(p)));
    mount(<EmployeeDirectory />);
    expect(await screen.findByText('Server down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('gates add, bulk and export controls by permission', async () => {
    mount(<EmployeeDirectory />);
    await screen.findByRole('table', { name: 'Employees' });
    expect(screen.getByRole('link', { name: /Add employee/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Export/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Select Alex Morgan')).not.toBeInTheDocument();
  });

  it('previews a bulk action before applying it', async () => {
    permissions = ['people.view', 'people.bulk', 'people.export'];
    mount(<EmployeeDirectory />);
    await screen.findByRole('table', { name: 'Employees' });
    expect(screen.getByRole('button', { name: /Export results/ })).toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText('Select Alex Morgan')[0]);
    fireEvent.click(await screen.findByRole('combobox', { name: /Bulk action/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Activate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));
    expect(await screen.findByText('1 employees affected.')).toBeInTheDocument();
    expect(api.mock.calls.some(([p]) => p.includes('bulk/apply'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and apply' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/v1/people/bulk/apply', { method: 'POST', body: { confirmation_token: 'tok' } }),
    );
  });

  it('opens a quick preview drawer when a row is chosen', async () => {
    mount(<EmployeeDirectory />);
    const table = await screen.findByRole('table', { name: 'Employees' });
    fireEvent.click(within(table).getByText('Sam Rivera'));
    expect(await screen.findByRole('link', { name: 'Open full profile' })).toHaveAttribute('href', '/people/u2');
  });
});

describe('Coworker directory', () => {
  it('lists coworkers via the privacy-respecting endpoint without admin filters', async () => {
    permissions = ['people.directory'];
    api.mockImplementation((p) =>
      p.startsWith('/v1/directory?')
        ? Promise.resolve({ data: [{ uuid: 'c1', display_name: 'Casey Lee', designation: 'Analyst', department: 'Finance', work_email: 'casey@example.com', work_phone: null }], current_page: 1, last_page: 1, total: 1 })
        : Promise.resolve({ data: [] }),
    );
    mount(<CoworkerDirectory />);
    expect(await screen.findByText('Casey Lee')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Email Casey Lee' })).toHaveAttribute('href', 'mailto:casey@example.com');
    expect(screen.queryByRole('link', { name: 'Call Casey Lee' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Status/ })).not.toBeInTheDocument();
    expect(api.mock.calls[0][0]).toMatch(/^\/v1\/directory\?/);
  });
});
