import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../../components/ui';
import CareersAdminPage from '../CareersAdminPage';
import { api } from '../../../lib/api';
vi.mock('../../../lib/auth', () => ({ useAuth: () => ({ can: () => true, enabled: () => true }) }));
vi.mock('../../../lib/api', () => ({ api: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('shows the submitted notice before sending an explicit review decision', async () => {
  api.mockImplementation((path, options) => Promise.resolve(options?.method === 'POST' ? { status: 'rejected' } : { data: path.includes('submissions') ? [{ uuid: 's1', name: 'Asha', email: 'asha@example.test', privacy_notice: 'Recruitment only', notice_version: 'v1', consented_at: '2026-10-12' }] : [], current_page: 1, last_page: 1 }));
  render(<MemoryRouter><ToastProvider><CareersAdminPage /></ToastProvider></MemoryRouter>);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText(/Recruitment only/)).toBeInTheDocument();
  expect(api.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/v1/recruitment/submissions/s1/review', expect.objectContaining({ method: 'POST', body: { decision: 'reject', identity_reviewed: false } })));
});
