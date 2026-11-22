import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../lib/auth', () => ({ useAuth: () => ({ can: () => true, enabled: () => true }) }));
vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn(), download: vi.fn() }));
import { api } from '../../../lib/api';
import { CommandCenterPage } from '../OverviewPages';
import { mockApi } from './helpers';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('payroll command center', () => {
  it('renders the live payload shape, where alert counters are { count, action } objects', async () => {
    mockApi(api, {
      '/command-center': {
        data: {
          readiness: { state: 'blocked', rule: 'State is derived from explicit open conditions only.', groups: [] },
          processing: { active_runs: [], failed_calculations: 0 },
          blocking_errors: { count: 2, action: { label: 'Open validations', href: '/payroll/validations' } },
          warnings: { count: 1, action: { label: 'Open validations', href: '/payroll/validations' } },
          pending_approvals: { payroll: {}, compensation: 0 },
          variance_alerts: { count: 7, action: { label: 'Review variances', href: '/payroll/validations?code=variance' } },
          locks: { locked: 0, reopen_requested: 0 },
          money_visible: true,
        },
      },
    });
    render(
      <MemoryRouter>
        <CommandCenterPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Variance alerts')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });
});
