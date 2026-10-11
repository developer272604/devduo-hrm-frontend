import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CareersPage from '../CareersPage';
import { api } from '../../../lib/api';
vi.mock('../../../lib/api', () => ({ api: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const listing = { company: 'Alpha', jobs: { data: [{ uuid: 'j1', title: 'Engineer', description: 'Build software', notice_version: 'v1', privacy_notice: 'Recruitment only' }], last_page: 1 } };
it('submits an application with explicit consent and the displayed notice version', async () => {
  api.mockImplementation((path, options) => Promise.resolve(options?.method === 'POST' ? { message: 'Received for review' } : listing));
  render(<MemoryRouter initialEntries={['/careers/alpha']}><Routes><Route path="/careers/:workspace" element={<CareersPage />} /></Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Apply for Engineer' }));
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Asha Rao' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'asha@example.test' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/v1/careers/alpha/jobs/j1/apply', expect.objectContaining({ method: 'POST', body: expect.objectContaining({ name: 'Asha Rao', email: 'asha@example.test', consent: true, notice_version: 'v1' }) })));
  expect(await screen.findByRole('status')).toHaveTextContent('Received for review');
});
it('shows closed or unavailable workspace errors without an application form', async () => {
  api.mockRejectedValue({ status: 404, message: 'Not found' });
  render(<MemoryRouter initialEntries={['/careers/missing']}><Routes><Route path="/careers/:workspace" element={<CareersPage />} /></Routes></MemoryRouter>);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Submit application' })).not.toBeInTheDocument();
});
