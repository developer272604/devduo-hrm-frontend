import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let permissions = [];
vi.mock('../../../lib/auth', () => ({ useAuth: () => ({ can: (key) => key.split('|').some((p) => permissions.includes(p)), enabled: () => true }) }));
vi.mock('../../../lib/api', async (load) => ({ ...(await load()), api: vi.fn() }));
import { api } from '../../../lib/api';
import { ToastProvider } from '../../../components/ui';
import { AnnouncementsPage, CommunicationPreferencesPage, KnowledgePage, RecognitionPage, SurveyResultsPage, SurveysPage, TicketDetailPage, TicketListPage } from '../ExperiencePages';
import { calls, mockApi } from '../../payroll/__tests__/helpers';

afterEach(() => { cleanup(); vi.resetAllMocks(); });
const wrap = (ui, path = '/') => <ToastProvider><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></ToastProvider>;

describe('HR helpdesk', () => {
  it('saves in-app and email communication preferences', async () => {
    permissions = ['experience.self'];
    mockApi(api, {
      '/communication-preferences': (path, opts) => opts.method === 'PUT'
        ? { channels: { announcements: { in_app: false, email: false }, surveys: { in_app: true, email: false }, recognition: { in_app: true, email: false }, events: { in_app: true, email: false } } }
        : { channels: { announcements: { in_app: true, email: false }, surveys: { in_app: true, email: false }, recognition: { in_app: true, email: false }, events: { in_app: true, email: false } } },
    });
    render(wrap(<CommunicationPreferencesPage />));
    fireEvent.click((await screen.findAllByLabelText('In-app notifications'))[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    expect(await screen.findByText('Communication preferences saved')).toBeInTheDocument();
    expect(calls(api, '/communication-preferences', 'PUT')).toHaveLength(1);
  });

  it('lists employee requests without exposing HR-only notes', async () => {
    permissions = ['experience.self'];
    mockApi(api, {
      '/tickets/t1': { uuid: 't1', subject: 'Payslip question', category: { name: 'Payroll' }, status: 'open', description: 'Need help', comments: [{ uuid: 'c1', author: 'HR', body: 'Public update', visibility: 'public' }] },
    });
    render(wrap(<Routes><Route path="/experience/tickets/:uuid" element={<TicketDetailPage />} /></Routes>, '/experience/tickets/t1'));
    expect(await screen.findByText('Public update')).toBeInTheDocument();
    expect(screen.queryByText('Internal note (visible to HR service staff only)')).not.toBeInTheDocument();
  });

  it('shows private notes and the private-note control only to HR ticket managers', async () => {
    permissions = ['experience.ticket.manage'];
    mockApi(api, {
      '/tickets/t1': { uuid: 't1', subject: 'Payslip question', category: { name: 'Payroll' }, status: 'open', description: 'Need help', comments: [{ uuid: 'c1', author: 'HR', body: 'Internal investigation', visibility: 'private' }] },
    });
    render(wrap(<Routes><Route path="/experience/tickets/:uuid" element={<TicketDetailPage />} /></Routes>, '/experience/tickets/t1'));
    expect(await screen.findByText('Internal investigation')).toBeInTheDocument();
    expect(screen.getByText('Internal HR note')).toBeInTheDocument();
    expect(screen.getByLabelText('Internal note (visible to HR service staff only)')).toBeInTheDocument();
  });

  it('lets ticket managers record a private escalation reason', async () => {
    permissions = ['experience.ticket.manage'];
    let escalated = false;
    const ticketView = () => ({ uuid: 't1', subject: 'Payslip question', category: { name: 'Payroll' }, status: 'open', description: 'Need help', comments: [], escalations: escalated ? [{ uuid: 'e1', type: 'manual', level: 1, reason: 'Payroll deadline at risk' }] : [] });
    mockApi(api, {
      '/tickets/t1/escalate': () => { escalated = true; return { uuid: 'e1', priority: 'high' }; },
      '/tickets/t1': ticketView,
    });
    render(wrap(<Routes><Route path="/experience/tickets/:uuid" element={<TicketDetailPage />} /></Routes>, '/experience/tickets/t1'));
    fireEvent.change(await screen.findByLabelText('Escalation reason'), { target: { value: 'Payroll deadline at risk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Escalate' }));
    await screen.findByText(/Level 1 · manual: Payroll deadline at risk/);
    expect(calls(api, '/tickets/t1/escalate')).toHaveLength(1);
  });

  it('shows the employee request list and new request action', async () => {
    permissions = ['experience.self'];
    mockApi(api, { '/tickets': { data: [{ uuid: 't1', subject: 'Payslip question', category: { name: 'Payroll' }, status: 'open', employee: { name: 'Asha Rao' } }] } });
    render(wrap(<TicketListPage />));
    expect(await screen.findByText('Payslip question')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New request' })).toBeInTheDocument();
  });

  it('filters the service queue by assigned owner', async () => {
    permissions = ['experience.ticket.manage'];
    mockApi(api, {
      '/service-categories': [],
      '/tickets/assignees': [{ id: 7, name: 'HR Agent' }],
      '/tickets?assignee=7': { data: [] },
    });
    render(wrap(<TicketListPage />));
    fireEvent.change(await screen.findByLabelText('Queue assignment'), { target: { value: '7' } });
    await screen.findByText('No requests found.');
    expect(calls(api, '/tickets?assignee=7', 'GET')).toHaveLength(1);
  });

  it('renders searchable published guidance', async () => {
    permissions = ['experience.self'];
    mockApi(api, { '/knowledge': { data: [{ uuid: 'a1', title: 'Payroll dates', summary: 'When payroll is processed', locale: 'en', version: 2, status: 'published', visibility: 'employee' }] } });
    render(wrap(<KnowledgePage />));
    expect(await screen.findByText('Payroll dates')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search articles'), { target: { value: 'payroll' } });
  });

  it('suggests relevant knowledge articles while an employee writes a ticket', async () => {
    permissions = ['experience.self'];
    mockApi(api, {
      '/service-categories': [{ uuid: 'cat1', name: 'Payroll' }],
      '/tickets': { data: [] },
      '/knowledge': { data: [{ uuid: 'a1', title: 'Payslip help', summary: 'Find your payslip' }] },
    });
    render(wrap(<TicketListPage />));
    fireEvent.click(await screen.findByRole('button', { name: 'New request' }));
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Payslip access issue' } });
    expect(await screen.findByRole('link', { name: 'Payslip help' })).toHaveAttribute('href', '/experience/knowledge/a1');
  });

  it('lets employees mark an announcement read and acknowledge it', async () => {
    permissions = ['experience.self'];
    mockApi(api, {
      '/announcements/notice1/read': { uuid: 'notice1', read_at: '2026-10-10T10:00:00Z' },
      '/announcements/notice1/acknowledge': { uuid: 'notice1', read_at: '2026-10-10T10:00:00Z', acknowledged_at: '2026-10-10T10:02:00Z' },
      '/announcements': { data: [{ uuid: 'notice1', title: 'Benefits enrollment', body: 'Please review the plans.', status: 'published', acknowledgment_required: true, publish_at: '2026-10-10', read_at: null, acknowledged_at: null }] },
    });
    render(wrap(<AnnouncementsPage />));
    expect(await screen.findByText('Benefits enrollment')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    await screen.findByRole('button', { name: 'Acknowledge' });
    expect(calls(api, '/announcements/notice1/read')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
    await screen.findByRole('button', { name: 'Acknowledge' });
    expect(calls(api, '/announcements/notice1/acknowledge')).toHaveLength(1);
  });

  it('lets announcement managers upload a private file to a draft', async () => {
    permissions = ['experience.announcement.manage'];
    mockApi(api, {
      '/announcements/a1/attachments': { uuid: 'file1', filename: 'guide.pdf', size_bytes: 12 },
      '/announcements': { data: [{ uuid: 'a1', title: 'Employee guide', body: 'Read the guide.', status: 'draft', attachments: [] }] },
    });
    render(wrap(<AnnouncementsPage />));
    const file = new File(['guide'], 'guide.pdf', { type: 'application/pdf' });
    fireEvent.change(await screen.findByLabelText('Attachment for Employee guide'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload attachment' }));
    expect(await screen.findByText('Attachment uploaded')).toBeInTheDocument();
    expect(calls(api, '/announcements/a1/attachments')).toHaveLength(1);
    expect(calls(api, '/announcements/a1/attachments')[0][1].body).toBeInstanceOf(FormData);
  });

  it('lets employees RSVP to an event campaign', async () => {
    permissions = ['experience.self'];
    mockApi(api, {
      '/announcements/event1/rsvp': { response: 'attending' },
      '/announcements': { data: [{ uuid: 'event1', communication_type: 'event', title: 'Team gathering', body: 'Join us.', status: 'published', event_starts_at: '2026-10-20T10:00:00Z', event_location: 'Main hall', my_rsvp: null }] },
    });
    render(wrap(<AnnouncementsPage />));
    expect(await screen.findByText('Team gathering')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Attending' }));
    expect(await screen.findByText('Event response saved')).toBeInTheDocument();
    expect(calls(api, '/announcements/event1/rsvp', 'PUT')).toHaveLength(1);
  });

  it('submits anonymous rating survey answers without showing identity', async () => {
    permissions = ['experience.self'];
    mockApi(api, {
      '/surveys/s1/responses': { submitted: true },
      '/surveys': { data: [{ uuid: 's1', title: 'Team pulse', status: 'published', submitted: false, questions: [{ uuid: 'q1', prompt: 'Is workload manageable?', kind: 'rating', scale: [1, 2, 3, 4, 5] }] }] },
    });
    render(wrap(<SurveysPage />));
    expect(await screen.findByText('Team pulse')).toBeInTheDocument();
    expect(screen.getByText(/Anonymous response · answers are stored only as aggregate counts/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Is workload manageable?'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit anonymous response' }));
    await screen.findByRole('button', { name: 'Submit anonymous response' });
    expect(calls(api, '/surveys/s1/responses')).toHaveLength(1);
  });

  it('builds survey drafts from the reusable question bank and rating scales', async () => {
    permissions = ['experience.survey.manage'];
    mockApi(api, {
      '/survey-catalog/questions': [{ uuid: 'bank-q1', prompt: 'I have the resources I need.', category: 'resources' }],
      '/survey-catalog/scales': [{ code: 'FIVE', name: 'Agreement', minimum_value: 1, maximum_value: 5, labels: {} }, { code: 'THREE', name: 'Three point agreement', minimum_value: 1, maximum_value: 3, labels: { 1: 'Disagree', 2: 'Neutral', 3: 'Agree' } }],
      '/surveys': (path, opts) => opts.method === 'POST' ? { uuid: 'survey-new' } : { data: [] },
    });
    render(wrap(<SurveysPage />));
    fireEvent.click(await screen.findByRole('button', { name: 'Create survey' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Resource pulse' } });
    fireEvent.change(screen.getByLabelText('Retention end date'), { target: { value: '2027-01-01' } });
    fireEvent.click(await screen.findByLabelText('I have the resources I need. · resources'));
    fireEvent.click(screen.getByRole('combobox', { name: /Default rating scale/ }));
    fireEvent.click(await screen.findByRole('option', { name: /Three point agreement/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Survey draft created')).toBeInTheDocument();
    const [, request] = calls(api, '/surveys', 'POST')[0];
    expect(request.body.questions).toEqual([{ bank_question_uuid: 'bank-q1' }]);
    expect(request.body.scale_code).toBe('THREE');
  });

  it('explains identified survey privacy and requires explicit participant consent', async () => {
    permissions = ['experience.self'];
    mockApi(api, {
      '/surveys': { data: [{ uuid: 's-id', title: 'Identified check-in', status: 'published', response_mode: 'identified', requires_consent: true, submitted: false, questions: [{ uuid: 'q1', prompt: 'What support do you need?', scale: [1, 2, 3, 4, 5] }] }] },
    });
    render(wrap(<SurveysPage />));
    expect(await screen.findByText(/specially authorized administrators can view your name and answers/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /my name and ratings will be available/ })).toBeRequired();
    expect(screen.getByRole('button', { name: 'Submit identified response' })).toBeInTheDocument();
  });

  it('offers an aggregate-only secure CSV export after results are thresholded', async () => {
    permissions = ['experience.survey.manage'];
    mockApi(api, {
      '/surveys/s1/results': { response_mode: 'anonymous', response_count: 5, minimum_responses: 5, questions: [{ uuid: 'q1', prompt: 'Team support', distribution: [{ rating: 1, suppressed: true }, { rating: 2, suppressed: true }, { rating: 3, suppressed: true }, { rating: 4, count: 5, suppressed: false }, { rating: 5, suppressed: true }] }] },
    });
    render(wrap(<Routes><Route path="/experience/surveys/:uuid/results" element={<SurveyResultsPage />} /></Routes>, '/experience/surveys/s1/results'));
    expect(await screen.findByRole('button', { name: 'Download secure aggregate CSV' })).toBeInTheDocument();
  });

  it('lets an employee opt out of receiving recognition', async () => {
    permissions = ['experience.self'];
    mockApi(api, {
      '/recognitions/preference': (path, opts) => opts.method === 'PUT' ? { opted_out: true } : { opted_out: false },
      '/recognitions/recipients?search=': [],
      '/recognitions': { data: [] },
    });
    render(wrap(<RecognitionPage />));
    const toggle = await screen.findByRole('checkbox', { name: 'Opt out of receiving recognition' });
    fireEvent.click(toggle);
    expect(await screen.findByRole('checkbox', { name: 'Opt out of receiving recognition' })).toBeChecked();
  });
});
