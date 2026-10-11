import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../lib/auth', () => ({ useAuth: () => ({ can: () => true, enabled: () => true }) }));
vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
import { api } from '../../../lib/api';
import { ToastProvider } from '../../../components/ui';
import { mockApi } from './helpers';
import BenefitsAdminPage from '../BenefitsAdminPage';

afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('Benefits administration', () => {
  it('creates a plan, adds an enrollment window and reviews a request', async () => {
    mockApi(api, {
      '/plans': { data: [
        { uuid: 'p1', code: 'HEALTH', name: 'Health', category: 'insurance', status: 'active', effective_from: '2026-01-01', windows: [] },
      ] },
      '/enrollments': { data: [
        { uuid: 'e1', employee: 'Alex Employee', plan: 'Health', status: 'pending', effective_from: '2026-11-01' },
        { uuid: 'e2', employee: 'Sam Employee', plan: 'Dental', status: 'termination_pending', effective_from: '2025-01-01', effective_to: '2026-12-31' },
      ] },
    });
    render(<ToastProvider><MemoryRouter><BenefitsAdminPage /></MemoryRouter></ToastProvider>);

    fireEvent.click(await screen.findByRole('button', { name: 'Create plan' }));
    fireEvent.change(screen.getByLabelText('Plan code'), { target: { value: 'WELLNESS' } });
    fireEvent.change(screen.getByLabelText('Plan name'), { target: { value: 'Wellness allowance' } });
    fireEvent.change(screen.getByLabelText('Effective from'), { target: { value: '2026-11-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/v1/benefits/plans', expect.objectContaining({ method: 'POST', body: expect.objectContaining({
      code: 'WELLNESS', name: 'Wellness allowance', category: 'insurance', effective_from: '2026-11-01',
      contributions: { employee_fixed: '0', employer_fixed: '0' },
    }) })));

    fireEvent.click(await screen.findByRole('button', { name: 'Add window' }));
    fireEvent.change(screen.getByLabelText('Window name'), { target: { value: 'Annual enrollment' } });
    fireEvent.change(screen.getByLabelText('Opens on'), { target: { value: '2026-10-12' } });
    fireEvent.change(screen.getByLabelText('Closes on'), { target: { value: '2026-10-31' } });
    fireEvent.change(screen.getByLabelText('Coverage effective on'), { target: { value: '2026-11-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/v1/benefits/plans/p1/windows', expect.objectContaining({ method: 'POST', body: {
      name: 'Annual enrollment', opens_on: '2026-10-12', closes_on: '2026-10-31', effective_on: '2026-11-01',
    } })));

    fireEvent.click((await screen.findAllByRole('button', { name: 'Approve' }))[0]);
    await waitFor(() => expect(api).toHaveBeenCalledWith('/v1/benefits/enrollments/e1/decision', expect.objectContaining({ method: 'POST', body: { decision: 'approved' } })));
    fireEvent.click(screen.getAllByRole('button', { name: 'Approve' })[1]);
    await waitFor(() => expect(api).toHaveBeenCalledWith('/v1/benefits/enrollments/e2/termination-decision', expect.objectContaining({ method: 'POST', body: { decision: 'approved' } })));
  });
});
