import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let perms = [];
vi.mock('../../../lib/auth', () => ({
  useAuth: () => ({ can: (p) => !p || p.split('|').some((k) => perms.includes(k)), enabled: () => true }),
}));
vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
import { api } from '../../../lib/api';
import { ToastProvider } from '../../../components/ui';
import RecruitmentLayout, { RecruitmentHome } from '../RecruitmentLayout';
import { PipelinePage } from '../PipelinePages';
import OffersPage from '../OffersPage';
import InterviewsPage from '../InterviewsPage';
import { NAV, RECRUITMENT_ACCESS } from '../../../lib/recruitmentApi';
import { apiError, calls, mockApi } from '../../payroll/__tests__/helpers';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const wrap = (ui, start) => (
  <ToastProvider>
    <MemoryRouter initialEntries={[start]}>{ui}</MemoryRouter>
  </ToastProvider>
);
const page = (rows) => ({ data: rows, current_page: 1, last_page: 1, total: rows.length });
const links = () => screen.queryAllByRole('link').map((l) => l.textContent);

describe('Recruitment navigation', () => {
  const show = (start = '/recruitment/x') =>
    render(
      <MemoryRouter initialEntries={[start]}>
        <Routes>
          <Route path="recruitment" element={<RecruitmentLayout />}>
            <Route index element={<RecruitmentHome />} />
            <Route path="requisitions" element={<p>requisitions page</p>} />
            <Route path="x" element={<p>child</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  it('shows only sections the permissions unlock', () => {
    perms = ['recruitment.view'];
    show();
    expect(links()).toEqual(['Requisitions', 'Job postings', 'Candidates', 'Pipeline', 'Pipeline setup', 'Interviews']);
  });
  it('shows offers and analytics only with their keys', () => {
    perms = ['recruitment.offer.approve', 'recruitment.reports.view'];
    show();
    expect(links()).toEqual(['Analytics', 'Offers']);
  });
  it('renders no links without a recruitment permission', () => {
    perms = ['people.view'];
    show();
    expect(links()).toHaveLength(0);
  });
  it('lands on the first allowed section from /recruitment', () => {
    perms = ['recruitment.view'];
    show('/recruitment');
    expect(screen.getByText('requisitions page')).toBeInTheDocument();
  });
  it('module access covers every section key but not unrelated keys', () => {
    const keys = RECRUITMENT_ACCESS.split('|');
    NAV.forEach((n) => n.permission.split('|').forEach((k) => expect(keys).toContain(k)));
    expect(keys).not.toContain('people.view');
  });
});

describe('Pipeline', () => {
  const app = { uuid: 'a1', candidate_uuid: 'c1', candidate_name: 'Asha Rao', requisition_uuid: 'r1', job_title: 'Engineer', stage: 'applied', status: 'active', source: 'direct', stage_entered_at: '2026-10-01T10:00:00Z' };
  const show = () =>
    render(
      wrap(
        <Routes>
          <Route path="/recruitment/pipeline/:uuid" element={<PipelinePage />} />
        </Routes>,
        '/recruitment/pipeline/r1',
      ),
    );
  it('moves an application with a recorded reason', async () => {
    perms = ['recruitment.view', 'recruitment.manage'];
    mockApi(api, {
      '/transition': { uuid: 'a1' },
      '/pipelines': page([]),
      '/applications': page([app]),
      '/candidates': page([]),
      '/requisitions': page([{ uuid: 'r1', title: 'Engineer', status: 'open', openings: 1 }]),
    });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Move Asha Rao to Screening' }));
    expect(calls(api, '/transition')).toHaveLength(0);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Strong CV' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(calls(api, '/transition')).toHaveLength(1));
    const body = calls(api, '/transition')[0][1].body;
    expect(body).toMatchObject({ stage: 'screening', expected_stage: 'applied', status: 'active', reason: 'Strong CV' });
    expect(body.idempotency_key).toBeTruthy();
  });
  it('hides move actions without manage permission', async () => {
    perms = ['recruitment.view'];
    mockApi(api, { '/applications': page([app]), '/candidates': page([]), '/requisitions': page([]), '/pipelines': page([]) });
    show();
    expect(await screen.findByRole('button', { name: 'History for Asha Rao' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Move Asha Rao/ })).not.toBeInTheDocument();
  });
});

describe('Offers', () => {
  const offer = (extra = {}) => ({ uuid: 'o1', application_uuid: 'a1', candidate_name: 'Asha Rao', job_title: 'Engineer', version: 1, status: 'pending_approval', start_date: '2026-12-01', can_review: true, ...extra });
  const show = () =>
    render(
      wrap(
        <Routes>
          <Route path="/recruitment/offers" element={<OffersPage />} />
        </Routes>,
        '/recruitment/offers',
      ),
    );
  const lookups = { '/organization/': { data: [{ id: 1, name: 'Engineering' }] }, '/applications': page([]) };

  it('disables approval and explains why when the viewer made the offer', async () => {
    perms = ['recruitment.offer.approve'];
    mockApi(api, { '/offers': page([offer({ can_review: false })]), ...lookups });
    show();
    expect((await screen.findAllByText('Another approver is needed')).length).toBeGreaterThan(0);
    screen.getAllByRole('button', { name: 'Approve' }).forEach((b) => expect(b).toBeDisabled());
  });
  it('approves through a confirmation dialog', async () => {
    perms = ['recruitment.offer.approve'];
    mockApi(api, { '/o1/approve': { uuid: 'o1', status: 'approved' }, '/offers': page([offer()]), ...lookups });
    show();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Approve' }))[0]);
    const dialog = screen.getByRole('dialog');
    expect(calls(api, '/approve')).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(calls(api, '/approve')).toHaveLength(1));
  });
  it('shows the server maker-checker refusal inside the dialog', async () => {
    perms = ['recruitment.offer.approve'];
    mockApi(api, { '/o1/approve': apiError('The creator cannot approve this offer.', 403), '/offers': page([offer()]), ...lookups });
    show();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Approve' }))[0]);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('The creator cannot approve this offer.')).toBeInTheDocument();
  });

  it('hands over a returning employee with explicit identity confirmation', async () => {
    perms = ['recruitment.offer.manage', 'recruitment.handover', 'people.rehire', 'people.view'];
    mockApi(api, { '/employees': page([{ uuid: 'former-1', display_name: 'Asha Rao', employee_number: 'OLD-1' }]), '/handover': { employee_uuid: 'e1' }, '/offers': page([offer({ status: 'accepted' })]), ...lookups });
    show();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Hand over to employee' }))[0]);
    const form = screen.getByRole('dialog');
    fireEvent.click(within(form).getByRole('combobox', { name: /Handover type/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Returning employee' }));
    fireEvent.change(screen.getByLabelText('Find former employee'), { target: { value: 'Asha' } });
    await waitFor(() => expect(api.mock.calls.some(([path]) => path.includes('/employees?'))).toBe(true));
    fireEvent.click(within(form).getByRole('combobox', { name: /Former employee/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Asha Rao (OLD-1)' }));
    fireEvent.click(screen.getByLabelText(/I verified that this candidate/));
    ['Department', 'Designation', 'Employee type', 'Location'].forEach((label) => fireEvent.change(within(form).getByLabelText(label), { target: { value: '1' } }));
    fireEvent.click(within(form).getByRole('button', { name: 'Create employee' }));
    await waitFor(() => expect(calls(api, '/handover')).toHaveLength(1));
    expect(calls(api, '/handover')[0][1].body).toMatchObject({ previous_employee_uuid: 'former-1', rehire_identity_confirmed: true });
    expect(calls(api, '/handover')[0][1].body.confirm_duplicates).toBeUndefined();
  });

  it('asks for confirmation on a possible duplicate before handing over', async () => {
    perms = ['recruitment.offer.manage', 'recruitment.handover'];
    let attempt = 0;
    mockApi(api, {
      '/handover': (_p, opts) => {
        attempt += 1;
        if (!opts.body.confirm_duplicates)
          return Object.assign(new Error('This person may already exist.'), { status: 409, code: 'possible_duplicate', data: { duplicates: [{ name: 'Asha Rao', employee_number: 'E-7' }] } });
        return { employee_uuid: 'e1', employee_number: 'E-100', status: 'active' };
      },
      '/offers': page([offer({ status: 'accepted' })]),
      ...lookups,
    });
    show();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Hand over to employee' }))[0]);
    const form = screen.getByRole('dialog');
    ['Department', 'Designation', 'Employee type', 'Location'].forEach((label) => fireEvent.change(within(form).getByLabelText(label), { target: { value: '1' } }));
    fireEvent.click(within(form).getByRole('button', { name: 'Create employee' }));
    expect(await screen.findByText(/This person may already exist/)).toBeInTheDocument();
    expect(screen.getByText(/Asha Rao E-7/)).toBeInTheDocument();
    expect(attempt).toBe(1);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create anyway' }));
    await waitFor(() => expect(attempt).toBe(2));
    expect(calls(api, '/handover')[1][1].body.confirm_duplicates).toBe(true);
  });
});

describe('Interview rescheduling', () => {
  it('sends local times, the chosen time zone and the previous start to detect stale edits', async () => {
    perms = ['recruitment.view', 'recruitment.manage'];
    mockApi(api, { '/reschedule': { uuid: 'i1' }, '/interviews': page([{ uuid: 'i1', candidate_name: 'Asha', round: 'Technical', starts_at: '2099-10-08T04:30:00Z', ends_at: '2099-10-08T05:30:00Z', timezone: 'Asia/Kolkata', status: 'scheduled' }]), '/applications': page([]), '/users': page([]) });
    render(wrap(<InterviewsPage />, '/recruitment/interviews'));
    fireEvent.click((await screen.findAllByRole('button', { name: 'Reschedule' }))[0]);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('New start'), { target: { value: '2099-10-09T14:00' } });
    fireEvent.change(within(dialog).getByLabelText('New end'), { target: { value: '2099-10-09T15:00' } });
    fireEvent.change(within(dialog).getByLabelText('Reason for rescheduling'), { target: { value: 'Candidate availability' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reschedule' }));
    await waitFor(() => expect(calls(api, '/reschedule')).toHaveLength(1));
    expect(calls(api, '/reschedule')[0][1].body).toMatchObject({ starts_at: '2099-10-09T14:00', ends_at: '2099-10-09T15:00', timezone: 'Asia/Kolkata', expected_starts_at: '2099-10-08T04:30:00Z' });
  });
});
