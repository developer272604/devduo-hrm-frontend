import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MigrationStudioPage, variationText } from './MigrationStudioPage';
import { api } from '../../lib/api';

const access = vi.hoisted(() => ({ perms: [] }));
vi.mock('../../lib/auth', () => ({ useAuth: () => ({ can: (p) => access.perms.includes(p) }) }));
vi.mock('../../lib/api', () => ({ api: vi.fn(), query: (o) => new URLSearchParams(o).toString() }));

const stage = (o) => ({
  code: 'employees',
  label: 'Employees and organization',
  position: 1,
  status: 'imported',
  import_uuid: 'i1',
  skip_reason: null,
  override_reason: null,
  where_to_import: 'People > Imports',
  href: '/people/imports',
  waiting_for: [],
  allowed_metrics: { rows_imported: 'Rows imported by the linked import' },
  import: { status: 'completed', ok: 10, total: 10, error: 0 },
  reconciliations: [],
  ...o,
});
const project = (stages) => ({
  uuid: 'p1',
  name: 'Move from Legacy HR',
  source_system: 'Legacy HR',
  status: 'in_progress',
  target_cutover_on: null,
  stages_total: 1,
  stages_done: 0,
  cutover_blockers: ['Employees and organization is imported; verify or skip it with a reason.'],
  can_go_live: false,
  stages,
  history: [],
  limitations: 'Migration Studio orders and verifies the existing imports.',
});
const ui = () =>
  render(
    <MemoryRouter>
      <MigrationStudioPage />
    </MemoryRouter>,
  );
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  access.perms = ['integrations.migration.view', 'integrations.migration.manage'];
});

it('formats a reconciliation variance', () => {
  expect(variationText({ imported_value: null })).toBe('not measured yet');
  expect(variationText({ imported_value: 10, source_value: 12, variance: -2 })).toBe('Devduo 10 vs source 12 (-2)');
});

function mockProject(stages) {
  api.mockImplementation((path) =>
    Promise.resolve(
      path.endsWith('/p1')
        ? project(stages)
        : { items: [{ uuid: 'p1', name: 'Move from Legacy HR', source_system: 'Legacy HR', status: 'in_progress', stages_done: 0, stages_total: 1 }], stages: [] },
    ),
  );
}

it('lists projects and opens one with stage status and cutover blockers', async () => {
  mockProject([stage()]);
  ui();
  fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  expect(await screen.findByText(/Import completed: 10 of 10 rows imported/)).toBeInTheDocument();
  expect(screen.getByText(/verify or skip it with a reason/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirm cutover' })).toBeDisabled();
});

it('asks for a reason before accepting a variance when verifying', async () => {
  mockProject([stage({ reconciliations: [{ metric: 'rows_imported', source_value: 12, tolerance: 0, imported_value: 10, variance: -2, status: 'variance' }] })]);
  ui();
  fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Verify stage' }));
  expect(await screen.findByText(/Some checks do not match/)).toBeInTheDocument();
  expect(screen.getByLabelText('Reason')).toBeRequired();
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Duplicates in old system' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      expect.stringContaining('/p1/verify'),
      expect.objectContaining({ method: 'POST' }),
    ),
  );
});

it('hides management actions without the manage permission', async () => {
  access.perms = ['integrations.migration.view'];
  mockProject([stage()]);
  ui();
  fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
  await screen.findByText(/Import completed/);
  expect(screen.queryByRole('button', { name: 'Verify stage' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'New project' })).not.toBeInTheDocument();
});
