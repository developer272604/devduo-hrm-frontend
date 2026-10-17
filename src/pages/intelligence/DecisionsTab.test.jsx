import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DecisionsTab, defaultPeriod, hoursText } from './DecisionsTab';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({ api: vi.fn(), query: (o) => new URLSearchParams(o).toString() }));

const report = {
  scope: 'company',
  target_hours: 48,
  minimum_decisions: 10,
  withheld_people: 2,
  limitations: 'People with fewer than 10 decisions are not shown.',
  rows: [{ person: { id: 1, name: 'Meera Rao', is_you: true }, decisions: 12, median_hours: 35, slower_than_target_pct: 50, approved_pct: 83.3 }],
};
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  api.mockResolvedValue(report);
});

it('builds a 90 day default period and words durations', () => {
  expect(defaultPeriod(new Date(2026, 9, 7))).toEqual({ from: '2026-07-10', to: '2026-10-07' });
  expect(hoursText(35)).toBe('35 h');
  expect(hoursText(72)).toBe('3.0 days');
});

it('shows response behaviour with a not-a-rating notice and counts people withheld without naming them', async () => {
  render(<DecisionsTab />);
  expect(await screen.findByText('Meera Rao')).toBeInTheDocument();
  expect(screen.getByText('you')).toBeInTheDocument();
  expect(screen.getByText('35 h')).toBeInTheDocument();
  expect(screen.getByText('50%')).toBeInTheDocument();
  expect(screen.getByText(/not a performance rating/)).toBeInTheDocument();
  expect(screen.getByText(/2 other approver\(s\) have too few decisions to show/)).toBeInTheDocument();
});

it('explains an empty result', async () => {
  api.mockResolvedValue({ ...report, rows: [], withheld_people: null, scope: 'own' });
  render(<DecisionsTab />);
  expect(await screen.findByText('Not enough decisions yet')).toBeInTheDocument();
});
