import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let permissions = [];
vi.mock('../../../lib/auth', () => ({
  useAuth: () => ({ can: (key) => key.split('|').some((item) => permissions.includes(item)), enabled: () => true }),
}));
vi.mock('../../../lib/api', async (load) => ({ ...(await load()), api: vi.fn() }));
import { api } from '../../../lib/api';
import { ToastProvider } from '../../../components/ui';
import { changeGate, finalizeBlockers, pipActions, validateCycle, validatePip, validateScale, validateTemplate } from '../../../lib/performanceApi';
import { CalibrationPage } from '../CalibrationPage';
import { ConfigurationPage } from '../ConfigPages';
import { FeedbackPage } from '../CollabPages';
import { PipDetailPage, PipsPage } from '../PipPages';
import { PerformanceDashboardPage } from '../PerformancePages';
import { calls, mockApi } from '../../payroll/__tests__/helpers';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const page = (rows) => ({ data: rows, current_page: 1, last_page: 1, total: rows.length });
const wrap = (ui, path = '/') => <ToastProvider><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></ToastProvider>;
const cycle = { uuid: 'c1', name: 'Annual 2026', status: 'calibration' };

const workspace = (changes) => ({
  cycle,
  total: 2,
  distribution: { 3: 1, 4: 1 },
  fairness_warnings: [{ group: 'department', size: 4, average: '4.20', overall: '3.50', message: 'Review for consistency; this is a prompt for discussion.' }],
  reviews: [
    { uuid: 'r1', employee: { name: 'Asha Rao' }, status: 'calibration', computed_score: '3.00', final_score: null, manager_submitted: true },
    { uuid: 'r2', employee: { name: 'Mira Shah' }, status: 'calibration', computed_score: '4.00', final_score: null, manager_submitted: false },
  ],
  changes,
});

