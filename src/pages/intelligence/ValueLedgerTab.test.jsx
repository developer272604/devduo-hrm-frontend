import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ValueLedgerTab, defaultRange, moneyMap } from './ValueLedgerTab';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({ api: vi.fn(), query: (o) => new URLSearchParams(o).toString() }));

const report = {
  period: { from: '2026-08', to: '2026-09' },
  months: [
    { month: '2026-08', verified_recovered: { INR: 200 }, estimated_hours_saved: 0, estimated_value: {}, claimed: { amount: {}, hours: 0, entries: 0 } },
    { month: '2026-09', verified_recovered: { INR: 4500 }, estimated_hours_saved: 4.5, estimated_value: { INR: 1800 }, claimed: { amount: { INR: 5000 }, hours: 10, entries: 1 } },
  ],
  totals: { verified_recovered: { INR: 4700 }, identified_not_yet_recovered: { INR: 800 }, estimated_hours_saved: 4.5, estimated_value: { INR: 1800 }, claimed_amount: { INR: 5000 }, claimed_hours: 10 },
  verified_cases: [{}, {}, {}],
  estimates: [],
  claims: [{ uuid: 'c1', title: 'Avoided agency fee', month: '2026-09', amount: 5000, currency: 'INR', hours: 10, basis: 'Agency quote versus hiring internally', by: 'Asha' }],
  confidence_note: 'They are shown separately and never added together.',
  limitations: 'Estimates are only as good as the assumed minutes.',
};
const assumptions = { items: [{ definition_uuid: 'd1', name: 'Joiner setup', published: true, assumption: null }] };
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  api.mockImplementation((path) => Promise.resolve(path.includes('/report') ? report : assumptions));
});

it('formats money maps and builds a six month range', () => {
  expect(moneyMap({})).toBe('none');
  expect(moneyMap({ INR: 4700 })).toBe(`INR ${(4700).toLocaleString()}`);
  expect(defaultRange(new Date(2026, 9, 7))).toEqual({ from: '2026-05', to: '2026-10' });
});

it('keeps verified, estimated, identified and claimed values apart and labelled', async () => {
  render(<ValueLedgerTab canManage={false} />);
  expect(await screen.findByText(`INR ${(4700).toLocaleString()}`)).toBeInTheDocument();
  expect(screen.getByText('verified')).toBeInTheDocument();
  expect(screen.getByText('estimated')).toBeInTheDocument();
  expect(screen.getByText('not yet recovered')).toBeInTheDocument();
  expect(screen.getByText(/never added together/)).toBeInTheDocument();
  expect(screen.getByText(/no assumption, so no time saving is counted/)).toBeInTheDocument();
  expect(screen.getByText(/Basis: Agency quote versus hiring internally/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Record a claim' })).not.toBeInTheDocument();
});

it('requires a written basis when setting an assumption', async () => {
  render(<ValueLedgerTab canManage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Set' }));
  expect(screen.getByLabelText(/How did you arrive at the minutes/)).toBeRequired();
  fireEvent.change(screen.getByLabelText(/Minutes saved each time/), { target: { value: '45' } });
  fireEvent.change(screen.getByLabelText(/How did you arrive at the minutes/), { target: { value: 'Timed five recent manual onboardings' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save assumption' }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      expect.stringContaining('/assumptions/d1'),
      expect.objectContaining({ method: 'PUT', body: expect.objectContaining({ minutes_per_run: 45, basis: 'Timed five recent manual onboardings' }) }),
    ),
  );
});
