import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../../../components/ui';
import { api, ApiError } from '../../../lib/api';
import { leaveRoutes } from '../../../routes/leaveRoutes';
import NewLeaveRequest from './NewLeaveRequest';
import MyLeave from './MyLeave';

vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
const auth = vi.hoisted(() => ({ perms: ['*'] }));
vi.mock('../../../lib/auth', () => ({
  useAuth: () => ({
    can: (p) => !p || auth.perms.includes('*') || p.split('|').some((x) => auth.perms.includes(x)),
    enabled: () => true,
    session: { user: { name: 'Asha' } },
  }),
}));

beforeEach(() => {
  api.mockReset();
  auth.perms = ['*'];
});
afterEach(cleanup);

const wrap = (ui, url = '/') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>,
  );

const TYPES = { data: [{ uuid: 't1', name: 'Annual leave', unit: 'half_day' }] };
const PREVIEW = {
  can_submit: true,
  duration: {
    valid: true,
    charged_units: '1.0000',
    calendar_units: '3.0000',
    explanation: ['Saturday and Sunday are weekly offs and are not charged.'],
    warnings: [{ message: 'Short notice for this leave type.' }],
    errors: [],
  },
  conflicts: [{ kind: 'staffing', severity: 'escalate', message: 'Only 2 people would be in on 2026-10-16.' }],
  balance: { tracked: true, accounts: [{ available_before: '10.0000', requested: '1.0000', projected: '9.0000', sufficient: true }] },
  approval: { roles: ['manager'], escalation_reasons: ['staffing'], first_approvers: [{ name: 'Mira Manager' }] },
  documents: [],
  team_impact: [],
};

function flowApi({ preview = PREVIEW, post } = {}) {
  api.mockImplementation((path, opts = {}) => {
    if (path.startsWith('/v1/leave/types')) return Promise.resolve(TYPES);
    if (path.startsWith('/v1/directory')) return Promise.resolve({ data: [] });
    if (path === '/v1/leave/requests/preview') return typeof preview === 'function' ? preview(opts) : Promise.resolve(preview);
    if (path === '/v1/leave/requests' && opts.method === 'POST') return post ? post(opts) : Promise.resolve({ data: { uuid: 'r1' } });
    return Promise.reject(new Error(`unexpected ${path}`));
  });
}
const renderFlow = () =>
  wrap(
    <Routes>
      <Route path="/leave/new" element={<NewLeaveRequest />} />
      <Route path="/leave/requests/:uuid" element={<p>Request detail page</p>} />
    </Routes>,
    '/leave/new?type=t1',
  );
const fillDates = async () => {
  fireEvent.change(await screen.findByLabelText('First day'), { target: { value: '2026-10-15' } });
  fireEvent.change(screen.getByLabelText('Last day'), { target: { value: '2026-10-16' } });
};
const posts = () => api.mock.calls.filter(([p, o]) => p === '/v1/leave/requests' && o?.method === 'POST');

describe('New request flow', () => {
  it('previews the charge, explains it, and submits once with an idempotency key', async () => {
    flowApi();
    renderFlow();
    await fillDates();
    expect(await screen.findByTestId('charged')).toHaveTextContent('1 day');
    expect(screen.getByTestId('projected')).toHaveTextContent('9 days');
    expect(screen.getByText(/weekly offs and are not charged/)).toBeInTheDocument();
    expect(screen.getByText('Short notice for this leave type.')).toBeInTheDocument();
    expect(screen.getByText(/Only 2 people would be in/)).toBeInTheDocument();
    expect(screen.getByText(/Mira Manager/)).toBeInTheDocument();

    const submit = screen.getByRole('button', { name: 'Submit request' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(await screen.findByText('Request detail page')).toBeInTheDocument();
    expect(posts()).toHaveLength(1);
    const [, opts] = posts()[0];
    expect(opts.headers['Idempotency-Key']).toEqual(expect.any(String));
    expect(opts.body).toMatchObject({ leave_type: 't1', start_date: '2026-10-15', end_date: '2026-10-16', portion: 'full_day' });
  });

  it('validates required fields before calling the server', async () => {
    flowApi();
    renderFlow();
    fireEvent.click(await screen.findByRole('button', { name: 'Submit request' }));
    expect(await screen.findByText('Choose the first day.')).toBeInTheDocument();
    expect(posts()).toHaveLength(0);
  });

  it('disables submit when the preview says it cannot proceed', async () => {
    flowApi({
      preview: () =>
        Promise.reject(
          new ApiError('This request cannot proceed.', 422, { request: ['Overlaps leave you already have.'] }, {
            conflicts: [{ kind: 'overlap', severity: 'block', message: 'You already have leave on 2026-10-15.' }],
            duration: { valid: false, errors: ['Overlaps leave you already have.'], charged_units: '0.0000' },
          }),
        ),
    });
    renderFlow();
    await fillDates();
    expect(await screen.findByText('You already have leave on 2026-10-15.')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit request' })).toBeDisabled();
  });

  it('shows a locked period (423) and uses a fresh key for the next attempt', async () => {
    let n = 0;
    flowApi({
      post: () => (++n === 1 ? Promise.reject(new ApiError('Leave for October is locked.', 423)) : Promise.resolve({ data: { uuid: 'r1' } })),
    });
    renderFlow();
    await fillDates();
    await screen.findByTestId('charged');
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/period is locked/);
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));
    await screen.findByText('Request detail page');
    const keys = posts().map(([, o]) => o.headers['Idempotency-Key']);
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toEqual(keys[1]);
  });

  it('keeps the same key after a lost connection so a retry cannot double-submit', async () => {
    let n = 0;
    flowApi({ post: () => (++n === 1 ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve({ data: { uuid: 'r1' }, duplicate: true })) });
    renderFlow();
    await fillDates();
    await screen.findByTestId('charged');
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));
    await screen.findByText('Request detail page');
    const keys = posts().map(([, o]) => o.headers['Idempotency-Key']);
    expect(keys[0]).toEqual(keys[1]);
  });

  it('shows 422 validation and conflict details from submit, and 409 guidance', async () => {
    let n = 0;
    flowApi({
      post: () =>
        ++n === 1
          ? Promise.reject(
              new ApiError('Not enough balance.', 422, { request: ['Your balance is not enough.'] }, {
                conflicts: [{ kind: 'balance', severity: 'block', message: 'Short by 2 days.' }],
              }),
            )
          : Promise.reject(new ApiError('Idempotency key was reused with different data.', 409)),
    });
    renderFlow();
    await fillDates();
    await screen.findByTestId('charged');
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));
    expect(await screen.findByText('Short by 2 days.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Your balance is not enough.');
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Refresh and try again/));
  });
});

