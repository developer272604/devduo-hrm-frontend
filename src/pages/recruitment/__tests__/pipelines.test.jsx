import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let perms = [];
let session = { user: { id: 7 } };
vi.mock('../../../lib/auth', () => ({
  useAuth: () => ({ can: (p) => !p || p.split('|').some((k) => perms.includes(k)), enabled: () => true, session }),
}));
vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
import { api } from '../../../lib/api';
import { ToastProvider } from '../../../components/ui';
import PipelineAdminPage from '../PipelineAdminPage';
import AnalyticsPage from '../AnalyticsPage';
import { RequisitionsPage } from '../HiringPages';
import { validatePipeline, blankPipeline } from '../../../lib/recruitmentApi';
import { apiError, calls, mockApi } from '../../payroll/__tests__/helpers';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const wrap = (ui) => (
  <ToastProvider>
    <MemoryRouter>{ui}</MemoryRouter>
  </ToastProvider>
);
const page = (rows) => ({ data: rows, current_page: 1, last_page: 1, total: rows.length });
const stage = (code, kind = 'active', extra = {}) => ({ code, label: code.toUpperCase(), kind, sla_hours: null, reminder_recipients: ['recruiter'], ...extra });
const pipeline = (extra = {}) => ({
  uuid: 'p1', code: 'ENG', version: 1, name: 'Engineering', status: 'active', is_default: false, allow_skip: false, feedback_reminder_hours: 24, in_use: false,
  stages: [stage('applied'), stage('interview', 'active', { sla_hours: 48 }), stage('offer', 'offer')], ...extra,
});

describe('validatePipeline', () => {
  const ok = () => ({ ...blankPipeline(), code: 'ENG', name: 'Engineering' });
  it('accepts the starter pipeline', () => expect(validatePipeline(ok())).toEqual([]));
  it('mirrors the API stage rules', () => {
    const f = ok();
    f.stages = [{ ...f.stages[0], kind: 'offer' }, { code: 'Bad Code', label: '', kind: 'rejected', sla_hours: '9000', reminder_recipients: [] }, { code: 'x', label: 'X', kind: 'active', sla_hours: '', reminder_recipients: [] }];
    const text = validatePipeline(f).join('\n');
    expect(text).toMatch(/first stage must be of kind active/);
    expect(text).toMatch(/code must start with a lowercase letter/);
    expect(text).toMatch(/label is required/);
    expect(text).toMatch(/SLA hours must be a whole number from 1 to 8760/);
    expect(text).toMatch(/come last/);
  });
  it('rejects duplicates, a missing offer stage and too few stages', () => {
    const f = ok();
    f.stages = [{ ...f.stages[0] }, { ...f.stages[0] }];
    const text = validatePipeline(f).join('\n');
    expect(text).toMatch(/used more than once/);
    expect(text).toMatch(/Exactly one stage must be of kind offer/);
    f.stages = [f.stages[0]];
    expect(validatePipeline(f).join()).toMatch(/2 to 20 stages/);
  });
  it('refuses an SLA on a hired stage and a lowercase pipeline code', () => {
    const f = ok();
    f.code = 'eng';
    f.stages = [...f.stages, { code: 'hired', label: 'Hired', kind: 'hired', sla_hours: '10', reminder_recipients: [] }];
    const text = validatePipeline(f).join('\n');
    expect(text).toMatch(/Code must start with a capital/);
    expect(text).toMatch(/cannot have an SLA/);
  });
});

describe('Pipeline setup page', () => {
  const show = () => render(wrap(<PipelineAdminPage />));

  it('lists pipelines with a default marker and hides editing without the manage permission', async () => {
    perms = ['recruitment.view'];
    mockApi(api, { '/pipelines': page([pipeline({ is_default: true })]) });
    show();
    expect((await screen.findAllByText('Default')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'New pipeline' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit ENG/ })).not.toBeInTheDocument();
  });
  it('shows an error state with retry', async () => {
    perms = ['recruitment.view'];
    mockApi(api, { '/pipelines': apiError('Forbidden', 403) });
    show();
    expect((await screen.findAllByText('Access restricted')).length).toBeGreaterThan(0);
  });
  it('blocks saving an invalid stage list and sends nothing', async () => {
    perms = ['recruitment.view', 'recruitment.pipeline.manage'];
    mockApi(api, { '/pipelines': page([]) });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'New pipeline' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Code'), { target: { value: 'eng' } });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Engineering' } });
    fireEvent.change(within(dialog).getByLabelText('Stage 2 code'), { target: { value: 'Offer Stage' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create pipeline' }));
    expect(await within(dialog).findByText(/Stage 2: code must start with a lowercase letter/)).toBeInTheDocument();
    expect(calls(api, '/pipelines')).toHaveLength(0);
  });
  it('creates a pipeline with a valid payload', async () => {
    perms = ['recruitment.view', 'recruitment.pipeline.manage'];
    mockApi(api, { '/pipelines': (path, o) => (o.method === 'POST' ? { uuid: 'n1' } : page([])) });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'New pipeline' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Code'), { target: { value: 'eng' } });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Engineering' } });
    fireEvent.change(within(dialog).getByLabelText('Stage 1 SLA hours'), { target: { value: '72' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create pipeline' }));
    await waitFor(() => expect(calls(api, '/pipelines')).toHaveLength(1));
    const body = calls(api, '/pipelines')[0][1].body;
    expect(body).toMatchObject({ code: 'ENG', name: 'Engineering', allow_skip: false });
    expect(body.stages[0]).toMatchObject({ code: 'applied', kind: 'active', sla_hours: 72 });
  });
  it('explains a frozen version after a 409 and creates a new version instead', async () => {
    perms = ['recruitment.view', 'recruitment.pipeline.manage'];
    mockApi(api, {
      '/p1/versions': (path, o) => (o.method === 'POST' ? { uuid: 'p2', version: 2 } : []),
      '/pipelines/p1': (path, o) => (o.method === 'PUT' ? apiError('The version is in use and cannot be edited.', 409) : pipeline()),
      '/pipelines': page([pipeline()]),
    });
    show();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Edit ENG v1' }))[0]);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Engineering 2' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(dialog).findByText('This version is frozen')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create new version' }));
    await waitFor(() => expect(calls(api, '/p1/versions')).toHaveLength(1));
    expect(calls(api, '/p1/versions')[0][1].body).toMatchObject({ name: 'Engineering 2' });
    expect(calls(api, '/pipelines/p1', 'PUT')).toHaveLength(1);
  });
  it('offers a new version straight away for a version already in use', async () => {
    perms = ['recruitment.view', 'recruitment.pipeline.manage'];
    mockApi(api, { '/pipelines': page([pipeline({ in_use: true })]) });
    show();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Edit ENG v1' }))[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('This version is frozen')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Create new version' })).toBeInTheDocument();
  });
});

