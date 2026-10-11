import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IntelligenceCenterPage } from './IntelligenceCenterPage';
import { api } from '../../lib/api';

const access = vi.hoisted(() => ({ perms: [] }));
vi.mock('../../lib/auth', () => ({ useAuth: () => ({ can: (p) => access.perms.includes(p) }) }));
vi.mock('../../lib/api', () => ({ api: vi.fn(), query: (o) => new URLSearchParams(o).toString() }));

const finding = {
  uuid: 'f1',
  domain: 'people',
  severity: 'critical',
  title: '3 employees miss documents',
  description: 'Mandatory documents are missing.',
  status: 'open',
  occurrences: 1,
  owner: { name: 'Asha' },
  due_on: '2026-10-09',
  has_task: false,
  evidence: { actions: [{ label: 'Open documents', kind: 'navigate', href: '/people' }], sample: [] },
};
const ui = () =>
  render(
    <MemoryRouter>
      <IntelligenceCenterPage />
    </MemoryRouter>,
  );
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  access.perms = ['intelligence.view', 'intelligence.manage'];
});

it('lists findings with severity, owner, due date and a source link', async () => {
  api.mockResolvedValue({ count: 1, items: [finding], limitations: 'Deterministic outputs.' });
  ui();
  expect(await screen.findByText('3 employees miss documents')).toBeInTheDocument();
  expect(screen.getByText('critical')).toBeInTheDocument();
  expect(screen.getByText(/Owner: Asha/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open documents' })).toHaveAttribute('href', '/people');
  expect(screen.queryByRole('tab', { name: 'Scenarios' })).not.toBeInTheDocument();
});

it('shows the explanation with rule, threshold, scope and withheld records', async () => {
  api.mockImplementation((path) =>
    Promise.resolve(
      path.includes('/explain')
        ? {
            title: finding.title,
            explain: {
              rule: 'Missing mandatory documents',
              threshold: 'count >= 1',
              inputs: { matching_records: 3, sample_shown: 1 },
              as_of: { tenant_date: '2026-10-07', timezone: 'Asia/Kolkata' },
              scope: { data_scopes: ['tenant'], applied_by: 'Providers filter by scope.' },
              suppressed: { records_beyond_sample: 2, note: 'Names withheld.' },
            },
            history: [{ type: 'detected', to: 'open', actor: 'System', at: '2026-10-07T00:00:00Z' }],
          }
        : { count: 1, items: [finding], limitations: '' },
    ),
  );
  ui();
  fireEvent.click(await screen.findByRole('button', { name: 'Explain this' }));
  expect(await screen.findByText('Missing mandatory documents')).toBeInTheDocument();
  expect(screen.getByText(/2 record\(s\) beyond the sample/)).toBeInTheDocument();
  expect(screen.getByText(/tenant\./)).toBeInTheDocument();
});

it('acknowledges selected findings in bulk and requires a reason to resolve', async () => {
  api.mockResolvedValue({ count: 1, items: [finding], limitations: '' });
  ui();
  fireEvent.click(await screen.findByLabelText('Select 3 employees miss documents'));
  fireEvent.click(screen.getByRole('button', { name: 'Acknowledge selected (1)' }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith('/v1/intelligence/center/bulk-acknowledge', {
      method: 'POST',
      body: { uuids: ['f1'] },
    }),
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Resolve' }));
  expect(await screen.findByLabelText('Reason')).toBeRequired();
});

it('shows a restricted state when the server answers 403', async () => {
  api.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
  ui();
  expect(await screen.findByText('Access restricted')).toBeInTheDocument();
});

it('indicators tab shows human-review wording and the off state', async () => {
  access.perms = ['intelligence.view', 'intelligence.risk_signals.view', 'intelligence.settings.manage'];
  api.mockImplementation((path) =>
    Promise.resolve(
      path.includes('risk-signals')
        ? {
            enabled: false,
            min_cohort: 5,
            cohorts: [],
            definitions: {},
            message: 'Risk signals are disabled for this workspace.',
            privacy: 'Cohort-level only.',
            human_review_notice: 'These are indicators for human review only.',
          }
        : { count: 0, items: [], limitations: '' },
    ),
  );
  ui();
  fireEvent.click(await screen.findByRole('tab', { name: 'Indicators' }));
  expect(await screen.findByText('These are indicators for human review only.')).toBeInTheDocument();
  expect(screen.getByText('Risk signals are off')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Enable risk signals' })).toBeInTheDocument();
});
