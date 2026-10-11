import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OrgChart from './OrgChart';
import PeopleActionCenter from './PeopleActionCenter';
import ImportExport from './ImportExport';
import PeopleSettings from './PeopleSettings';
import ProfileChanges from './ProfileChanges';
import { CommitStep, validateFile } from '../../components/people/ImportExportWizard';
import {
  validateNumberingPattern,
  needsSensitiveConfirm,
} from '../../components/people/PeopleSettingsForms';
import { validateFields } from '../../components/people/PeopleSettingsCrud';
import { maskValue } from '../../lib/changeRequestsApi';
import { ToastProvider } from '../../components/ui';
import { api, download } from '../../lib/api';

vi.mock('../../lib/auth', () => ({ useAuth: () => ({ can: () => true, enabled: () => true }) }));
vi.mock('../../lib/api', async (original) => ({
  ...(await original()),
  api: vi.fn(),
  download: vi.fn(async () => {}),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const mount = (ui) =>
  render(
    <MemoryRouter>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>,
  );
const paged = (data) => ({ data, current_page: 1, last_page: 1, total: data.length });
/** Route mocked responses by path prefix; first matching key wins. */
function route(map) {
  api.mockImplementation(async (path, options) => {
    const key = Object.keys(map).find((k) => path.startsWith(k));
    if (!key) throw Object.assign(new Error('Not mocked ' + path), { status: 404 });
    const value = map[key];
    return typeof value === 'function' ? value(path, options) : value;
  });
}
const calls = (prefix) => api.mock.calls.filter(([p]) => p.startsWith(prefix));

describe('Org chart', () => {
  it('loads direct reports only when a node is expanded', async () => {
    route({
      '/organization/': { data: [] },
      '/v1/people/org-chart/boss/children': paged([
        { uuid: 'kid', name: 'Kim Report', has_children: false, children_count: 0 },
      ]),
      '/v1/people/org-chart?': paged([
        {
          uuid: 'boss',
          name: 'Bo Manager',
          has_children: true,
          children_count: 1,
          designation: 'Head',
        },
      ]),
    });
    mount(<OrgChart />);
    expect(await screen.findByText('Bo Manager')).toBeInTheDocument();
    expect(calls('/v1/people/org-chart/boss/children')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /show 1 reports of bo manager/i }));
    expect(await screen.findByText('Kim Report')).toBeInTheDocument();
    expect(calls('/v1/people/org-chart/boss/children')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /hide 1 reports/i }));
    expect(screen.queryByText('Kim Report')).not.toBeInTheDocument();
  });

  it('opens a preview drawer from a node name', async () => {
    route({
      '/organization/': { data: [] },
      '/v1/people/org-chart?': paged([
        { uuid: 'boss', name: 'Bo Manager', department: 'Ops', children_count: 0 },
      ]),
    });
    mount(<OrgChart />);
    fireEvent.click(await screen.findByRole('button', { name: 'Bo Manager' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Ops')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Open full profile' })).toHaveAttribute(
      'href',
      '/people/boss',
    );
  });
});

describe('Action center actions', () => {
  const insight = (action) => ({
    data: [
      {
        key: 'people.x',
        title: 'Missing docs',
        severity: 'critical',
        count: 3,
        description: 'Docs',
        sample: [],
        actions: [action],
      },
    ],
  });
  it('confirms before creating a task and sends the assignee', async () => {
    route({
      '/v1/people/action-center?': insight({
        label: 'Create task',
        kind: 'api',
        method: 'POST',
        endpoint: '/api/v1/people/action-center/tasks',
        body: { insight: 'people.x' },
        requires_confirmation: true,
      }),
      '/users': { data: [{ id: 7, name: 'Hana HR' }] },
      '/v1/people/action-center/tasks': { id: 1 },
    });
    mount(<PeopleActionCenter />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create task' }));
    expect(calls('/v1/people/action-center/tasks')).toHaveLength(0);
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Create task' }),
    );
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/v1/people/action-center/tasks', {
        method: 'POST',
        body: { insight: 'people.x' },
      }),
    );
  });

  it('refuses endpoints outside the people API', async () => {
    route({
      '/v1/people/action-center?': insight({
        label: 'Bad',
        kind: 'api',
        method: 'POST',
        endpoint: '/api/v1/admin/wipe',
      }),
    });
    mount(<PeopleActionCenter />);
    await screen.findByText('Missing docs');
    expect(screen.queryByRole('button', { name: 'Bad' })).not.toBeInTheDocument();
  });

  it('requires resolution text before resolving a finding', async () => {
    route({
      '/v1/people/quality/findings': paged([
        {
          id: 5,
          title: 'Duplicate person',
          severity: 'warning',
          status: 'open',
          requires_resolution_text: true,
          employee: null,
        },
      ]),
      '/v1/people/quality/summary': { open: 1 },
      '/v1/people/quality/findings/5/resolve': {},
    });
    mount(<PeopleActionCenter />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Data quality' }));
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Resolve Duplicate person' }))[0],
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }));
    expect(await within(dialog).findByText('Please explain the decision.')).toBeInTheDocument();
    expect(calls('/v1/people/quality/findings/5/resolve')).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText(/Resolution/), {
      target: { value: 'Different people' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/v1/people/quality/findings/5/resolve', {
        method: 'POST',
        body: { resolution: 'Different people' },
      }),
    );
  });
});

