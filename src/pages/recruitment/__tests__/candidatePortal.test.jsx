import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CandidatePortalPage from '../CandidatePortalPage';
import { api } from '../../../lib/api';
vi.mock('../../../lib/api', () => ({ api: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const show = () => render(<MemoryRouter initialEntries={['/careers/alpha/portal']}><Routes><Route path="/careers/:workspace/portal" element={<CandidatePortalPage />} /></Routes></MemoryRouter>);
it('requests verification, shows only returned status after verification, and signs out', async () => {
  let verified = false;
  api.mockImplementation(async (path) => {
    if (path.endsWith('/code')) return { message: 'If eligible, a code will be emailed.' };
    if (path.endsWith('/verify')) { verified = true; return { verified: true }; }
    if (path.endsWith('/logout')) { verified = false; return null; }
    if (!verified) throw { status: 401, message: 'Verify email' };
    return { name: 'Asha', applications: [{ job_title: 'Engineer', status: 'Under review' }] };
  });
  show();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'asha@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Email verification code' }));
  expect(await screen.findByRole('status')).toHaveTextContent('If eligible');
  fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: 'a'.repeat(64) } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify and view applications' }));
  expect(await screen.findByText('Under review')).toBeInTheDocument();
  expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(screen.queryByText('Under review')).not.toBeInTheDocument());
  expect(api).toHaveBeenCalledWith('/v1/careers/alpha/portal/verify', expect.objectContaining({ sessionEvents: false, body: { email: 'asha@example.test', code: 'a'.repeat(64) } }));
});
it('reports an unavailable portal without claiming email delivery', async () => {
  api.mockRejectedValue({ status: 503, message: 'Candidate portal access is not enabled.' });
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent('Candidate portal access is not enabled.');
  expect(screen.queryByText('Under review')).not.toBeInTheDocument();
});
it('requires a reason and confirmation before withdrawing an application', async () => {
  let withdrawn = false;
  api.mockImplementation(async (path) => {
    if (path.endsWith('/withdraw')) { withdrawn = true; return { status: 'Withdrawn' }; }
    return { name: 'Asha', applications: [{ uuid: 'a1', job_title: 'Engineer', status: withdrawn ? 'Withdrawn' : 'Under review', can_withdraw: !withdrawn }] };
  });
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Withdraw application for Engineer' }));
  expect(api.mock.calls.some(([path]) => path.endsWith('/withdraw'))).toBe(false);
  fireEvent.change(screen.getByLabelText('Withdrawal reason'), { target: { value: 'Plans changed' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm withdrawal' }));
  expect(await screen.findByText('Withdrawn')).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith('/v1/careers/alpha/portal/applications/a1/withdraw', expect.objectContaining({ method: 'POST', body: { confirmed: true, reason: 'Plans changed' } }));
});