describe('Calibration maker-checker', () => {
  it('gates decisions: never your own change, and only with the approve permission', () => {
    expect(changeGate({ status: 'pending', proposed_by_me: true }, true)).toEqual({ canDecide: false, waitingForOther: true });
    expect(changeGate({ status: 'pending', proposed_by_me: false }, true).canDecide).toBe(true);
    expect(changeGate({ status: 'pending', proposed_by_me: false }, false).canDecide).toBe(false);
    expect(changeGate({ status: 'approved', proposed_by_me: false }, true).canDecide).toBe(false);
  });

  it('shows Decide only for another user\'s pending change and explains the wait for your own', async () => {
    permissions = ['performance.calibrate', 'performance.calibrate.approve'];
    mockApi(api, {
      '/calibration': workspace([
        { uuid: 'ch1', review_uuid: 'r1', from_score: '3.00', to_score: '4.00', justification: 'Evidence from projects', status: 'pending', proposed_by_me: true },
        { uuid: 'ch2', review_uuid: 'r2', from_score: '4.00', to_score: '3.00', justification: 'Peer evidence', status: 'pending', proposed_by_me: false },
      ]),
      '/cycles': page([cycle]),
    });
    render(wrap(<CalibrationPage />));
    expect(await screen.findByText('Annual 2026')).toBeInTheDocument();
    expect((await screen.findAllByText(/You cannot approve your own change/)).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Decide' })).toHaveLength(1);
    expect(screen.getAllByText(/Consistency prompt/).length).toBeGreaterThan(0);
  });

  it('hides Decide when the user may only propose, and proposing requires a reason', async () => {
    permissions = ['performance.calibrate'];
    mockApi(api, {
      '/calibration': workspace([{ uuid: 'ch2', review_uuid: 'r2', from_score: '4.00', to_score: '3.00', justification: 'Peer evidence', status: 'pending', proposed_by_me: false }]),
      '/cycles': page([cycle]),
    });
    render(wrap(<CalibrationPage />));
    await screen.findByText('Annual 2026');
    expect(screen.queryByRole('button', { name: 'Decide' })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Propose change' })[0]);
    fireEvent.change(await screen.findByLabelText('New score'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Reason for the change'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect((await screen.findAllByText('Explain the reason in at least 10 characters.')).length).toBeGreaterThan(0);
    expect(calls(api, '/calibration-changes')).toHaveLength(0);
  });

  it('blocks finalize while changes are pending and lists reviews that are not ready', async () => {
    permissions = ['performance.calibrate.approve'];
    const ws = workspace([{ uuid: 'ch2', review_uuid: 'r2', from_score: '4.00', to_score: '3.00', justification: 'Peer evidence', status: 'pending', proposed_by_me: false }]);
    expect(finalizeBlockers(ws)).toMatchObject({ pending: 1, blocked: true });
    expect(finalizeBlockers(ws).notReady.map((r) => r.uuid)).toEqual(['r2']);
    mockApi(api, { '/calibration': ws, '/cycles': page([cycle]) });
    render(wrap(<CalibrationPage />));
    fireEvent.click(await screen.findByRole('button', { name: 'Finalize cycle' }));
    expect(await screen.findByText(/still wait for a decision/)).toBeInTheDocument();
    expect(screen.getByText('Mira Shah', { selector: 'li' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Finalize cycle' }).at(-1)).toBeDisabled();
    expect(calls(api, '/finalize')).toHaveLength(0);
  });

  it('shows the 403 state when the role cannot calibrate', () => {
    permissions = ['performance.self'];
    mockApi(api, {});
    render(wrap(<CalibrationPage />));
    expect(screen.getByText(/do not allow access/)).toBeInTheDocument();
  });
});

describe('Configuration validation', () => {
  it('validates scales, templates, cycles and plans like the server', () => {
    expect(() => validateScale({ code: 'bad', name: 'x', min: 1, max: 5, labels: '1=a\n5=b' })).toThrow();
    expect(() => validateScale({ code: 'FIVE', name: 'x', min: 5, max: 1, labels: '1=a\n5=b' })).toThrow();
    expect(() => validateScale({ code: 'FIVE', name: 'x', min: 1, max: 5, labels: '1=a\n9=b' })).toThrow(/Please fix/);
    expect(validateScale({ code: 'FIVE', name: 'x', min: 1, max: 5, labels: '1=Low\n5=High' }).labels).toEqual([{ value: 1, label: 'Low' }, { value: 5, label: 'High' }]);
    const base = { name: 'T', scale_code: 'FIVE', sections: [{ key: 'goals', title: 'Goals', type: 'goals', weight: '50' }], reviewer_weights: { manager: 60, self: 20, peer: 20, skip: 0 } };
    expect(validateTemplate(base).sections[0].weight).toBe(50);
    expect(() => validateTemplate({ ...base, reviewer_weights: { manager: 60, self: 20, peer: 30, skip: 0 } })).toThrow();
    expect(() => validateTemplate({ ...base, sections: [...base.sections, { key: 'goals', title: 'Dup', type: 'goals', weight: '10' }] })).toThrow();
    expect(() => validateTemplate({ ...base, scale_code: '' })).toThrow();
    const cyc = { name: 'C', template_uuid: 't', start_date: '2026-01-01', end_date: '2026-12-31', min_tenure_days: '90', min_peer_responses: 2 };
    expect(validateCycle(cyc).eligibility).toEqual({ min_tenure_days: 90, exclude_probation: false });
    expect(() => validateCycle({ ...cyc, end_date: '2026-01-01' })).toThrow();
    expect(() => validateCycle({ ...cyc, template_uuid: '' })).toThrow();
    expect(() => validateCycle({ ...cyc, self_due: '2025-12-01' })).toThrow();
    const pip = { employee_uuid: 'e', reason: 'Missed targets repeatedly', start_date: '2026-10-01', end_date: '2026-12-01', checkpoints: '2026-11-01 | Deliver report' };
    expect(validatePip(pip).checkpoints).toEqual([{ due_on: '2026-11-01', expectation: 'Deliver report' }]);
    expect(() => validatePip({ ...pip, reason: 'short' })).toThrow();
    expect(() => validatePip({ ...pip, checkpoints: '2027-01-01 | Late' })).toThrow();
  });

  it('shows a live reviewer-weight total in the template builder and refuses to submit an invalid template', async () => {
    permissions = ['performance.cycles.manage'];
    mockApi(api, {
      '/rating-scales': page([{ uuid: 's1', code: 'FIVE', name: 'Five point', min: '1.00', max: '5.00', labels: [] }]),
      '/competencies': page([]),
      '/templates': page([]),
    });
    render(wrap(<ConfigurationPage />));
    fireEvent.click(await screen.findByRole('tab', { name: 'Templates' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create template' }));
    expect(await screen.findByText(/Reviewer weights total 100\./)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Peer weight'), { target: { value: '30' } });
    expect(screen.getByText(/total 110 - must be exactly 100/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Template name'), { target: { value: 'Annual' } });
    fireEvent.change(screen.getByLabelText('Section 1 key'), { target: { value: 'goals' } });
    fireEvent.change(screen.getByLabelText('Section 1 title'), { target: { value: 'Goals' } });
    fireEvent.change(screen.getByLabelText('Section 1 weight'), { target: { value: '100' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create template' }).at(-1));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(calls(api, '/templates')).toHaveLength(0);
  });
});

describe('Feedback privacy and anonymity messaging', () => {
  it('explains who can read feedback and never reveals an anonymous sender', async () => {
    permissions = ['performance.self'];
    mockApi(api, {
      '/feedback/received': page([
        { uuid: 'f1', kind: 'feedback', visibility: 'recipient', message: 'Great workshop', anonymous: true, from: null, mine: false, at: '2026-10-01T10:00:00Z' },
        { uuid: 'f2', kind: 'recognition', visibility: 'recipient', message: 'Thanks for the help', anonymous: false, from: 'Dev Patel', mine: false, at: '2026-10-02T10:00:00Z' },
      ]),
    });
    render(wrap(<FeedbackPage />));
    expect(screen.getByText(/shows your name to the recipient/)).toBeInTheDocument();
    expect(screen.getByText(/HR does not see it by default/)).toBeInTheDocument();
    expect((await screen.findAllByText('Anonymous sender')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dev Patel').length).toBeGreaterThan(0);
  });
});

describe('PIP confidentiality and gating', () => {
  it('only allows the actions the status permits', () => {
    expect(pipActions('draft')).toEqual({ activate: true, checkpoint: false, complete: false });
    expect(pipActions('active')).toEqual({ activate: false, checkpoint: true, complete: true });
    expect(pipActions('completed_success')).toEqual({ activate: false, checkpoint: false, complete: false });
  });

  const pip = (status) => ({ uuid: 'p1', status, employee: { name: 'Omar Diaz' }, reason: 'Missed targets', support_plan: 'Weekly coaching', start_date: '2026-10-01', end_date: '2026-12-01', checkpoints: [{ uuid: 'k1', due_on: '2026-11-01', expectation: 'Deliver report', status: 'pending' }] });
  const detail = () => render(wrap(<Routes><Route path="/performance/pips/:uuid" element={<PipDetailPage />} /></Routes>, '/performance/pips/p1'));

  it('draft plan: confidentiality banner, activation allowed, no checkpoint or completion actions', async () => {
    permissions = ['performance.pip.manage'];
    mockApi(api, { '/pips/p1': pip('draft') });
    detail();
    expect(await screen.findByRole('button', { name: 'Activate plan' })).toBeInTheDocument();
    expect(screen.getByText(/Every view and change is audited/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete plan' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record result' })).not.toBeInTheDocument();
  });

  it('active plan: checkpoints and completion allowed, activation hidden', async () => {
    permissions = ['performance.pip.manage'];
    mockApi(api, { '/pips/p1': pip('active') });
    detail();
    expect(await screen.findByRole('button', { name: 'Complete plan' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Record result' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Activate plan' })).not.toBeInTheDocument();
  });

  it('is 403 for users without the PIP permission and shows the empty state for HR with no plans', async () => {
    permissions = ['performance.self'];
    mockApi(api, {});
    const { unmount } = render(wrap(<PipsPage />));
    expect(screen.getByText(/do not allow access/)).toBeInTheDocument();
    unmount();
    permissions = ['performance.pip.manage'];
    mockApi(api, { '/pips': page([]) });
    render(wrap(<PipsPage />));
    expect(await screen.findByText('No improvement plans')).toBeInTheDocument();
  });
});

describe('Cycle dashboard', () => {
  it('lists late reviews without naming reviewers', async () => {
    permissions = ['performance.reports.view'];
    mockApi(api, {
      '/dashboard': { cycle: { uuid: 'c1', name: 'Annual 2026' }, reviews: { total: 4 }, late_responses: 1, calibration: { pending_changes: 0 }, goals: { pending_approval: 0 }, late_list: [{ review_uuid: 'r1', employee: 'Asha Rao', reviewer_type: 'peer', due_on: '2026-10-01', days_late: 10 }] },
      '/cycles': page([]),
    });
    render(wrap(<PerformanceDashboardPage />));
    expect((await screen.findAllByText('Asha Rao')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('10 days').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Open review' })[0]).toHaveAttribute('href', '/performance/reviews/r1');
  });
});
