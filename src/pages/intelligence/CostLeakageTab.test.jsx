import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CostLeakageTab, exposureText } from './CostLeakageTab';
import { api } from '../../lib/api';

vi.mock('../../lib/auth', () => ({ useAuth: () => ({ session: { user: { id: 7 } } }) }));
vi.mock('../../lib/api', () => ({ api: vi.fn(), query: (o) => new URLSearchParams(o).toString() }));

const kase = {
  uuid: 'c1',
  rule: 'Possible duplicate expense',
  rule_code: 'duplicate_expense',
  severity: 'action_required',
  title: 'Cafe on 2026-10-02: same amount claimed 2 times',
  summary: 'The same employee claimed an identical merchant, date and amount more than once.',
  status: 'open',
  window: { from: '2026-10-01', to: '2026-10-07' },
  exposure: { amount: 100, currency: 'INR', minutes: null, recovered_amount: null },
  owner: null,
  has_task: false,
};
const listBody = {
  count: 1,
  items: [kase],
  rules: [{ code: 'duplicate_expense', label: 'Possible duplicate expense' }],
  summary: {
    open_cases: 1,
    open_exposure_by_currency: { INR: 100 },
    open_exposure_minutes: 0,
    confirmed_cases: 0,
    confirmed_exposure_by_currency: {},
    recovered_by_currency: {},
    precision: null,
  },
  limitations: 'Cases are deterministic leads.',
};
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  api.mockResolvedValue(listBody);
});

it('formats exposure as money and/or hours', () => {
  expect(exposureText({ amount: 4500, currency: 'INR', minutes: null })).toBe('INR 4,500');
  expect(exposureText({ amount: null, currency: null, minutes: 180 })).toBe('3.0 h');
  expect(exposureText({ amount: null, currency: null, minutes: null })).toBe('n/a');
});

it('shows cases with exposure and an unreviewed-estimate note, and hides actions without manage permission', async () => {
  render(<CostLeakageTab canManage={false} />);
  expect(await screen.findByText(kase.title)).toBeInTheDocument();
  expect(screen.getByText(/Exposure: INR 100/)).toBeInTheDocument();
  expect(screen.getByText('Estimate until reviewed')).toBeInTheDocument();
  expect(screen.getByText(/Precision shown after 5 reviewed cases/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Scan this month' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Assign to me' })).not.toBeInTheDocument();
});

it('requires a reason to confirm a case and posts it', async () => {
  render(<CostLeakageTab canManage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mark confirmed' }));
  expect(screen.getByLabelText('Reason')).toBeRequired();
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Identical receipts' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      expect.stringContaining('/v1/intelligence/leakage/c1/status'),
      expect.objectContaining({ method: 'POST' }),
    ),
  );
});