describe('Import wizard', () => {
  it('validates the chosen file', () => {
    expect(validateFile(null)).toMatch(/choose/i);
    expect(validateFile({ name: 'a.pdf', size: 10 })).toMatch(/csv/i);
    expect(validateFile({ name: 'a.csv', size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
    expect(validateFile({ name: 'a.csv', size: 10 })).toBe('');
  });

  it('walks upload, mapping, validation and commit', async () => {
    const staged = {
      uuid: 'imp1',
      filename: 'people.csv',
      total_rows: 2,
      headers: ['First', 'Joined'],
      columns: [],
      mapping: { first_name: 'First' },
      targets: [
        { key: 'first_name', label: 'First name', required: true },
        { key: 'joined_on', label: 'Joined on', required: true },
      ],
    };
    route({
      '/v1/people/imports/imp1/rows': paged([
        {
          row_number: 3,
          status: 'error',
          errors: [{ field: 'joined_on', message: 'Bad date' }],
          warnings: [],
        },
      ]),
      '/v1/people/imports/imp1/mapping': {},
      '/v1/people/imports/imp1/validate': {
        ...staged,
        status: 'validated',
        counts: { valid: 1, warning: 0, error: 1 },
      },
      '/v1/people/imports/imp1/commit': {},
      '/v1/people/imports/imp1': {
        status: 'completed',
        total_rows: 2,
        processed_rows: 2,
        counts: { imported: 1, error: 1, skipped: 0 },
      },
      '/v1/people/imports': staged,
    });
    const { container } = mount(<ImportExport />);
    const file = new File(['First,Joined\nA,2025-01-01'], 'people.csv', { type: 'text/csv' });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and continue' }));
    expect(await screen.findByText(/people.csv · 2 rows/)).toBeInTheDocument();

    // Required column unmapped: blocked client-side, no API calls for mapping.
    fireEvent.click(screen.getByRole('button', { name: 'Validate rows' }));
    expect(
      await screen.findByText(/Map the required columns first: Joined on/),
    ).toBeInTheDocument();
    expect(calls('/v1/people/imports/imp1/mapping')).toHaveLength(0);
  });

  it('corrects a problem row, revalidates the import and refreshes the counts', async () => {
    let validations = 0;
    const staged = {
      uuid: 'imp1',
      filename: 'people.csv',
      total_rows: 1,
      headers: ['First', 'Joined'],
      columns: [],
      mapping: { first_name: 'First', joined_on: 'Joined' },
      targets: [
        { key: 'first_name', label: 'First name', required: true },
        { key: 'joined_on', label: 'Joined on', required: true },
      ],
    };
    route({
      '/v1/people/imports/imp1/rows/3': {},
      '/v1/people/imports/imp1/rows': paged([
        {
          row_number: 3,
          status: 'error',
          raw: { First: 'Ari', Joined: 'bad-date' },
          errors: [{ field: 'joined_on', message: 'Bad date' }],
          warnings: [],
        },
      ]),
      '/v1/people/imports/imp1/mapping': {},
      '/v1/people/imports/imp1/validate': async () => ({
        ...staged,
        status: 'validated',
        counts:
          ++validations === 1
            ? { valid: 0, warning: 0, error: 1 }
            : { valid: 1, warning: 0, error: 0 },
      }),
      '/v1/people/imports/imp1/commit': {},
      '/v1/people/imports/imp1': {
        status: 'completed',
        total_rows: 1,
        processed_rows: 1,
        counts: { imported: 1, error: 0, skipped: 0 },
      },
      '/v1/people/imports': staged,
    });
    const { container } = mount(<ImportExport />);
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: {
        files: [new File(['First,Joined\nAri,bad-date'], 'people.csv', { type: 'text/csv' })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and continue' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Validate rows' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit row' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Joined'), { target: { value: '2025-01-01' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save and revalidate' }));
    expect(await screen.findByText(/1 valid/)).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/v1/people/imports/imp1/rows/3', {
      method: 'PATCH',
      body: { values: { First: 'Ari', Joined: '2025-01-01' } },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }));
    expect(await screen.findByText(/1 imported/)).toBeInTheDocument();
  });

  it('shows polled progress and the final result with an errors download', async () => {
    let n = 0,
      release;
    const gate = new Promise((r) => (release = r));
    route({
      '/v1/people/imports/imp1': async () => {
        if (++n === 1)
          return { status: 'processing', total_rows: 10, processed_rows: 4, counts: {} };
        await gate;
        return {
          status: 'partial',
          total_rows: 10,
          processed_rows: 10,
          counts: { imported: 8, error: 2, skipped: 0 },
        };
      },
    });
    mount(<CommitStep uuid="imp1" onReset={() => {}} interval={5} />);
    expect(await screen.findByText(/4 of 10 rows/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Import progress' })).toHaveValue(4);
    release();
    expect(await screen.findByText(/8 imported/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download errors.csv' }));
    expect(download).toHaveBeenCalledWith(
      '/v1/people/imports/imp1/errors.csv',
      'import-errors.csv',
    );
  });
});

describe('People settings validation', () => {
  it('validates numbering patterns', () => {
    expect(validateNumberingPattern('EMP-{SEQ:4}')).toBe('');
    expect(validateNumberingPattern('{LE}/{YY}-{SEQ}')).toBe('');
    expect(validateNumberingPattern('EMP')).toMatch(/exactly one/);
    expect(validateNumberingPattern('{SEQ}{SEQ}')).toMatch(/exactly one/);
    expect(validateNumberingPattern('{SEQ}{NOPE}')).toMatch(/unknown token/);
    expect(validateNumberingPattern('E#{SEQ}')).toMatch(/Fixed text/);
    expect(validateNumberingPattern('A'.repeat(70) + '{SEQ}')).toMatch(/60/);
  });

  it('requires confirmation for sensitive widenings', () => {
    expect(needsSensitiveConfirm('edit_rules', { bank: 'request' }, { bank: 'direct' })).toBe(true);
    expect(needsSensitiveConfirm('edit_rules', { bank: 'direct' }, { bank: 'direct' })).toBe(false);
    expect(
      needsSensitiveConfirm('directory_privacy', { date_of_birth: false }, { date_of_birth: true }),
    ).toBe(true);
  });

  it('validates catalogue fields', () => {
    const fields = [
      {
        name: 'code',
        label: 'Code',
        required: true,
        pattern: /^[a-z]+$/,
        patternMessage: 'letters',
      },
    ];
    expect(validateFields(fields, { code: '' }).code).toMatch(/required/);
    expect(validateFields(fields, { code: 'A1' }).code).toBe('letters');
    expect(validateFields(fields, { code: 'ok' })).toEqual({});
  });

  it('blocks saving an invalid numbering pattern and shows server errors', async () => {
    route({
      '/v1/people/settings': {
        numbering: { mode: 'auto', pattern: 'EMP-{SEQ:4}', scope: 'tenant', start: 1 },
        catalogue: { numbering_scopes: ['tenant'], numbering_tokens: [{ token: '{SEQ}' }] },
      },
    });
    mount(<PeopleSettings />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Numbering' }));
    const input = await screen.findByLabelText('Number pattern');
    fireEvent.change(input, { target: { value: 'BROKEN' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText(/exactly one/)).toBeInTheDocument();
    expect(api.mock.calls.filter(([, o]) => o?.method === 'PUT')).toHaveLength(0);
  });

  it('shows a no-permission state when the API refuses', async () => {
    api.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    mount(<PeopleSettings />);
    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });
});

describe('Profile changes', () => {
  it('masks sensitive values and requires a comment to reject', async () => {
    expect(maskValue('1234567890')).toBe('••••7890');
    expect(maskValue('12')).toBe('••••');
    const request = {
      uuid: 'cr1',
      status: 'pending',
      employee: { uuid: 'e1', name: 'Eve' },
      changes: [
        {
          field: 'iban',
          label: 'Bank account',
          before: '1111222233',
          after: '9999888877',
          sensitive: true,
        },
      ],
    };
    route({
      '/v1/people/change-requests?': paged([request]),
      '/v1/people/change-requests/cr1/reject': {},
    });
    mount(<ProfileChanges />);
    fireEvent.click((await screen.findAllByText('Eve'))[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('••••8877')).toBeInTheDocument();
    expect(within(dialog).queryByText('9999888877')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(await within(dialog).findByText(/comment is required/i)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Decision comment'), {
      target: { value: 'Not valid' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/v1/people/change-requests/cr1/reject', {
        method: 'POST',
        body: { comment: 'Not valid' },
      }),
    );
  });
});
