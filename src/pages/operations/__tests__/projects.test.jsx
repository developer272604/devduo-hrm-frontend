import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ProjectsPage from '../ProjectsPage';
import { ToastProvider } from '../../../components/ui';
import { api } from '../../../lib/api';
import { mockApi, calls } from '../../payroll/__tests__/helpers';

vi.mock('../../../lib/api', async (load) => ({ ...(await load()), api: vi.fn() }));
vi.mock('../../../lib/auth', () => ({
  useAuth: () => ({
    session: { project_management: true, tenant: { settings: { timezone: 'UTC' } } },
    can: (permission) => permission === 'projects.manage',
  }),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('saves weekly project capacity and displays approved utilization', async () => {
  mockApi(api, {
    '/p1/planning': (_path, request) =>
      request.method === 'PUT' ? null : { client_name: 'Client A', planned_minutes: 240 },
    '/report': [
      {
        project: 'p1',
        name: 'Implementation',
        billable: 90,
        non_billable: 30,
        planned_minutes: 240,
      },
    ],
    '/projects': {
      data: [{ uuid: 'p1', name: 'Implementation', client_name: 'Client A' }],
      last_page: 1,
    },
  });
  render(
    <ToastProvider>
      <ProjectsPage />
    </ToastProvider>,
  );
  fireEvent.change(screen.getByLabelText('Week of'), { target: { value: '2026-11-17' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Plan capacity' }));
  const dialog = screen.getByRole('dialog');
  const minutes = await within(dialog).findByLabelText('Planned minutes');
  expect(minutes).toHaveValue(240);
  fireEvent.change(minutes, { target: { value: '300' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save planning' }));
  expect(await screen.findByText('Project planning saved.')).toBeInTheDocument();
  expect(calls(api, '/p1/planning', 'PUT')[0][1].body).toEqual({
    week_start: '2026-11-16',
    client_name: 'Client A',
    planned_minutes: 300,
  });
  fireEvent.click(screen.getByRole('tab', { name: 'Project hours' }));
  expect(await screen.findByRole('cell', { name: '50%' })).toBeInTheDocument();
});

it('saves the configured cost rates and labels contribution as an estimate', async () => {
  const costing = {
    currency: 'INR',
    billing_rate: '20.01',
    labor_rate: '12.34',
    direct_cost: '10.00',
  };
  mockApi(api, {
    '/p1/planning': (_path, request) =>
      request.method === 'PUT' ? null : { client_name: null, planned_minutes: null, costing },
    '/report': [
      {
        project: 'p1',
        name: 'Implementation',
        billable: 90,
        non_billable: 30,
        costing: { currency: 'INR', revenue: '30.02', total_cost: '34.68', contribution: '-4.66' },
      },
    ],
    '/projects': { data: [{ uuid: 'p1', name: 'Implementation' }], last_page: 1 },
  });
  render(
    <ToastProvider>
      <ProjectsPage />
    </ToastProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Plan capacity' }));
  const directCost = await screen.findByLabelText('Direct costs for the week');
  fireEvent.change(directCost, { target: { value: '15.00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save planning' }));
  expect(await screen.findByText('Project planning saved.')).toBeInTheDocument();
  expect(calls(api, '/p1/planning', 'PUT')[0][1].body.costing).toEqual({
    ...costing,
    direct_cost: '15.00',
  });
  fireEvent.click(screen.getByRole('tab', { name: 'Project hours' }));
  expect(await screen.findByRole('cell', { name: 'INR -4.66' })).toBeInTheDocument();
});
