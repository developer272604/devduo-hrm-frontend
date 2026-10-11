import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let permissions = [];
vi.mock('../../../lib/auth', () => ({
  useAuth: () => ({ can: (key) => key.split('|').some((item) => permissions.includes(item)), enabled: () => true }),
}));
vi.mock('../../../lib/api', async (load) => ({ ...(await load()), api: vi.fn() }));
import { api } from '../../../lib/api';
import { ToastProvider } from '../../../components/ui';
import { GoalsPage, PerformanceDashboardPage, ReviewDetailPage, ReviewsPage } from '../PerformancePages';
import PerformanceLayout from '../PerformanceLayout';
import { calls, mockApi } from '../../payroll/__tests__/helpers';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const page = (rows) => ({ data: rows, current_page: 1, last_page: 1, total: rows.length });
const wrap = (ui, path = '/') => (
  <ToastProvider><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></ToastProvider>
);

describe('Performance navigation', () => {
  it('shows only sections available to the current role', () => {
    permissions = ['performance.self'];
    render(wrap(<PerformanceLayout />));
    expect(screen.getByRole('link', { name: 'Goals and OKRs' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reviews' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Cycles' })).not.toBeInTheDocument();
  });
});

describe('Performance screens', () => {
  it('shows goal progress and owner data from the API', async () => {
    permissions = ['performance.self'];
    mockApi(api, { '/goals': page([{ uuid: 'g1', title: 'Improve onboarding', level: 'individual', status: 'active', progress: '45.00', owner: { name: 'Asha Rao' } }]) });
    render(wrap(<GoalsPage />));
    expect(await screen.findAllByText('Improve onboarding')).not.toHaveLength(0);
    expect(screen.getAllByText('45%')).not.toHaveLength(0);
    expect(screen.getAllByText('Asha Rao')).not.toHaveLength(0);
  });

  it('renders review rows using the API nested employee and cycle data', async () => {
    permissions = ['performance.view'];
    mockApi(api, { '/reviews': page([{ uuid: 'r1', employee: { name: 'Mira Shah' }, cycle: { name: 'Annual 2026' }, role: 'manager', status: 'in_progress' }]) });
    render(wrap(<ReviewsPage />));
    expect(await screen.findAllByText('Mira Shah')).not.toHaveLength(0);
    expect(screen.getAllByText('Annual 2026')).not.toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Open review' })).toHaveAttribute('href', '/performance/reviews/r1');
  });

  it('shows the scoped dashboard counters', async () => {
    permissions = ['performance.reports.view'];
    mockApi(api, { '/dashboard': { cycle: { name: 'Annual 2026' }, reviews: { total: 12 }, late_responses: 2, calibration: { pending_changes: 1 }, goals: { pending_approval: 3 } } });
    render(wrap(<PerformanceDashboardPage />));
    expect(await screen.findByText('Annual 2026')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(within(screen.getByText('Late responses').parentElement).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('submits a pending response using the supplied review template', async () => {
    permissions = ['performance.self'];
    mockApi(api, {
      '/reviews/r1': {
        uuid: 'r1',
        employee: { name: 'Asha Rao' },
        cycle: { name: 'Annual 2026', status: 'open' },
        status: 'in_progress',
        role: 'subject',
        scale: { labels: [{ value: 1, label: 'Needs work' }, { value: 5, label: 'Excellent' }] },
        template: { sections: [{ key: 'goals', title: 'Goals', type: 'goals', mandatory: true }], competencies: [] },
        responses: [{ uuid: 'resp1', type: 'self', status: 'pending', mine: true }],
      },
      '/review-responses/resp1/submit': { uuid: 'resp1', status: 'submitted', score: '5.000' },
    });
    render(wrap(<Routes><Route path="/performance/reviews/:uuid" element={<ReviewDetailPage />} /></Routes>, '/performance/reviews/r1'));
    fireEvent.change(await screen.findByLabelText('Goal or outcome'), { target: { value: 'Deliver onboarding improvements' } });
    fireEvent.change(screen.getByLabelText('Rating'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit response' }));
    await waitFor(() => expect(calls(api, '/review-responses/resp1/submit')).toHaveLength(1));
    expect(calls(api, '/review-responses/resp1/submit')[0][1].body.items[0]).toMatchObject({
      section: 'goals',
      ref: 'goals',
      label: 'Deliver onboarding improvements',
      rating: 5,
    });
  });
});
