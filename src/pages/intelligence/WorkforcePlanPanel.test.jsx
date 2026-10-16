import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WorkforcePlanPanel, buildPlanBody } from './WorkforcePlanPanel';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({ api: vi.fn(), query: (o) => new URLSearchParams(o).toString() }));

const base = { title: '', months: '12', attrition: '12', low: '', high: '', avgCost: '', currency: 'INR', budget: '', baseline: '', alternatives: [{ name: 'A', backfill: false, backfill_lead_months: '2', waves: [] }] };
const result = {
  read_only: true,
  result: {
    currency: 'INR',
    baseline_headcount: 100,
    baseline_source: 'working employees inside your data scope',
    assumptions: { annual_attrition_pct: { low: 6, base: 12, high: 18 } },
    method: 'Expected-value arithmetic.',
    limitations: 'This is a what-if model, not a forecast.',
    alternatives: [
      { name: 'Do nothing', vs_first: null, cases: { low: { end_headcount: 94 }, base: { end_headcount: 88, end_effective_fte: 88, total_cost: null, months_over_budget: null }, high: { end_headcount: 82 } } },
      { name: 'Hire 5', vs_first: { headcount: 5, total_cost: 250000 }, cases: { low: { end_headcount: 99 }, base: { end_headcount: 93, end_effective_fte: 92.5, total_cost: 5000000, months_over_budget: 2 }, high: { end_headcount: 87 } } },
    ],
  },
};
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

it('omits empty optional fields so server defaults apply, and keeps numbers numeric', () => {
  const b = buildPlanBody({ ...base, avgCost: '50000' });
  expect(b.params).toEqual({ months: 12, annual_attrition_pct: 12, avg_monthly_cost: 50000, currency: 'INR', alternatives: [{ name: 'A', backfill: false, waves: [] }] });
  expect(b.title).toBeUndefined();
  const w = buildPlanBody({ ...base, alternatives: [{ name: 'B', backfill: true, backfill_lead_months: '3', waves: [{ month: '1', count: '5', monthly_cost: '', lead_time_months: '2', ramp_months: '0' }] }] });
  expect(w.params.alternatives[0]).toEqual({ name: 'B', backfill: true, backfill_lead_months: 3, waves: [{ month: 1, count: 5, lead_time_months: 2, ramp_months: 0 }] });
});

it('compares options with the attrition range, change versus the first, and the not-a-forecast notice', async () => {
  api.mockResolvedValue(result);
  render(<WorkforcePlanPanel />);
  fireEvent.click(screen.getByRole('button', { name: 'Compare options' }));
  expect(await screen.findByText('94 / 88 / 82')).toBeInTheDocument();
  expect(screen.getByText('99 / 93 / 87')).toBeInTheDocument();
  expect(screen.getByText(`+5 people, cost INR ${(250000).toLocaleString()}`)).toBeInTheDocument();
  expect(screen.getByText('no budget set')).toBeInTheDocument();
  expect(screen.getByText(/not a forecast/)).toBeInTheDocument();
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      expect.stringContaining('/v1/intelligence/scenarios'),
      expect.objectContaining({ method: 'POST', body: expect.objectContaining({ kind: 'workforce_plan' }) }),
    ),
  );
});

it('limits the form to four options', () => {
  render(<WorkforcePlanPanel />);
  const add = screen.getByRole('button', { name: 'Add option' });
  fireEvent.click(add);
  fireEvent.click(add);
  expect(add).toBeDisabled();
  expect(screen.getAllByText(/^Option \d$/)).toHaveLength(4);
});
