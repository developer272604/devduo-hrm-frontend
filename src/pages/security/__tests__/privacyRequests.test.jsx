import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../../../lib/api';
import { ToastProvider } from '../../../components/ui';
import PrivacyRequestsPage from '../PrivacyRequestsPage';

vi.mock('../../../lib/api', async (load) => ({ ...(await load()), api: vi.fn() }));
const auth = vi.hoisted(() => ({ privacy_management: false }));
vi.mock('../../../lib/auth', () => ({
  useAuth: () => ({ session: auth }),
}));

afterEach(() => {
  cleanup();
  auth.privacy_management = false;
  vi.resetAllMocks();
});

it('submits a private request with a retry key and shows it in the employee list', async () => {
  let rows = [];
  api.mockImplementation(async (_path, request) => {
    if (request?.method === 'POST') {
      rows = [{ ...request.body, uuid: 'pr1', status: 'submitted', created_at: '2026-11-21' }];
      return rows[0];
    }
    return { data: rows, last_page: 1 };
  });
  render(
    <ToastProvider>
      <PrivacyRequestsPage />
    </ToastProvider>,
  );
  expect(screen.queryByRole('tab', { name: 'Review queue' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'New privacy request' }));
  fireEvent.click(screen.getByRole('combobox', { name: /Request type/ }));
  fireEvent.click(screen.getByRole('option', { name: 'Correct my data' }));
  fireEvent.change(screen.getByLabelText('Request details'), {
    target: { value: 'Correct my mailing address.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));
  expect(await screen.findByText('Privacy request submitted.')).toBeInTheDocument();
  expect(await screen.findByText('Correct my mailing address.')).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith('/v1/security/privacy-requests', {
    method: 'POST',
    body: {
      kind: 'correction',
      details: 'Correct my mailing address.',
      request_key: expect.any(String),
    },
  });
});

it('sends the loaded version with an administrator decision', async () => {
  auth.privacy_management = true;
  api.mockImplementation(async (path, request) => {
    if (request?.method === 'POST') return { uuid: 'pr1', status: 'completed' };
    if (path.includes('privacy-review'))
      return {
        last_page: 1,
        data: [
          {
            uuid: 'pr1',
            kind: 'access',
            status: 'in_review',
            version: 2,
            requester: 'Asha Rao',
            details: 'Please share my record.',
            created_at: '2026-11-21',
          },
        ],
      };
    return { data: [], last_page: 1 };
  });
  render(
    <ToastProvider>
      <PrivacyRequestsPage />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Review queue' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Review request' }));
  fireEvent.click(screen.getByRole('combobox', { name: /Decision/ }));
  fireEvent.click(screen.getByRole('option', { name: 'Complete' }));
  fireEvent.change(screen.getByLabelText('Message to requester'), {
    target: { value: 'Shared privately.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save decision' }));
  expect(await screen.findByText('Privacy request updated.')).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith('/v1/security/privacy-review/pr1', {
    method: 'POST',
    body: { status: 'completed', outcome: 'Shared privately.', version: 2 },
  });
});
