import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
let permissions = [];
vi.mock('../../../lib/auth', () => ({
  useAuth: () => ({
    can: (key) => key.split('|').some((p) => permissions.includes(p)),
    enabled: () => true,
  }),
}));
vi.mock('../../../lib/api', async (load) => ({ ...(await load()), api: vi.fn() }));
import { api } from '../../../lib/api';
import { ToastProvider } from '../../../components/ui';
import {
  WorkflowsPage,
  WorkflowDefinitionPage,
  WorkflowInstancePage,
  AnalyticsPage,
} from '../AutomationPages';
import { calls, mockApi } from '../../payroll/__tests__/helpers';
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const wrap = (ui, route, path) => (
  <ToastProvider>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={ui} />
      </Routes>
    </MemoryRouter>
  </ToastProvider>
);
describe('Workflows and analytics', () => {
  it('builds a structured draft and retains the selected trigger when adding steps', async () => {
    permissions = ['workflows.manage'];
    mockApi(api, {
      '/definitions': { data: [] },
      '/instances': { data: [] },
      '/deliveries': { data: [] },
      '/options': {
        users: [{ id: 7, name: 'Reviewer' }],
        employees: [],
        event_types: [{ value: 'EmployeeCreated', label: 'EmployeeCreated' }],
      },
    });
    render(wrap(<WorkflowsPage />, '/workflows', '/workflows'));
    fireEvent.click(await screen.findByRole('button', { name: 'New workflow' }));
    fireEvent.change(screen.getByLabelText('Workflow name'), {
      target: { value: 'Joining workflow' },
    });
    fireEvent.click(await screen.findByRole('combobox', { name: /Workflow trigger/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'event' }));
    fireEvent.change(screen.getByLabelText('Step title 1'), {
      target: { value: 'Review joining' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
    fireEvent.change(screen.getByLabelText('Step title 2'), {
      target: { value: 'Confirm joining' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Workflow draft created')).toBeInTheDocument();
    const body = calls(api, '/definitions')[0][1].body;
    expect(body.spec.trigger).toEqual({ type: 'event', event_type: 'EmployeeCreated' });
    expect(body.spec.steps).toHaveLength(2);
  });
  it('previews a draft without starting an instance', async () => {
    permissions = ['workflows.manage'];
    const spec = {
      steps: [
        {
          title: 'Review',
          action: 'approval',
          assignment: 'manager',
          assignees: [],
          mode: 'all',
          timeout_hours: 24,
        },
      ],
    };
    mockApi(api, {
      '/definitions/d1': {
        definition: { uuid: 'd1', name: 'Joining', revision: 2, draft: spec },
        versions: [],
      },
      '/options': { users: [], employees: [{ uuid: 'e1', employee_number: 'EMP-001' }] },
      '/simulate': {
        side_effects: false,
        steps: [{ step: 1, title: 'Review', matches: true, blocked: false, assignees: [7] }],
      },
    });
    render(
      wrap(<WorkflowDefinitionPage />, '/workflows/definitions/:uuid', '/workflows/definitions/d1'),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Simulate' }));
    fireEvent.click(screen.getByRole('combobox', { name: /Employee/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'EMP-001' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Simulation — no work created')).toBeInTheDocument();
    expect(calls(api, '/simulate')[0][1].body).toEqual({ spec, employee_uuid: 'e1' });
    expect(calls(api, '/instances')).toHaveLength(0);
  });
  it('submits an assigned approval with a reason', async () => {
    permissions = ['workflows.act'];
    mockApi(api, {
      '/instances/i1/decide': { uuid: 'i1' },
      '/instances/i1': {
        uuid: 'i1',
        name: 'Joining',
        version: 1,
        status: 'waiting',
        step: 1,
        step_count: 1,
        current_step: { title: 'Review', action: 'approval' },
        can_decide: true,
        trace: [],
      },
    });
    render(wrap(<WorkflowInstancePage />, '/workflows/instances/:uuid', '/workflows/instances/i1'));
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Evidence checked' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Workflow updated')).toBeInTheDocument();
    expect(calls(api, '/decide')[0][1].body).toEqual({
      decision: 'approved',
      reason: 'Evidence checked',
    });
    expect(screen.queryByRole('button', { name: 'Cancel workflow' })).not.toBeInTheDocument();
  });
  it('shows suppressed values without presenting them as zero and saves report criteria', async () => {
    permissions = ['analytics.view'];
    mockApi(api, {
      '/metrics': { data: [{ key: 'headcount', label: 'Headcount', dimensions: ['total'] }] },
      '/reports': { data: [] },
      '/query': {
        label: 'Headcount',
        rows: [{ group: 'Total', value: null, suppressed: true }],
        unit: 'employees',
        minimum_cohort: 5,
        refreshed_at: '2026-10-07T04:30:00Z',
        timezone: 'Asia/Kolkata',
        version: 1,
      },
    });
    render(wrap(<AnalyticsPage />, '/analytics', '/analytics'));
    fireEvent.click(await screen.findByRole('button', { name: 'Run report' }));
    expect(await screen.findByText('Suppressed — small cohort')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save report' }));
    fireEvent.change(screen.getByLabelText('Report name'), {
      target: { value: 'Monthly headcount' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Report saved')).toBeInTheDocument();
    expect(calls(api, '/reports')[0][1].body.name).toBe('Monthly headcount');
  });
});