describe('Requisition amendments and versions', () => {
  const req = (extra = {}) => ({ uuid: 'r1', title: 'Engineer', job_version: 1, openings: 2, filled_count: 0, status: 'open', target_date: '2026-12-01', budget_amount: '1000.00', budget_currency: 'USD', version: 1, pipeline_code: 'ENG', can_review: false, ...extra });
  const lookups = { '/organization/': { data: [] }, '/users': { data: [] }, '/jobs': page([]), '/pipelines': page([pipeline()]) };
  const show = () => render(wrap(<RequisitionsPage />));

  it('tells the user when an amendment needs re-approval and sends only changed fields', async () => {
    perms = ['recruitment.view', 'recruitment.manage'];
    mockApi(api, { '/amend': { uuid: 'v2', version: 2, status: 'pending' }, '/requisitions': page([req()]), ...lookups });
    show();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Amend Engineer' }))[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('No re-approval needed')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Openings (headcount)'), { target: { value: '5' } });
    expect(within(dialog).getByText('Re-approval needed')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Reason for the amendment'), { target: { value: 'Growth' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit amendment' }));
    await waitFor(() => expect(calls(api, '/amend')).toHaveLength(1));
    expect(calls(api, '/amend')[0][1].body).toEqual({ openings: 5, reason: 'Growth', expected_version: 1 });
  });
  it('does not call re-approval for a decrease', async () => {
    perms = ['recruitment.view', 'recruitment.manage'];
    mockApi(api, { '/requisitions': page([req()]), ...lookups });
    show();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Amend Engineer' }))[0]);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Openings (headcount)'), { target: { value: '1' } });
    expect(within(dialog).getByText('No re-approval needed')).toBeInTheDocument();
  });

  const versions = [{ uuid: 'v2', version: 2, status: 'pending', requires_approval: true, changed_fields: ['openings'], before: { openings: 2 }, after: { openings: 5 }, reason: 'Growth', created_by: 7, decided_by: null, decided_at: null, created_at: '2026-10-01T10:00:00Z' }];
  const openVersions = async () => {
    show();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Versions of Engineer' }))[0]);
    return screen.getByRole('dialog');
  };
  it('disables approval for the requester and says another approver is needed', async () => {
    perms = ['recruitment.view', 'recruitment.approve'];
    session = { user: { id: 7 } };
    mockApi(api, { '/versions': page(versions), '/requisitions': page([req()]), ...lookups });
    const dialog = await openVersions();
    expect(await within(dialog).findByText('Another approver is needed')).toBeInTheDocument();
    expect(within(dialog).getByText('Growth')).toBeInTheDocument();
    expect(within(dialog).getByRole('table', { name: 'Changes in version 2' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Approve version 2' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Reject version 2' })).toBeDisabled();
  });
  it('lets another approver approve', async () => {
    perms = ['recruitment.view', 'recruitment.approve'];
    session = { user: { id: 9 } };
    mockApi(api, { '/decision': { version: 2, status: 'approved' }, '/versions': page(versions), '/requisitions': page([req()]), ...lookups });
    const dialog = await openVersions();
    const btn = await within(dialog).findByRole('button', { name: 'Approve version 2' });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    await waitFor(() => expect(calls(api, '/versions/2/decision')).toHaveLength(1));
    expect(calls(api, '/versions/2/decision')[0][1].body).toEqual({ decision: 'approved' });
  });
});

describe('Analytics SLA section', () => {
  it('renders breaches by stage and average hours', async () => {
    perms = ['recruitment.reports.view'];
    mockApi(api, {
      '/analytics': {
        requisitions: {}, pipeline: {}, offers: {}, time_to_fill: {},
        sla: { by_stage: { screening: { active: 4, breached: 2 }, interview: { active: 1, breached: 0 } }, breached_total: 2, average_hours_in_stage: { screening: '30.5' } },
      },
    });
    render(wrap(<AnalyticsPage />));
    const breaches = await screen.findByRole('table', { name: 'SLA breaches by stage' });
    expect(within(breaches).getByRole('row', { name: /Screening 4 2/ })).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Average hours in stage' })).getByText('30.5 h')).toBeInTheDocument();
    expect(screen.getByText(/have exceeded their stage SLA/)).toBeInTheDocument();
  });
});