describe('Balances, ledger drawer and explainer', () => {
  const balance = {
    account: { id: 'acc1', period_start: '2026-01-01', period_end: '2026-12-31', negative_limit: '0.0000' },
    leave_type: { id: 't1', code: 'AL', name: 'Annual leave', unit: 'half_day' },
    balance: { opening: '2.0000', accrued: '10.0000', carried: '1.0000', consumed: '3.0000', pending: '1.0000', scheduled: '2.0000', expired: '0.0000', available: '7.0000' },
    expiring: [{ entry_id: 'e9', units: '1.0000', expires_on: '2026-12-31' }],
  };
  function balanceApi(over = {}) {
    api.mockImplementation((path) => {
      if (path.startsWith('/v1/leave/me/balances')) return over.balances ?? Promise.resolve({ data: [balance] });
      if (path.startsWith('/v1/leave/forecast')) return Promise.resolve({ accounts: [] });
      if (path.startsWith('/v1/leave/accounts/acc1/ledger'))
        return Promise.resolve({
          integrity: { exact: true, consistent: true },
          entries: [
            { id: 'e1', effective_date: '2026-01-01', kind: 'accrual', units: '10.0000', running_balance: '10.0000', explain: 'Annual entitlement of 12 days, prorated.' },
            { id: 'e2', effective_date: '2026-03-02', kind: 'consumption', units: '-1.0000', running_balance: '9.0000', explain: 'Used for request R-17.', request: { uuid: 'req17' } },
          ],
        });
      if (path.startsWith('/v1/leave/ledger/entries/e1')) return Promise.resolve({ calculation: { basis: 'annual', amount: '12.0000' }, lots: [{}] });
      if (path.startsWith('/v1/leave/explain/balance'))
        return Promise.resolve({ accounts: [{ account_uuid: 'acc1', summary: 'You have 7 days because 13 were credited and 6 are used or reserved.', ledger: [] }] });
      return Promise.reject(new Error(`unexpected ${path}`));
    });
  }

  it('renders every bucket per leave type', async () => {
    balanceApi();
    wrap(<MyLeave />);
    const card = await screen.findByRole('article', { name: 'Annual leave balance' });
    expect(within(card).getByTestId('available-AL')).toHaveTextContent('7 days');
    ['Opening', 'Accrued', 'Carried', 'Used', 'Pending', 'Scheduled', 'Expired'].forEach((l) => expect(within(card).getByText(l)).toBeInTheDocument());
    expect(within(card).getByText(/expires 2026-12-31/)).toBeInTheDocument();
  });

  it('opens a traceable ledger with entry explanations, request links and calculation', async () => {
    balanceApi();
    wrap(<MyLeave />);
    fireEvent.click(await screen.findByRole('button', { name: 'View Annual leave ledger' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Annual entitlement of 12 days, prorated.')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'View request' })).toHaveAttribute('href', '/leave/requests/req17');
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Show calculation' })[0]);
    expect(await within(dialog).findByText('annual')).toBeInTheDocument();
  });

  it('explains why the balance is what it is', async () => {
    balanceApi();
    wrap(<MyLeave />);
    fireEvent.click(await screen.findByRole('button', { name: 'Why this Annual leave balance' }));
    expect(await screen.findByText(/13 were credited and 6 are used/)).toBeInTheDocument();
  });

  it('shows an empty state and an error state with retry', async () => {
    balanceApi({ balances: Promise.resolve({ data: [] }) });
    wrap(<MyLeave />);
    expect(await screen.findByText('No leave balances yet')).toBeInTheDocument();
    cleanup();
    balanceApi({ balances: Promise.reject(new ApiError('Server down', 500)) });
    wrap(<MyLeave />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Server down');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('Permissions', () => {
  const at = (url) => wrap(<Routes>{leaveRoutes}</Routes>, url);
  it('blocks pages the role has no permission for', () => {
    auth.perms = ['leave.view'];
    api.mockResolvedValue({ data: [] });
    at('/leave/approvals');
    expect(screen.getByRole('alert')).toHaveTextContent('Access restricted');
    cleanup();
    at('/leave/team');
    expect(screen.getByRole('alert')).toHaveTextContent('Access restricted');
    cleanup();
    at('/leave/new');
    expect(screen.getByRole('alert')).toHaveTextContent('Access restricted');
  });
  it('hides Request leave from people who cannot request', async () => {
    auth.perms = ['leave.view'];
    api.mockResolvedValue({ data: [] });
    at('/leave');
    await screen.findByText('My leave');
    expect(screen.queryByRole('button', { name: 'Request leave' })).not.toBeInTheDocument();
  });
});
