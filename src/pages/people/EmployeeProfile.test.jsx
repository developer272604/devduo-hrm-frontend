import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EmployeeProfile, { buildTabs } from './EmployeeProfile';
import { ToastProvider } from '../../components/ui';
import { ApiError, api } from '../../lib/api';

let permissions = [];
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ can: (p) => permissions.includes(p), enabled: () => true }),
}));
vi.mock('../../lib/api', async (original) => ({
  ...(await original()),
  api: vi.fn(),
  download: vi.fn(),
}));

const profile = (viewer, extra = {}) => ({
  uuid: 'e1',
  header: {
    display_name: 'Alex Morgan',
    employee_number: 'E-001',
    status: 'probation',
    status_label: 'Probation',
    designation: 'Engineer',
    department: 'Platform',
    work_email: 'alex@example.com',
  },
  person: { legal_first_name: 'Alex', preferred_name: 'Al', personal_email: 'al@example.com' },
  employment: { probation: { probation_end: '2026-12-01' } },
  job: {},
  viewer,
  ...extra,
});
let current;
function setup(viewer, handlers = {}) {
  current = profile(viewer);
  api.mockImplementation((path, options = {}) => {
    for (const [prefix, fn] of Object.entries(handlers))
      if (path.startsWith(prefix)) return fn(path, options);
    if (path === '/v1/employees/e1') return Promise.resolve(current);
    if (path.endsWith('/completeness'))
      return Promise.resolve({
        complete: false,
        percentage: 60,
        missing: [{ key: 'documents.id', label: 'Identity proof', detail: 'Upload an ID' }],
      });
    if (path.endsWith('/360')) return Promise.resolve({ sections: [] });
    if (path.includes('/status'))
      return Promise.resolve({ allowed: ['active', 'separated'], data: [] });
    return Promise.resolve({ data: [], viewer: { edit: 'direct' } });
  });
}
const mount = () =>
  render(
    <MemoryRouter initialEntries={['/people/e1']}>
      <ToastProvider>
        <Routes>
          <Route path="/people/:uuid" element={<EmployeeProfile />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
const tabNames = () => screen.getAllByRole('tab').map((t) => t.textContent);

beforeEach(() => {
  permissions = ['people.view'];
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Employee profile', () => {
  it('shows tabs only for the sections the API returns', async () => {
    setup({ sections: ['personal', 'documents', 'notes'], edit: {} });
    mount();
    expect(await screen.findByRole('heading', { name: 'Alex Morgan' })).toBeInTheDocument();
    expect(tabNames()).toEqual([
      'Overview',
      'Personal',
      'Documents',
      'Notes',
      'Timeline',
      'Custom fields',
    ]);
    expect(screen.queryByRole('tab', { name: 'Identity & bank' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Education' })).not.toBeInTheDocument();
  });

  it('builds the combined Contact & address and Identity & bank tabs', () => {
    expect(buildTabs(['address', 'bank']).map((t) => t.label)).toEqual([
      'Overview',
      'Contact & address',
      'Identity & bank',
    ]);
    expect(buildTabs([], false).map((t) => t.label)).toEqual(['Overview']);
  });

  it('is read-only when the edit mode is none', async () => {
    setup({ sections: ['personal'], edit: { personal: 'none' } });
    mount();
    fireEvent.click(await screen.findByRole('tab', { name: 'Personal' }));
    expect(await screen.findByText('This section is read-only for you.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit|Request change/ })).not.toBeInTheDocument();
  });

  it('saves directly in direct mode', async () => {
    const patch = vi.fn(() => Promise.resolve(current));
    setup(
      { sections: ['personal'], edit: { personal: 'direct' } },
      { '/v1/employees/e1/personal': patch },
    );
    mount();
    fireEvent.click(await screen.findByRole('tab', { name: 'Personal' }));
    fireEvent.click(await screen.findByRole('button', { name: /Edit/ }));
    fireEvent.change(await screen.findByLabelText('Preferred name'), { target: { value: 'Lex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith('/v1/employees/e1/personal', {
      method: 'PATCH',
      body: { preferred_name: 'Lex' },
    });
  });

  it('submits a change request in request mode instead of writing', async () => {
    const post = vi.fn(() => Promise.resolve({ uuid: 'cr1' }));
    setup(
      { sections: ['personal'], edit: { personal: 'request' } },
      { '/v1/employees/e1/change-requests': post },
    );
    mount();
    fireEvent.click(await screen.findByRole('tab', { name: 'Personal' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Request change' }));
    fireEvent.change(await screen.findByLabelText('Preferred name'), { target: { value: 'Lex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith('/v1/employees/e1/change-requests', {
      method: 'POST',
      body: {
        section: 'personal',
        operation: 'update',
        requested_value: { preferred_name: 'Lex' },
      },
    });
    expect(api.mock.calls.some(([p]) => p.endsWith('/personal'))).toBe(false);
  });

  it('falls back to a change request when the server says approval is required', async () => {
    const patch = vi.fn(() =>
      Promise.reject(new ApiError('These changes need approval before they apply.', 409)),
    );
    const post = vi.fn(() => Promise.resolve({}));
    setup(
      { sections: ['personal'], edit: { personal: 'direct' } },
      { '/v1/employees/e1/personal': patch, '/v1/employees/e1/change-requests': post },
    );
    mount();
    fireEvent.click(await screen.findByRole('tab', { name: 'Personal' }));
    fireEvent.click(await screen.findByRole('button', { name: /Edit/ }));
    fireEvent.change(await screen.findByLabelText('Preferred name'), { target: { value: 'Lex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(post).toHaveBeenCalled());
  });

  it('offers lifecycle actions only to people managers and only when valid', async () => {
    setup({ sections: ['personal'], edit: {} });
    mount();
    await screen.findByRole('heading', { name: 'Alex Morgan' });
    expect(screen.queryByRole('group', { name: 'Employee actions' })).not.toBeInTheDocument();
    cleanup();
    permissions = ['people.view', 'people.manage', 'people.separate', 'people.invite'];
    mount();
    const group = await screen.findByRole('group', { name: 'Employee actions' });
    expect(group).toHaveTextContent('Confirm probation');
    expect(group).toHaveTextContent('Extend probation');
    expect(group).toHaveTextContent('Separate');
    expect(group).toHaveTextContent('Invite');
    expect(group).not.toHaveTextContent('Rehire');
  });

  it('shows completeness with an actionable missing item that opens the right tab', async () => {
    setup({ sections: ['documents'], edit: {} });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Fix: Identity proof' }));
    expect(
      await screen.findByRole('tab', { name: 'Documents', selected: true }),
    ).toBeInTheDocument();
  });

  it('reveals identity values only after confirmation', async () => {
    permissions = ['people.view', 'people.sensitive.reveal'];
    const reveal = vi.fn(() => Promise.resolve({ uuid: 'i1', number: 'ABCDE1234F' }));
    setup(
      { sections: ['identity'], edit: {} },
      {
        '/v1/employees/e1/identity/i1/reveal': reveal,
        '/v1/employees/e1/identity': () =>
          Promise.resolve({
            data: [
              {
                uuid: 'i1',
                type: 'pan',
                type_label: 'PAN',
                number_masked: '••••234F',
                country: 'IN',
              },
            ],
          }),
      },
    );
    mount();
    fireEvent.click(await screen.findByRole('tab', { name: 'Identity & bank' }));
    expect(await screen.findByText('••••234F')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reveal PAN' }));
    expect(reveal).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Reveal' }));
    expect(await screen.findByText('ABCDE1234F')).toBeInTheDocument();
  });

  it('offers identity edits from the server edit mode without pre-filling the secret number', async () => {
    setup(
      { sections: ['identity'], edit: { identity: 'direct' } },
      {
        '/v1/employees/e1/identity': () =>
          Promise.resolve({
            data: [
              {
                uuid: 'i1',
                type: 'pan',
                type_label: 'PAN',
                number_masked: '••••234F',
                country: 'IN',
              },
            ],
            viewer: { edit: 'direct' },
          }),
        '/v1/people/countries': () => Promise.resolve({ data: [{ code: 'IN', name: 'India' }] }),
        '/v1/people/countries/IN': () =>
          Promise.resolve({ identifier_types: [{ key: 'pan', label: 'PAN', kind: 'identity' }] }),
      },
    );
    mount();
    fireEvent.click(await screen.findByRole('tab', { name: 'Identity & bank' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit PAN' }));
    expect(
      await screen.findByLabelText('Replace number (leave blank to keep current)'),
    ).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Replace number (leave blank to keep current)'), {
      target: { value: 'NEWSECRET' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/v1/employees/e1/identity/i1', {
        method: 'PATCH',
        body: { country: 'IN', number: 'NEWSECRET', type: 'pan' },
      }),
    );
  });

  it('shows a no-permission state when the profile is forbidden', async () => {
    api.mockRejectedValue(new ApiError('You do not have access.', 403));
    mount();
    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });
});
