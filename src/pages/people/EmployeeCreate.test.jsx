import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import EmployeeCreate from './EmployeeCreate';
import { ToastProvider } from '../../components/ui';
import { ApiError, api } from '../../lib/api';
import { buildPayload, firstInvalidStep, validateQuick, validateStep } from '../../components/people/wizard';

let permissions = ['people.manage'];
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ can: (p) => permissions.includes(p), enabled: () => true }),
}));
vi.mock('../../lib/api', async (original) => ({ ...(await original()), api: vi.fn() }));

const Where = () => <p>{useLocation().pathname}</p>;
const mount = (url = '/people/new') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <Routes>
          <Route path="/people/new" element={<EmployeeCreate />} />
          <Route path="/people/:uuid" element={<Where />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  permissions = ['people.manage'];
  window.localStorage.clear();
  api.mockImplementation((path) => {
    if (path.startsWith('/organization/')) return Promise.resolve({ data: [{ id: 1, name: 'Option A' }] });
    if (path.startsWith('/v1/people/numbering')) return Promise.resolve({ mode: 'auto', next: 'E-0042' });
    return Promise.resolve({});
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('wizard validation rules', () => {
  const base = { legal_first_name: 'A', joined_on: '2026-01-01', worker_type: 'employee', country: 'IN', notice_period_days: '' };
  it('requires a first name, joining date and the five organization fields', () => {
    expect(validateStep('name', { legal_first_name: ' ' })).toHaveProperty('legal_first_name');
    expect(validateStep('employment', { ...base, joined_on: '' })).toHaveProperty('joined_on');
    expect(Object.keys(validateStep('organization', {}))).toHaveLength(5);
  });
  it('checks dates, emails and phone formats', () => {
    expect(validateStep('terms', { ...base, probation_start: '2026-05-01', probation_end: '2026-04-01' })).toHaveProperty('probation_end');
    expect(validateStep('contact', { work_email: 'nope' })).toHaveProperty('work_email');
    expect(validateStep('contact', { personal_phone: 'abc' })).toHaveProperty('personal_phone');
    expect(validateStep('personal', { date_of_birth: '2999-01-01' })).toHaveProperty('date_of_birth');
    expect(validateStep('emergency', { em_name: 'Kim' })).toHaveProperty('em_phone');
  });
  it('finds the first invalid step and builds a clean payload', () => {
    expect(firstInvalidStep({ ...base, legal_first_name: '' })).toBe(0);
    expect(Object.keys(validateQuick({}))).toContain('legal_first_name');
    const payload = buildPayload({ ...base, department_id: '3', legal_last_name: '' }, { confirmDuplicates: true });
    expect(payload.person).toEqual({ legal_first_name: 'A' });
    expect(payload.assignment).toEqual({ department_id: 3 });
    expect(payload.confirm_duplicates).toBe(true);
  });
});

describe('Employee create wizard', () => {
  it('blocks a step until it is valid and then advances', async () => {
    mount();
    expect(screen.getByRole('heading', { name: 'Name' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('First name is required.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Name' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Legal first name'), { target: { value: 'Riya' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Personal details' })).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 9: Personal details')).toBeInTheDocument();
  });

  it('saves and restores a draft', () => {
    mount();
    fireEvent.change(screen.getByLabelText('Legal first name'), { target: { value: 'Riya' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(JSON.parse(window.localStorage.getItem('people.employee.draft')).data.legal_first_name).toBe('Riya');
    cleanup();
    mount();
    expect(screen.getByLabelText('Legal first name')).toHaveValue('Riya');
  });

  it('denies users without permission', () => {
    permissions = [];
    mount();
    expect(screen.getByText('Access restricted')).toBeInTheDocument();
  });

  async function fillQuick() {
    api.mockClear();
    mount('/people/new?mode=quick');
    fireEvent.change(await screen.findByLabelText('Legal first name'), { target: { value: 'Riya' } });
    fireEvent.change(screen.getByLabelText('Joining date'), { target: { value: '2026-10-01' } });
    await waitFor(() => expect(api.mock.calls.filter(([p]) => p.startsWith('/organization/'))).toHaveLength(5));
    for (const label of ['Legal entity', 'Department', 'Designation', 'Location', 'Employee type']) {
      fireEvent.click(screen.getByRole('combobox', { name: new RegExp(label) }));
      fireEvent.click(await screen.findByRole('option', { name: 'Option A' }));
    }
  }

  it('quick add validates and posts to quick-add, then opens the profile', async () => {
    mount('/people/new?mode=quick');
    fireEvent.click(await screen.findByRole('button', { name: 'Create employee' }));
    expect(await screen.findByText('First name is required.')).toBeInTheDocument();
    expect(api.mock.calls.some(([p, o]) => o?.method === 'POST')).toBe(false);
    cleanup();
    api.mockImplementation((path, o = {}) => {
      if (path.startsWith('/organization/')) return Promise.resolve({ data: [{ id: 1, name: 'Option A' }] });
      if (path === '/v1/employees/quick-add' && o.method === 'POST') return Promise.resolve({ uuid: 'new1', employee_number: 'E-1' });
      return Promise.resolve({});
    });
    await fillQuick();
    fireEvent.click(screen.getByRole('button', { name: 'Create employee' }));
    expect(await screen.findByText('/people/new1')).toBeInTheDocument();
    const call = api.mock.calls.find(([p]) => p === '/v1/employees/quick-add');
    expect(call[1].body.assignment).toEqual({ legal_entity_id: 1, department_id: 1, designation_id: 1, location_id: 1, employee_type_id: 1 });
  });

  it('handles a 409 duplicate warning and resends with confirmation', async () => {
    let attempts = 0;
    api.mockImplementation((path, o = {}) => {
      if (path.startsWith('/organization/')) return Promise.resolve({ data: [{ id: 1, name: 'Option A' }] });
      if (path === '/v1/employees/quick-add') {
        attempts += 1;
        return o.body.confirm_duplicates
          ? Promise.resolve({ uuid: 'new2' })
          : Promise.reject(Object.assign(new ApiError('This person may already exist. Review the matches before continuing.', 409), { code: 'possible_duplicate' }));
      }
      return Promise.resolve({});
    });
    await fillQuick();
    fireEvent.click(screen.getByRole('button', { name: 'Create employee' }));
    expect(await screen.findByText('Possible duplicate')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /create anyway/ }));
    expect(await screen.findByText('/people/new2')).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it('shows server validation errors inline', async () => {
    api.mockImplementation((path) => {
      if (path.startsWith('/organization/')) return Promise.resolve({ data: [{ id: 1, name: 'Option A' }] });
      if (path === '/v1/employees/quick-add') return Promise.reject(new ApiError('The given data was invalid.', 422, { 'employment.joined_on': ['The joined on must be a date.'] }));
      return Promise.resolve({});
    });
    await fillQuick();
    fireEvent.click(screen.getByRole('button', { name: 'Create employee' }));
    const messages = await screen.findAllByText('The joined on must be a date.');
    expect(messages.length).toBeGreaterThan(0);
  });
});
