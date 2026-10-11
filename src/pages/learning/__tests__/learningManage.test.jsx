import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let permissions = [];
vi.mock('../../../lib/auth', () => ({ useAuth: () => ({ can: (key) => key.split('|').some((p) => permissions.includes(p)), enabled: () => true }) }));
vi.mock('../../../lib/api', async (load) => ({ ...(await load()), api: vi.fn() }));
import { api } from '../../../lib/api';
import { ToastProvider } from '../../../components/ui';
import { AssessmentPage, CompliancePage, DashboardPage, TeamLearningPage } from '../LearningManagePages';
import { calls, mockApi } from '../../payroll/__tests__/helpers';

afterEach(() => { cleanup(); vi.resetAllMocks(); });
const wrap = (ui, path = '/') => <ToastProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={ui} /><Route path="/learning/assessment/:courseUuid" element={ui} /></Routes></MemoryRouter></ToastProvider>;

const pending = { uuid: 'enr-1', status: 'pending_approval', due_on: null, employee: { uuid: 'e1', name: 'Arun Kumar' }, course: { uuid: 'c1', title: 'Safety basics' }, session: null };

describe('Team learning', () => {
  it('approves a pending enrolment', async () => {
    permissions = ['learning.enrol.approve', 'learning.view'];
    mockApi(api, { '/enrolments/enr-1/decision': { ...pending, status: 'enrolled' }, '/enrolments': { data: [pending] } });
    render(wrap(<TeamLearningPage />));
    expect(await screen.findByText('Arun Kumar')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(calls(api, '/decision')).toHaveLength(1));
    expect(calls(api, '/decision')[0][1].body).toEqual({ decision: 'approve' });
  });

  it('requires a reason to reject', async () => {
    permissions = ['learning.enrol.approve', 'learning.view'];
    mockApi(api, { '/enrolments/enr-1/decision': { ...pending, status: 'rejected' }, '/enrolments': { data: [pending] } });
    render(wrap(<TeamLearningPage />));
    await screen.findByText('Arun Kumar');
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    const reason = await screen.findByLabelText('Reason');
    fireEvent.change(reason, { target: { value: 'Not this quarter' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Reject' }).at(-1));
    await waitFor(() => expect(calls(api, '/decision')).toHaveLength(1));
    expect(calls(api, '/decision')[0][1].body).toEqual({ decision: 'reject', note: 'Not this quarter' });
  });

  it('shows a restricted state when the API returns 403', async () => {
    permissions = ['learning.view'];
    api.mockRejectedValue(Object.assign(new Error('No access'), { status: 403 }));
    render(wrap(<TeamLearningPage />));
    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });
});

describe('Compliance', () => {
  it('shows team compliance and lets an administrator run the rules', async () => {
    permissions = ['learning.assign.manage', 'learning.view'];
    mockApi(api, {
      '/compliance/run': { generated: { assigned: 1 }, escalation: {} },
      '/compliance/status': { summary: { employees: 1, overdue_employees: 1, assignments: 2, completed: 1, compliance_pct: '50.0' }, rows: [{ employee: { uuid: 'e1', name: 'Arun Kumar' }, total: 2, completed: 1, open: 1, overdue: 1, due_soon: 0, next_due: '2026-10-17', status: 'overdue' }] },
      '/compliance/rules': [], '/compliance/assignments': [], '/lookups': {}, '/courses': { data: [] },
    });
    render(wrap(<CompliancePage />));
    expect(await screen.findByText('Arun Kumar')).toBeInTheDocument();
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run now' }));
    await waitFor(() => expect(calls(api, '/compliance/run')).toHaveLength(1));
  });
});

describe('Assessment', () => {
  const quiz = { uuid: 'asm-1', title: 'Safety quiz', pass_percent: 60, attempts_remaining: 2, questions: [{ id: 'q1', text: 'Pick the exit', options: ['Window', 'Door'], points: 2, multiple: false }] };

  it('submits selected answers and shows the server result', async () => {
    permissions = ['learning.self'];
    mockApi(api, {
      '/attempts': { attempt_no: 1, percent: '100.00', passed: true, results: { q1: true }, course_completed: true, note: null },
      '/assessment': quiz,
    });
    render(wrap(<AssessmentPage />, '/learning/assessment/course-1'));
    fireEvent.click(await screen.findByLabelText('Door'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));
    await waitFor(() => expect(calls(api, '/attempts')).toHaveLength(1));
    expect(calls(api, '/attempts')[0][1].body).toEqual({ answers: { q1: [1] } });
    expect(await screen.findByText(/Passed with 100.00%/)).toBeInTheDocument();
    expect(screen.getByText('Correct')).toBeInTheDocument();
  });
});

describe('Dashboard', () => {
  const base = { people: 3, completions_this_month: 1, pending_approvals: 0, overdue_learning: 0, compliance: { compliance_pct: '80.0', overdue_assignments: 1 }, certificates_expiring: 0, skill_gaps: [] };

  it('masks cost when the viewer may not see it', async () => {
    permissions = ['learning.view'];
    mockApi(api, { '/dashboard': { ...base, cost: null, cost_masked: true } });
    render(wrap(<DashboardPage />));
    expect(await screen.findByText('Hidden')).toBeInTheDocument();
  });

  it('shows decimal totals per currency', async () => {
    permissions = ['learning.view'];
    mockApi(api, { '/dashboard': { ...base, cost: { INR: '0.30' }, cost_masked: false } });
    render(wrap(<DashboardPage />));
    expect(await screen.findByText('INR 0.30')).toBeInTheDocument();
  });
});
