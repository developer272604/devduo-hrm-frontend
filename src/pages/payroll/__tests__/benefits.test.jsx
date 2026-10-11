import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../lib/auth', () => ({ useAuth: () => ({ can: () => true, enabled: () => true }) }));
vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
import { api } from '../../../lib/api';
import { ToastProvider } from '../../../components/ui';
import { mockApi } from './helpers';
import { MyBenefitsPage } from '../SelfPages';

afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('My benefits', () => {
  it('shows eligible window, submits an enrollment and refreshes status', async () => {
    let enrolled = false;
    mockApi(api, {
      '/available': { data: [{ uuid: 'plan-1', name: 'Health', category: 'insurance', currency: 'INR', windows: [{ uuid: 'window-1', name: 'Open enrollment', effective_on: '2026-11-01', closes_on: '2026-10-31' }] }] },
      '/me': () => ({ data: enrolled ? [{ uuid: 'en-1', plan: 'Health', category: 'insurance', status: 'pending', effective_from: '2026-11-01' }] : [] }),
      '/enroll': () => { enrolled = true; return { uuid: 'en-1', status: 'pending' }; },
    });
    render(<ToastProvider><MemoryRouter><MyBenefitsPage /></MemoryRouter></ToastProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Enroll' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/v1/benefits/plans/plan-1/enroll', expect.objectContaining({ method: 'POST', body: { window_uuid: 'window-1' } })));
    await waitFor(() => expect(api.mock.calls.filter(([path, options]) => path === '/v1/benefits/me' && (options?.method ?? 'GET') === 'GET').length).toBeGreaterThan(1));
  });

  it('submits an end-coverage request for an active enrollment', async () => {
    mockApi(api, {
      '/available': { data: [] },
      '/me': { data: [{ uuid: 'en-2', plan: 'Dental', category: 'insurance', status: 'active', effective_from: '2026-01-01' }] },
    });
    render(<ToastProvider><MemoryRouter><MyBenefitsPage /></MemoryRouter></ToastProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Request end' }));
    fireEvent.change(screen.getByLabelText('Coverage end date'), { target: { value: '2026-11-30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/v1/benefits/me/en-2/termination', expect.objectContaining({
      method: 'POST', body: { effective_to: '2026-11-30' },
    })));
  });
});
