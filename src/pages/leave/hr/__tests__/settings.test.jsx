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
import { mockApi } from '../../../timeoffice/__tests__/helpers';
import { ToastProvider } from '../../../../components/ui';
import SettingsPage from '../SettingsPage';

afterEach(cleanup);
beforeEach(() => {
  api.mockReset();
  perms = ['leave.manage'];
});

describe('Leave settings', () => {
  it('loads tenant defaults and saves only through the settings endpoint', async () => {
    const saved = [];
    const initial = {
      requests: {
        backdate_days: 7,
        future_days: 365,
        advance_notice_days: 0,
        require_reason: false,
        allow_withdraw_after_approval: true,
      },
      approvals: { steps: ['manager'], escalate_after_hours: 48, auto_approve_for_hr: false },
      units: {
        minutes_per_day: 480,
        minutes_per_half_day: 240,
        minutes_per_quarter_day: 120,
        rounding: 'nearest',
      },
      balance: {
        allow_negative_default: false,
        default_negative_limit: '0.0000',
        carry_negative_forward: true,
        maker_checker: true,
      },
      accrual: {
        run_day_of_month: 1,
        catch_up_days: 3,
        nightly_enabled: true,
        auto_carry_forward: false,
      },
      comp_off: { require_approval: true, default_validity_days: 90 },
      expiry: { notify_days_before: [30, 7] },
      privacy: {
        managers_see_reason: false,
        managers_see_medical: false,
        medical_retention_days: 2555,
      },
      restrictions: { never_block_statutory: true },
      integration: { sync_attendance: true, payroll_contract: true, cutoff_day: null },
    };
    mockApi(api, {
      '/settings': (path, options) =>
        options.method === 'PUT'
          ? (saved.push(options.body), { data: options.body })
          : { data: initial },
    });
    render(
      <ToastProvider>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </ToastProvider>,
    );

    const reason = await screen.findByRole('checkbox', { name: 'Require a reason' });
    fireEvent.click(reason);
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].requests.require_reason).toBe(true);
    expect(saved[0].units.minutes_per_day).toBe(480);
  });
});
