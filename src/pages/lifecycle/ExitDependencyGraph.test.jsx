import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ExitDependencyGraph, layers } from './ExitDependencyGraph';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({ api: vi.fn(), query: (o) => new URLSearchParams(o).toString() }));

const n = (key, label, state, extra = {}) => ({ key, label, state, blockers: [], depends_on: [], blocked_by: [], unchecked_by: [], ...extra });
const graph = {
  settlement_state: 'blocked',
  limitations: 'This view is informational.',
  next_actions: [{ key: 'assets', label: 'Assets returned', blockers: ['1 assigned or lost asset(s) need custody resolution before exit clearance.'] }],
  nodes: [
    n('assets', 'Assets returned', 'blocked', { blockers: ['1 assigned or lost asset(s) need custody resolution before exit clearance.'] }),
    n('loans', 'Loans and advances', 'not_checked'),
    n('settlement', 'Final settlement', 'blocked', { depends_on: ['assets', 'loans'], blocked_by: ['assets'], unchecked_by: ['loans'] }),
    n('access', 'Access removal', 'blocked', { depends_on: ['settlement'], blocked_by: ['settlement'] }),
  ],
};
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  api.mockResolvedValue(graph);
});

it('layers nodes by how many steps they wait behind', () => {
  const l = layers(graph.nodes);
  expect(l.map((x) => x.map((y) => y.key))).toEqual([['assets', 'loans'], ['settlement'], ['access']]);
});

it('shows what is blocked, what could not be checked, and where to start', async () => {
  render(<ExitDependencyGraph employeeUuid="e1" />);
  expect(await screen.findByText(/Start with: Assets returned/)).toBeInTheDocument();
  expect(screen.getByText(/1 assigned or lost asset\(s\) need custody resolution/, { selector: 'p' })).toBeInTheDocument();
  expect(screen.getByText('not checked here')).toBeInTheDocument();
  expect(screen.getByText(/Held up by: Assets returned/)).toBeInTheDocument();
  expect(screen.getByText(/Cannot confirm: Loans and advances/)).toBeInTheDocument();
  expect(screen.getByText('CHECKS')).toBeInTheDocument();
  expect(screen.getByText('FINALLY')).toBeInTheDocument();
  expect(screen.getByText(/informational/)).toBeInTheDocument();
});

it('shows a ready-with-unchecked state honestly', async () => {
  api.mockResolvedValue({ ...graph, settlement_state: 'ready_unchecked', next_actions: [], nodes: [n('loans', 'Loans and advances', 'not_checked'), n('settlement', 'Final settlement', 'ready_unchecked', { depends_on: ['loans'], unchecked_by: ['loans'] })] });
  render(<ExitDependencyGraph employeeUuid="e1" />);
  expect((await screen.findAllByText('ready, with unchecked items')).length).toBeGreaterThan(0);
});
