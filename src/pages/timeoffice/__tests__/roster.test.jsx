import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

let perms = ['attendance.roster.manage'];
vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
vi.mock('../../../lib/auth', () => ({
  useAuth: () => ({ can: (p) => !p || p.split('|').some((k) => perms.includes(k)), enabled: () => true }),
}));
import { api } from '../../../lib/api';
import { mockApi } from './helpers';
import RosterPage, { rangeFor } from '../RosterPage';
import { addDays } from '../../../lib/timeOfficeApi';

afterEach(cleanup);
beforeEach(() => {
  api.mockReset();
  perms = ['attendance.roster.manage'];
});
const today = new Date().toLocaleDateString('en-CA');
const { from } = rangeFor('week', today);
const rosterMeta = (extra = {}) => ({ uuid: 'r1', name: 'November', status: 'draft', start_date: addDays(today, -30), end_date: addDays(today, 60), has_unpublished_changes: true, draft_entries: 2, publication_version: 3, ...extra });
const grid = (extra = {}) => ({
  roster: rosterMeta(),
  data: [
    {
      employee_uuid: 'e1',
      employee_number: 'E-1',
      name: 'Asha Rao',
      cells: {
        [from]: { kind: 'working', source: 'roster', state: 'published', shift: { code: 'GEN', name: 'General' } },
        [addDays(from, 1)]: { kind: 'working', source: 'roster', state: 'draft', draft: { type: 'shift', shift: 'NIGHT' } },
        [addDays(from, 2)]: { kind: 'working', source: 'roster', state: 'changed', shift: { code: 'GEN', name: 'General' } },
      },
    },
  ],
  current_page: 1,
  last_page: 1,
  total: 1,
  ...extra,
});
const routes = (g, validate = { data: { conflicts: [], blocking: false, count: 0 } }) => ({
  '/rosters/r1/grid': g,
  '/rosters/r1/validate': validate,
  '/rosters/r1/changes': { data: [{}, {}] },
  '/rosters/r1/publish': { data: {} },
  '/rosters': { data: [rosterMeta()] },
  '/shifts': { data: [{ uuid: 's1', name: 'General', code: 'GEN' }] },
  '/organization/departments': { data: [] },
});

describe('RosterPage states', () => {
  it('shows draft, published and changed entries distinctly, each with a text label', async () => {
    mockApi(api, routes(grid()));
    render(<RosterPage />);
    const table = await screen.findByRole('table', { name: 'Roster grid' });
    const cells = within(table).getAllByRole('button');
    const by = (s) => cells.filter((c) => c.dataset.status === s);
    expect(by('published')).toHaveLength(1);
    expect(by('draft')).toHaveLength(1);
    expect(by('changed')).toHaveLength(1);
    expect(by('empty')).toHaveLength(4);
    expect(by('draft')[0]).toHaveAccessibleName(/NIGHT, Draft/);
    expect(by('changed')[0]).toHaveTextContent('Changed');
    expect(screen.getByRole('list', { name: 'Legend' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Roster list' })).toBeInTheDocument(); // mobile fallback
  });

  it('lists conflicts from the validate endpoint in a panel', async () => {
    const conflicts = [{ employee: 'Asha Rao', date: from, message: 'Less than 11 hours rest between shifts' }];
    mockApi(api, routes(grid(), { data: { conflicts, blocking: false, count: 1 } }));
    render(<RosterPage />);
    await screen.findByRole('table', { name: 'Roster grid' });
    fireEvent.click(screen.getByRole('button', { name: /Check conflicts/ }));
    const panel = await screen.findByRole('region', { name: 'Conflicts' });
    expect(panel).toHaveTextContent('1 roster conflict');
    expect(panel).toHaveTextContent('Less than 11 hours rest');
  });

  it('shows an error state, then an empty state', async () => {
    mockApi(api, routes(Object.assign(new Error('Roster service down'), { status: 500 })));
    render(<RosterPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Roster service down');
    cleanup();
    mockApi(api, routes(grid({ data: [], total: 0 })));
    render(<RosterPage />);
    expect(await screen.findByText(/No one to roster/)).toBeInTheDocument();
  });

  it('shows no-permission instead of the grid', () => {
    perms = [];
    render(<RosterPage />);
    expect(screen.getByText('Access restricted')).toBeInTheDocument();
  });

  it('previews the impact before publishing and only then publishes', async () => {
    const calls = [];
    mockApi(api, {
      ...routes(grid()),
      '/rosters/r1/publish': (p, o) => (calls.push(`${o.method} ${p}`), { data: {} }),
    });
    render(<RosterPage />);
    await screen.findByRole('table', { name: 'Roster grid' });
    fireEvent.click(screen.getByRole('button', { name: /^Publish/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Publish roster' });
    expect(await within(dialog).findByText('Impact preview')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(calls).toEqual(['POST /v1/rosters/r1/publish']));
  });
});
