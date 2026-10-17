import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ContinuityPage, { gapText } from './ContinuityPage';
import { api } from '../../lib/api';

const access = vi.hoisted(() => ({ perms: [] }));
vi.mock('../../lib/auth', () => ({ useAuth: () => ({ can: (p) => !p || p.split('|').some((k) => access.perms.includes(k)) }) }));
vi.mock('../../lib/api', () => ({ api: vi.fn(), query: (o) => new URLSearchParams(o).toString() }));

const item = { uuid: 'r1', title: 'Month-end payroll cut-off', criticality: 'critical', gaps: ['no_backup', 'undocumented'], covered: false, owner: { uuid: 'e1', name: 'Arun Kumar' }, backup: null, backup_trained: false, documentation_ref: null };
const risk = {
  summary: { urgent: 1, plan: 0, standing: 0, responsibilities_recorded: 1 },
  limitations: 'A responsibility nobody recorded does not appear.',
  owners: [{ owner: { uuid: 'e1', name: 'Arun Kumar' }, level: 'urgent', exit: { date: '2026-11-06', days_left: 30, source: 'resignation pending' }, responsibilities: 1, uncovered: 1, critical_uncovered: 1, items: [item] }],
};
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  access.perms = ['lifecycle.continuity.view', 'lifecycle.continuity.manage'];
  api.mockImplementation((path) => Promise.resolve(path.includes('/risk') ? risk : path.includes('/responsibilities') ? { items: [item] } : { data: [] }));
});

it('words gaps for people', () => {
  expect(gapText([])).toBe('covered');
  expect(gapText(['no_backup', 'undocumented'])).toBe('no backup, not documented');
});

it('shows who is leaving, when, and what is uncovered', async () => {
  render(<ContinuityPage />);
  expect(await screen.findByText('Arun Kumar')).toBeInTheDocument();
  expect(screen.getByText('urgent', { selector: 'span' })).toBeInTheDocument();
  expect(screen.getByText(/Leaving 2026-11-06 \(30 days, resignation pending\)/)).toBeInTheDocument();
  expect(screen.getByText('no backup, not documented')).toBeInTheDocument();
  expect(screen.getByText(/nobody recorded does not appear/)).toBeInTheDocument();
});

it('opens handover tasks and reports how many were new', async () => {
  api.mockImplementation((path, opts) => Promise.resolve(path.includes('/handover/') ? { created: 3, already_open: 1 } : path.includes('/risk') ? risk : { items: [item] }));
  render(<ContinuityPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Open handover tasks' }));
  expect(await screen.findByText(/3 follow-up task\(s\) opened, 1 already open/)).toBeInTheDocument();
  await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('/handover/e1'), expect.objectContaining({ method: 'POST' })));
});

it('hides management actions for viewers', async () => {
  access.perms = ['lifecycle.continuity.view'];
  render(<ContinuityPage />);
  await screen.findByText('Arun Kumar');
  expect(screen.queryByRole('button', { name: 'Open handover tasks' })).not.toBeInTheDocument();
});
