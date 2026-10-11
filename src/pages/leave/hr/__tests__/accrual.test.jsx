import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let perms = [];
vi.mock('../../../../lib/auth', () => ({
  useAuth: () => ({ can: (p) => !p || p.split('|').some((k) => perms.includes(k)), enabled: () => true }),
}));
vi.mock('../../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
import { api } from '../../../../lib/api';
import { mockApi } from '../../../timeoffice/__tests__/helpers';
import AccrualRunsPage from '../AccrualRunsPage';
import { ToastProvider } from '../../../../components/ui';

afterEach(cleanup);
beforeEach(() => {
  api.mockReset();
  perms = ['leave.accrual.run'];
});
const run = { id: 'r1', status: 'preview', mode: 'manual', window: { from: '2026-09-10', to: '2026-10-10' }, counts: { total: 2, posted: 0, skipped: 0, failed: 0 } };
const mount = (posts, previewRun = run) => {
  mockApi(api, {
    '/accrual-runs/preview': (p, o) => (posts.push(['preview', o.method]), { data: previewRun }),
    '/accrual-runs/r1/items': { data: [{ employee: { name: 'Asha Rao' }, leave_type: { code: 'AL' }, status: 'preview', units: '1.0000' }] },
    '/accrual-runs/r1/execute': (p, o) => (posts.push(['execute', o.method]), { data: { ...run, status: 'queued' } }),
    '/accrual-runs': { data: [{ id: 'r0', status: 'completed', mode: 'nightly', window: { from: '2026-08-01', to: '2026-08-31' }, counts: { total: 5, posted: 4, skipped: 0, failed: 1 } }] },
    '/types': { data: [{ uuid: 't1', code: 'AL', name: 'Annual' }] },
  });
  render(
    <ToastProvider>
      <MemoryRouter>
        <AccrualRunsPage />
      </MemoryRouter>
    </ToastProvider>,
  );
};

describe('Accrual runs', () => {
  it('previews first and executes the previewed run only after confirmation', async () => {
    const posts = [];
    mount(posts);
    expect((await screen.findAllByText('completed')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /New accrual run/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Preview run' }));
    expect((await screen.findAllByText('Asha Rao')).length).toBeGreaterThan(0);
    expect(posts).toEqual([['preview', 'POST']]);
    fireEvent.click(screen.getByRole('button', { name: 'Run accrual' }));
    await waitFor(() => expect(posts).toEqual([['preview', 'POST'], ['execute', 'POST']]));
  });

  it('blocks confirmation when the preview would post nothing', async () => {
    mount([], { ...run, counts: { total: 0, posted: 0, skipped: 0, failed: 0 } });
    await screen.findAllByText('completed');
    fireEvent.click(screen.getByRole('button', { name: /New accrual run/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Preview run' }));
    expect(await screen.findByText('Nothing would be accrued for this window.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run accrual' })).toBeDisabled();
  });

  it('shows Access restricted without accrual permission and loads nothing', () => {
    perms = ['leave.reports.view'];
    mount([]);
    expect(screen.getByText('Access restricted')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });
});
