import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let perms = [];
vi.mock('../../../../lib/auth', () => ({
  useAuth: () => ({
    can: (p) => !p || p.split('|').some((k) => perms.includes(k)),
    enabled: () => true,
  }),
}));
vi.mock('../../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
import { api } from '../../../../lib/api';
import { mockApi, choose } from '../../../timeoffice/__tests__/helpers';
import { ToastProvider } from '../../../../components/ui';
import BulkActionsPage from '../BulkActionsPage';

afterEach(cleanup);
beforeEach(() => {
  api.mockReset();
  perms = ['leave.manage'];
});

describe('Leave bulk actions', () => {
  it('requires a preview and explicit confirmation before running eligible employees', async () => {
    const calls = [];
    const response = {
      action: 'prepare_handling',
      count: 1,
      results: [
        {
          employee_uuid: 'e-1',
          employee_number: 'E-1',
          name: 'Asha Rao',
          status: 'ok',
          detail: { accounts: 2, warnings: [] },
        },
      ],
    };
    mockApi(api, {
      '/bulk-actions/prepare_handling/preview': (path, options) => (
        calls.push(['preview', options.body]),
        response
      ),
      '/bulk-actions/prepare_handling/run': (path, options) => (
        calls.push(['run', options.body]),
        response
      ),
      '/v1/employees': {
        data: [{ uuid: 'e-1', display_name: 'Asha Rao', employee_number: 'E-1' }],
      },
      '/bulk-actions': {
        data: [
          {
            key: 'prepare_handling',
            label: 'Prepare leave handling',
            description: 'Create leave plans.',
            max_employees: 500,
          },
        ],
      },
    });
    render(
      <ToastProvider>
        <MemoryRouter>
          <BulkActionsPage />
        </MemoryRouter>
      </ToastProvider>,
    );

    await screen.findByText('Choose an action');
    choose('Registered action', 'Prepare leave handling');
    fireEvent.change(screen.getByRole('textbox', { name: 'Find employee' }), {
      target: { value: 'As' },
    });
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(expect.stringContaining('/v1/employees'), expect.anything()),
    );
    choose('Search results', 'Asha Rao (E-1)');
    fireEvent.click(screen.getByRole('button', { name: 'Add employee' }));
    expect(await screen.findAllByText('Asha Rao (E-1)')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Preview action' }));
    await screen.findByText('Preview results');
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('preview');
    expect(calls[0][1]).toMatchObject({ employees: ['e-1'], params: { trigger: 'transfer' } });
    expect(screen.getByRole('button', { name: 'Run bulk action' })).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /I reviewed the preview/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Run bulk action' }));
    await screen.findByText('Run results');
    expect(calls.map(([kind]) => kind)).toEqual(['preview', 'run']);
  });
});
