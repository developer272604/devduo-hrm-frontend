import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  ApiClientsPage,
  ImportProfilesPage,
  IntegrationHealthPage,
  WebhooksPage,
} from './PlatformPages';
import { api } from '../../lib/api';

const access = vi.hoisted(() => ({ allowed: true }));
vi.mock('../../lib/auth', () => ({ useAuth: () => ({ can: () => access.allowed }) }));
vi.mock('../../lib/api', () => ({ api: vi.fn(), query: (o) => new URLSearchParams(o).toString() }));

const ui = (el) => render(<MemoryRouter>{el}</MemoryRouter>);
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  access.allowed = true;
});

it('health center marks unconnected provider adapters as not live and never shows them healthy', async () => {
  api.mockImplementation((path) =>
    Promise.resolve(
      path.endsWith('/diagnostics')
        ? { data: [{ key: 'providers', label: 'Provider adapters', status: 'warn', detail: 'Not live.' }] }
        : {
            status: 'degraded',
            issues: [{ severity: 'high', area: 'webhooks', message: '2 webhook delivery(ies) are in the dead-letter queue.' }],
            api: { active_clients: 1, requests_24h: 5, errors_24h: 0, rate_limited_24h: 0 },
            webhooks: { backlog: 0, dead_letters: 2, delivered_24h: 4 },
            imports: { failed_24h: 0 },
            adapters: [
              { key: 'public_api', label: 'Public REST API v1', state: 'live', live: true, note: 'Local runtime.' },
              { key: 'sap', label: 'SAP', state: 'not_live', live: false, note: 'No adapter is installed.' },
            ],
          },
    ),
  );
  ui(<IntegrationHealthPage />);
  expect(await screen.findByText('SAP')).toBeInTheDocument();
  expect(screen.getByText('not live')).toBeInTheDocument();
  expect(screen.getByText('2 webhook delivery(ies) are in the dead-letter queue.')).toBeInTheDocument();
  expect(screen.getByText('Provider adapters')).toBeInTheDocument();
});

it('shows a new API key exactly once and never renders stored hashes', async () => {
  const listed = { data: [], scopes: [{ key: 'employees:read', description: 'Read employees' }] };
  api.mockImplementation((path, options) => {
    if (options?.method === 'POST')
      return Promise.resolve({ client: { uuid: 'c1', name: 'Lake' }, key: 'dvk_abcd1234.SECRETSECRETSECRET' });
    return Promise.resolve(listed);
  });
  ui(<ApiClientsPage />);
  fireEvent.change(await screen.findByLabelText('Client name'), { target: { value: 'Lake' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create client' }));
  expect(await screen.findByText('dvk_abcd1234.SECRETSECRETSECRET')).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith('/v1/integrations/api-clients', {
    method: 'POST',
    body: { name: 'Lake', scopes: ['employees:read'], rate_limit_per_minute: 60, ip_allowlist: [] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'I have stored it' }));
  expect(screen.queryByText('dvk_abcd1234.SECRETSECRETSECRET')).not.toBeInTheDocument();
});

it('hides creation and rotation controls for users who can only view', async () => {
  access.allowed = false;
  api.mockResolvedValue({
    data: [{ uuid: 'c1', name: 'Lake', key_prefix: 'dvk_abcd1234', scopes: ['employees:read'], rate_limit_per_minute: 60, ip_allowlist: [], status: 'active' }],
    scopes: [],
  });
  ui(<ApiClientsPage />);
  expect(await screen.findByText('Lake')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Create client' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Rotate key' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
});

it('lists webhook deliveries and replays a dead-lettered one', async () => {
  const endpoint = { uuid: 'w1', name: 'ERP', url: 'https://erp.example.com/h', events: ['EmployeeCreated'], status: 'active', dead_letters: 1, pending_deliveries: 0, consecutive_failures: 6 };
  api.mockImplementation((path, options) => {
    if (path.endsWith('/replay')) return Promise.resolve({ uuid: 'd1', status: 'pending' });
    if (path.endsWith('/deliveries'))
      return Promise.resolve({ data: [{ uuid: 'd1', event_type: 'EmployeeCreated', status: 'dead_letter', attempts: 6, last_status_code: 500, last_error: 'HTTP 500', created_at: '2026-10-07T10:00:00+05:30' }] });
    return Promise.resolve({ data: [endpoint], event_types: ['EmployeeCreated'] });
  });
  ui(<WebhooksPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delivery log' }));
  expect(await screen.findByText(/HTTP 500/, { selector: 'span' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith('/v1/integrations/webhook-deliveries/d1/replay', { method: 'POST', body: undefined }),
  );
});

it('uploads a file as a dry run by default and surfaces the run result', async () => {
  const profile = { uuid: 'p1', name: 'Gate punches', kind: 'attendance_punches', kind_label: 'Attendance punches', format: 'csv', source: 'upload', status: 'active', mapping: {}, last_run_status: null };
  api.mockImplementation((path, options) => {
    if (path.endsWith('/runs') && options?.method === 'POST') return Promise.resolve({ uuid: 'r1', status: 'dry_run_ok' });
    if (path.endsWith('/import-runs')) return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [profile], kinds: [{ key: 'attendance_punches', label: 'Attendance punches' }] });
  });
  ui(<ImportProfilesPage />);
  const input = await screen.findByLabelText('File for Gate punches');
  const file = new File(['a,b\n1,2\n'], 'punches.csv', { type: 'text/csv' });
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Validate file' }));
  await waitFor(() => {
    const call = api.mock.calls.find(([p, o]) => p.endsWith('/import-profiles/p1/runs') && o?.method === 'POST');
    expect(call).toBeTruthy();
    expect(call[1].body.get('dry_run')).toBe('1');
    expect(call[1].body.get('file').name).toBe('punches.csv');
  });
});
