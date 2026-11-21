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
import { ToastProvider } from '../../../components/ui';

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
  it('shows date-specific staffing shortfalls for the selected threshold', async () => {
    mockApi(api, {
      '/rosters/r1/coverage': { data: [
        { date: from, scheduled: 3, scheduled_minutes: 30, full_leave: 1, partial_leave: 1, available: 1, minimum: 2, shortfall: 1 },
        { date: addDays(from, 1), scheduled: 2, available: 2, minimum: 2, shortfall: 0 },
      ] },
      ...routes(grid()),
    });
    render(<RosterPage />);
    fireEvent.change(await screen.findByLabelText('Minimum staff per day'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check coverage' }));
    expect(await screen.findByText('1 short')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Coverage summary')).getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByText('Target met')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show shortfalls only' }));
    expect(screen.queryByText('Target met')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Hourly planning rate'), { target: { value: '20.01' } });
    expect(screen.getByRole('cell', { name: 'INR 10.01' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Hourly planning rate'), { target: { value: '20.001' } });
    expect(screen.queryByRole('cell', { name: 'INR 10.01' })).not.toBeInTheDocument();
    const request = api.mock.calls.find(([path]) => path.includes('/coverage'));
    expect(new URLSearchParams(request[0].split('?')[1]).get('minimum')).toBe('2');
    expect(api.mock.calls.filter(([path]) => path.includes('/coverage'))).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: `View roster for ${from}` }));
    await waitFor(() => {
      const dayRequest = api.mock.calls.find(([path]) => path.includes('/grid?view=day'));
      expect(dayRequest?.[0]).toContain(`from=${from}&to=${from}&page=1`);
    });
    expect(within(screen.getByRole('group', { name: 'Period' })).getByText(from)).toHaveFocus();
  });
  it('checks staffing for the selected shift and labels the results', async () => {
    mockApi(api, {
      '/rosters/r1/coverage': {
        shift: { uuid: 's1', name: 'General' },
        data: [{ date: from, scheduled: 1, scheduled_minutes: 480, full_leave: 0, partial_leave: 0, available: 1, minimum: 2, shortfall: 1 }],
      },
      ...routes(grid()),
    });
    render(<RosterPage />);
    const shift = await screen.findByLabelText('Coverage shift');
    fireEvent.click(shift);
    fireEvent.click(await screen.findByRole('option', { name: /General/ }));
    fireEvent.change(screen.getByLabelText('Minimum staff per day'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check coverage' }));
    expect(await screen.findByText('Coverage for General')).toBeInTheDocument();
    expect(screen.getByText('1 short')).toBeInTheDocument();
    const [path] = api.mock.calls.find(([url]) => url.includes('/coverage'));
    expect(new URLSearchParams(path.split('?')[1]).get('shift_uuid')).toBe('s1');
  });
  it('saves and clears a per-date staffing target from coverage results', async () => {
    let saved = null;
    mockApi(api, {
      '/rosters/r1/coverage/target': (_path, { body }) => {
        saved = body.minimum;
        return { data: body };
      },
      '/rosters/r1/coverage': () => ({ data: [{
        date: from, minimum: saved ?? 2, saved_minimum: saved, shortfall: saved ?? 2,
      }] }),
      ...routes(grid()),
    });
    render(<ToastProvider><RosterPage /></ToastProvider>);
    fireEvent.change(await screen.findByLabelText('Minimum staff per day'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check coverage' }));
    fireEvent.click(await screen.findByRole('button', { name: /Edit target for/ }));
    fireEvent.change(screen.getByLabelText('Saved staffing target'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('0 (saved)')).toBeInTheDocument();
    const filter = screen.getByRole('checkbox', { name: 'Show shortfalls only' });
    fireEvent.click(filter);
    expect(screen.getByText('All dates meet the staffing target')).toBeInTheDocument();
    fireEvent.click(filter);
    const [, request] = api.mock.calls.find(([path]) => path.endsWith('/coverage/target'));
    expect(request).toMatchObject({ method: 'PUT', body: { date: from, minimum: 0, shift_uuid: null } });
    fireEvent.click(screen.getByRole('button', { name: /Edit target for/ }));
    fireEvent.change(screen.getByLabelText('Saved staffing target'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('2 short')).toBeInTheDocument();
    expect(screen.queryByText('0 (saved)')).not.toBeInTheDocument();
  });
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
