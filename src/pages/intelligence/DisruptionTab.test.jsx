import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DisruptionTab, defaultWindow, fitPct } from './DisruptionTab';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({ api: vi.fn(), query: (o) => new URLSearchParams(o).toString() }));

const plan = {
  window: { from: '2026-10-12', to: '2026-10-16' },
  min_available_pct: 80,
  limitations: 'Only approved leave and known exits are counted.',
  departments: [{ department: 'Engineering', headcount: 5, shortage_day_count: 2, worst_day: { date: '2026-10-14', available_pct: 60, away: 2, of: 5 }, shortage_days: [] }],
  absences: [
    {
      employee: { uuid: 'e1', name: 'Arun Kumar' },
      department: 'Engineering',
      kind: 'leave',
      from: '2026-10-12',
      to: '2026-10-16',
      in_shortage_department: true,
      delegate: { uuid: 'e3', name: 'Chen Wei' },
      continuity_backups: [{ responsibility: 'Month-end cut-off', criticality: 'critical', backup: { uuid: 'e3', name: 'Chen Wei' } }],
      uncovered_responsibilities: [{ responsibility: 'Vendor calls', criticality: 'high' }],
      candidates: [{ employee: { uuid: 'e3', name: 'Chen Wei' }, skill_fit: 1, covers: ['Python', 'SQL'], free_hours: 12 }],
    },
  ],
};
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  api.mockResolvedValue(plan);
});

it('builds a two week default window and formats skill fit', () => {
  expect(defaultWindow(new Date(2026, 9, 7))).toEqual({ from: '2026-10-07', to: '2026-10-20' });
  expect(fitPct(0.33)).toBe('33%');
});

it('shows shortage days, the delegate, trained backups, gaps and ranked cover', async () => {
  render(<DisruptionTab />);
  expect(await screen.findByText(/2 day\(s\) below 80%/)).toBeInTheDocument();
  expect(screen.getByText(/Lowest: 60% on 2026-10-14 \(2 of 5 away\)/)).toBeInTheDocument();
  expect(screen.getByText('Named delegate:', { exact: false })).toBeInTheDocument();
  expect(screen.getByText(/Trained backup for "Month-end cut-off" \(critical\)/)).toBeInTheDocument();
  expect(screen.getByText(/No trained backup for "Vendor calls" \(high\)/)).toBeInTheDocument();
  expect(screen.getByText(/skill fit 100% \(Python, SQL\) · 12 free h\/week declared/)).toBeInTheDocument();
  expect(screen.getByText('department below threshold')).toBeInTheDocument();
  expect(screen.getByText(/approved leave and known exits are counted/)).toBeInTheDocument();
});

it('explains an empty window', async () => {
  api.mockResolvedValue({ ...plan, absences: [], departments: [] });
  render(<DisruptionTab />);
  expect(await screen.findByText('No approved leave or known exits in this window')).toBeInTheDocument();
});
