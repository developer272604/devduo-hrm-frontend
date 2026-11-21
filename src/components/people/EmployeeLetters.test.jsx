import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../../lib/api';
import { ToastProvider } from '../ui';
import EmployeeLetters from './EmployeeLetters';

vi.mock('../../lib/api', async (load) => ({ ...(await load()), api: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('issues a saved letter template from the employee profile', async () => {
  api.mockImplementation(async (_path, options) =>
    options?.method === 'POST'
      ? { uuid: 'letter1' }
      : {
          issued: {
            data: [
              {
                uuid: 'issued1',
                title: 'Appointment',
                kind: 'appointment',
                version: 1,
                created_at: '2026-11-21T00:00:00Z',
              },
            ],
            last_page: 1,
          },
          templates: [{ uuid: 'template1', kind: 'appointment', title: 'Appointment', version: 2 }],
          can_manage_templates: true,
        },
  );
  render(
    <ToastProvider>
      <EmployeeLetters uuid="emp1" />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'HR letters' }));
  expect(await screen.findByRole('link', { name: 'Print', exact: true })).toHaveAttribute(
    'href',
    '/api/v1/employees/emp1/letters/issued1/download?format=print',
  );
  expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute(
    'href',
    '/api/v1/employees/emp1/letters/issued1/download?format=pdf',
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Issue appointment letter' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Request employee signature' }));
  fireEvent.click(screen.getByRole('button', { name: 'Issue letter', exact: true }));
  expect(await screen.findByText('Letter issued.')).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith('/v1/employees/emp1/letters', {
    method: 'POST',
    body: { template: 'template1', signature_requested: true },
  });
});

it('lets the employee review and sign a requested letter', async () => {
  let signedAt = null;
  api.mockImplementation(async (_path, { method } = {}) => {
    if (method === 'POST') {
      signedAt = '2026-11-21 10:00:00';
      return { signed_at: signedAt };
    }
    return {
      issued: { data: [{
        uuid: 'issued1', title: 'Appointment', kind: 'appointment', version: 1,
        created_at: '2026-11-21 08:00:00', signature_requested: true, signed_at: signedAt,
      }], last_page: 1 },
      templates: [],
      can_acknowledge: true,
    };
  });
  render(<ToastProvider><EmployeeLetters uuid="emp1" /></ToastProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'HR letters' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Sign letter' }));
  expect(screen.getByRole('link', { name: 'Review letter in a new tab' })).toHaveAttribute(
    'href', '/api/v1/employees/emp1/letters/issued1/download?format=print',
  );
  fireEvent.change(screen.getByLabelText('Full name as shown in your employee record'), { target: { value: 'Asha Rao' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /I have reviewed this letter/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Sign electronically' }));
  expect(await screen.findByText('Signed 2026-11-21')).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith('/v1/employees/emp1/letters/issued1/sign', {
    method: 'POST', body: { signer_name: 'Asha Rao', consent: true },
  });
});

it('asks for confirmation and refreshes the status when the employee acknowledges receipt', async () => {
  let acknowledgedAt = null;
  api.mockImplementation(async (_path, options) => {
    if (options?.method === 'POST') {
      acknowledgedAt = '2026-11-21 09:00:00';
      return { acknowledged_at: acknowledgedAt };
    }
    return {
      issued: {
        data: [
          {
            uuid: 'issued1',
            title: 'Appointment',
            kind: 'appointment',
            version: 1,
            created_at: '2026-11-21 08:00:00',
            acknowledged_at: acknowledgedAt,
          },
        ],
        last_page: 1,
      },
      templates: [],
      can_acknowledge: true,
    };
  });
  render(
    <ToastProvider>
      <EmployeeLetters uuid="emp1" />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'HR letters' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge receipt' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm receipt' }));
  expect(await screen.findByText('Received 2026-11-21')).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith('/v1/employees/emp1/letters/issued1/acknowledge', {
    method: 'POST',
    body: { acknowledged: true },
  });
  expect(screen.queryByRole('button', { name: 'Acknowledge receipt' })).not.toBeInTheDocument();
});
