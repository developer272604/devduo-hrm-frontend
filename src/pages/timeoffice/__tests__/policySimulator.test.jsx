import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
import { api } from '../../../lib/api';
import { mockApi, choose } from './helpers';
import PolicySimulator from '../../../components/timeoffice/PolicySimulator';
import { ToastProvider } from '../../../components/ui';

afterEach(cleanup);
beforeEach(() => {
  api.mockReset();
});
const policies = [{ uuid: 'p1', name: 'General policy', versions: [{ id: 7, version: 2, status: 'draft' }] }];
const result = {
  data: {
    summary: { records: 120, changed: 9, unchanged: 111, employees: 12, by_field: { late_minutes: 6, status: 3 }, by_transition: [{ from: 'present', to: 'late', count: 3, message: 'Present becomes late' }], messages: [] },
    examples: [{ employee_uuid: 'e1', date: '2026-10-01', differences: [{ field: 'late_minutes', before: 0, after: 8 }] }],
    writes: false,
  },
};

describe('Policy simulator', () => {
  it('runs against the draft rules and summarises the impact without writing', async () => {
    const posts = [];
    mockApi(api, {
      '/organization/departments': { data: [] },
      '/attendance-policies/p1/versions/2': { data: { rules: { late: { grace_minutes: 10, grace_mode: 'beyond_grace' } }, effective_rules: { late: { grace_minutes: 10, grace_mode: 'beyond_grace' } } } },
      '/attendance-policies/simulate': (p, o) => (posts.push(JSON.parse(JSON.stringify(o.body))), result),
    });
    render(<ToastProvider><PolicySimulator policies={policies} /></ToastProvider>);
    expect(screen.getByRole('button', { name: 'Run simulation' })).toBeDisabled();
    choose('Policy', 'General policy');
    choose('Version to start from', 'v2 (draft)');
    const grace = await screen.findByRole('spinbutton', { name: /Grace \(minutes\)/ }, { timeout: 2000 }).catch(() => null);
    expect(grace ?? (await screen.findAllByRole('spinbutton', { name: /Grace/ }))[0]).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run simulation' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
    const summary = await screen.findByTestId('simulation-result');
    expect(within(summary).getByText('Nothing was changed')).toBeInTheDocument();
    expect(within(summary).getByText('days that change')).toBeInTheDocument();
    expect(within(summary).getByText('9')).toBeInTheDocument();
    expect(within(summary).getAllByText(/late minutes: 0 to 8/i).length).toBeGreaterThan(0);
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ version_id: 7, scope: { tenant: true } });
    expect(posts[0].rules).toBeUndefined();
  });

  it('sends the edited rules instead of the stored version once a rule is changed', async () => {
    const posts = [];
    mockApi(api, {
      '/organization/departments': { data: [] },
      '/attendance-policies/p1/versions/2': { data: { effective_rules: { late: { grace_minutes: 10, grace_mode: 'beyond_grace' } } } },
      '/attendance-policies/simulate': (p, o) => (posts.push(o.body), result),
    });
    render(<ToastProvider><PolicySimulator policies={policies} /></ToastProvider>);
    choose('Policy', 'General policy');
    choose('Version to start from', 'v2 (draft)');
    const [grace] = await screen.findAllByRole('spinbutton', { name: /Grace/ });
    fireEvent.change(grace, { target: { value: '20' } });
    expect(screen.getByText('Rules to test (edited)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
    await screen.findByTestId('simulation-result');
    expect(posts[0].rules.late.grace_minutes).toBe(20);
    expect(posts[0].version_id).toBeUndefined();
  });

  it('shows the server error when the simulation fails', async () => {
    mockApi(api, {
      '/organization/departments': { data: [] },
      '/attendance-policies/p1/versions/2': { data: { effective_rules: { late: { grace_minutes: 10 } } } },
      '/attendance-policies/simulate': Object.assign(new Error('Simulate at most 92 days at a time.'), { status: 422 }),
    });
    render(<ToastProvider><PolicySimulator policies={policies} /></ToastProvider>);
    choose('Policy', 'General policy');
    choose('Version to start from', 'v2 (draft)');
    await screen.findAllByRole('spinbutton', { name: /Grace/ });
    fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Simulate at most 92 days');
    expect(screen.queryByTestId('simulation-result')).not.toBeInTheDocument();
  });
});
