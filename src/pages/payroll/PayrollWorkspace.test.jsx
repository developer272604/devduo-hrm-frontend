import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PayrollWorkspace from './PayrollWorkspace';
import { api } from '../../lib/api';
const access = vi.hoisted(() => ({ allowed: true }));
vi.mock('../../lib/auth', () => ({ useAuth: () => ({ can: () => access.allowed, enabled: () => true }) }));
vi.mock('../../lib/api', () => ({ api: vi.fn() }));
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); access.allowed = true; });

it('shows blocked readiness without implying payroll can be paid', async () => {
  api.mockResolvedValue({ state: 'blocked', issues: [{ code: 'leave', message: 'Leave outputs are not finalized.' }] });
  render(<PayrollWorkspace />);
  expect(await screen.findByText('Payroll readiness: blocked')).toBeInTheDocument();
  expect(screen.getByText('Leave outputs are not finalized.')).toBeInTheDocument();
});

it('denies access without fetching confidential records', () => {
  access.allowed = false; render(<PayrollWorkspace />);
  expect(screen.getByText('Your role does not have payroll access.')).toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();
});

it('runs the simulator with decimal strings and displays the server result', async () => {
  api.mockImplementation((path) => Promise.resolve(path.endsWith('/simulate') ? { result: '35000.00' } : { state: 'blocked', issues: [] }));
  render(<PayrollWorkspace />);
  fireEvent.click(screen.getByRole('tab', { name: 'Simulator' }));
  fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
  expect(await screen.findByText('Result: 35000.00')).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith('/v1/payroll/simulate', { method: 'POST', body: { expression: 'BASE / WORKING_DAYS * PAYABLE_DAYS', variables: { BASE: '35000.00', WORKING_DAYS: '30', PAYABLE_DAYS: '30', OVERTIME_UNITS: '0' } } });
});

it('opens the component form and preserves server validation errors', async () => {
  api.mockImplementation((path, options) => options?.method === 'POST' ? Promise.reject({ message: 'Invalid', errors: { effective_from: ['Component version effective dates overlap.'] } }) : Promise.resolve({ data: [], last_page: 1 }));
  render(<PayrollWorkspace />); fireEvent.click(screen.getByRole('tab', { name: 'Components' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add components' }));
  const dialog = screen.getByRole('dialog', { name: 'Add components' });
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Base' } });
  fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'BASE' } });
  fireEvent.change(screen.getByLabelText('Effective from'), { target: { value: '2026-10-01' } });
  fireEvent.submit(dialog.querySelector('form'));
  expect(await screen.findByText('Component version effective dates overlap.')).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
