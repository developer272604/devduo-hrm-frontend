import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ImpactPage, defaultRange, fmtNum, monthKey } from './ImpactPage';
import { api } from '../../lib/api';

const access = vi.hoisted(() => ({ perms: [] }));
vi.mock('../../lib/auth', () => ({ useAuth: () => ({ can: (p) => !p || p.split('|').some((k) => access.perms.includes(k)), enabled: () => true }) }));
vi.mock('../../lib/api', () => ({ api: vi.fn(), query: (o) => new URLSearchParams(o).toString() }));

const metric = { uuid: 'm1', code: 'orders', name: 'Orders', unit: 'orders', kind: 'output', active: true };
const report = (over = {}) => ({
  period: { from: '2026-08', to: '2026-09' },
  months: ['2026-08', '2026-09'],
  cost_available: true,
  cost_note: null,
  limitations: 'They do not show that one caused the other.',
  metrics: [
    {
      ...metric,
      summary: { months_with_results: 2, months_with_ratio: 2, headline_ratio: 'cost_per_unit', first: { month: '2026-08', value: 50 }, last: { month: '2026-09', value: 25 }, change_percent: -50 },
      series: [
        { month: '2026-08', partial: false, value: 100, headcount: 5, per_head: 20, cost: { gross: 5000.5, currency: 'INR' }, cost_per_unit: 50 },
        { month: '2026-09', partial: false, value: 220, headcount: 5, per_head: 44, cost: { gross: 5500, currency: 'INR' }, cost_per_unit: 25 },
      ],
    },
  ],
  ...over,
});
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  access.perms = ['analytics.impact.view'];
  api.mockImplementation((path) => Promise.resolve(path.includes('/report') ? report() : { items: [metric] }));
});

it('builds a six month default range and formats numbers', () => {
  expect(defaultRange(new Date(2026, 9, 7))).toEqual({ from: '2026-05', to: '2026-10' });
  expect(monthKey(new Date(2026, 0, 31))).toBe('2026-01');
  expect(fmtNum(null)).toBe('n/a');
  expect(fmtNum(12.3456)).toBe((12.35).toLocaleString(undefined, { maximumFractionDigits: 2 }));
});

it('shows the cost ratio trend and the correlation caveat', async () => {
  render(<ImpactPage />);
  expect(await screen.findByText(/Payroll cost per unit:/)).toBeInTheDocument();
  expect(screen.getByText('-50%')).toBeInTheDocument();
  expect(screen.getByText(/do not show that one caused the other/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'New result' })).not.toBeInTheDocument();
});

it('explains when cost is hidden because payroll access is missing', async () => {
  api.mockImplementation((path) => Promise.resolve(path.includes('/report') ? report({ cost_available: false, cost_note: 'You do not have access to payroll totals, so workforce cost is not shown.' }) : { items: [metric] }));
  render(<ImpactPage />);
  expect(await screen.findByText(/do not have access to payroll totals/)).toBeInTheDocument();
});

it('previews a CSV and only enables saving when every row is valid', async () => {
  access.perms = ['analytics.impact.view', 'analytics.impact.manage'];
  api.mockImplementation((path, opts) => {
    if (path.includes('/import')) return Promise.resolve({ committed: opts.body.commit, rows_total: 2, rows_valid: 1, rows_with_errors: 1, errors: [{ row: 3, error: 'Unknown metric code "ghost".' }], rows_written: 0 });
    return Promise.resolve(path.includes('/report') ? report() : { items: [metric] });
  });
  render(<ImpactPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Import CSV' }));
  fireEvent.click(screen.getByRole('button', { name: 'Check file' }));
  expect(await screen.findByText(/Row 3: Unknown metric code/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save all rows' })).toBeDisabled();
  await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('/import'), expect.objectContaining({ method: 'POST', body: expect.objectContaining({ commit: false }) })));
});
