import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../../lib/theme';

const auth = {
  session: null,
  expired: false,
  login: vi.fn(),
  loginMfa: vi.fn(),
  can: () => true,
};
vi.mock('../../../lib/auth', () => ({ useAuth: () => auth }));
vi.mock('../../../lib/api', async (load) => ({ ...(await load()), api: vi.fn() }));
import { api } from '../../../lib/api';
import { ToastProvider } from '../../../components/ui';
import { AuthPage } from '../../Auth';
import { MfaPanel, SessionsPanel } from '../SecurityAccountPanels';
import { calls, mockApi } from '../../payroll/__tests__/helpers';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const wrap = (ui) => (
  <ToastProvider>
    <ThemeProvider><MemoryRouter>{ui}</MemoryRouter></ThemeProvider>
  </ToastProvider>
);

describe('MFA enrolment', () => {
  it('enrols with a setup key, confirms a code and shows recovery codes once', async () => {
    let enabled = false;
    mockApi(api, {
      '/v1/security/mfa/enroll': { secret: 'JBSWY3DPEHPK3PXP', otpauth_uri: 'otpauth://totp/Acme:a@b.test?secret=JBSWY3DPEHPK3PXP' },
      '/v1/security/mfa/confirm': () => {
        enabled = true;
        return { recovery_codes: ['abcde-fghjk', 'mnpqr-stuvw'] };
      },
      '/v1/security/mfa': () => ({ enabled, pending_enrollment: false, required: false, recovery_codes_remaining: enabled ? 2 : 0 }),
    });
    render(wrap(<MfaPanel />));
    fireEvent.click(await screen.findByRole('button', { name: 'Set up authenticator app' }));
    expect(await screen.findByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
    expect(screen.getByText(/otpauth:\/\/totp\/Acme/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and turn on' }));
    // The panel reloads its status after confirming, so assert once it has settled.
    await waitFor(() => expect(screen.getByText('abcde-fghjk')).toBeInTheDocument());
    expect(screen.getByText(/shown only once/)).toBeInTheDocument();
    expect(calls(api, '/v1/security/mfa/confirm')[0][1].body).toEqual({ code: '123456' });
    await waitFor(() => expect(screen.getByText('Enabled')).toBeInTheDocument());
  });

  it('hides the turn-off action when the workspace requires MFA', async () => {
    mockApi(api, { '/v1/security/mfa': { enabled: true, pending_enrollment: false, required: true, recovery_codes_remaining: 8 } });
    render(wrap(<MfaPanel />));
    expect(await screen.findByText('Required by your workspace')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Turn off' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New recovery codes' })).toBeInTheDocument();
  });
});

describe('login MFA challenge', () => {
  it('asks for a code after the password step and completes sign-in', async () => {
    auth.login.mockResolvedValue({ mfa_required: true });
    auth.loginMfa.mockResolvedValue({});
    render(wrap(<AuthPage mode="login" />));
    fireEvent.change(screen.getByLabelText('Workspace'), { target: { value: 'alpha' } });
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'a@alpha.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPassword123' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/ }));
    const code = await screen.findByLabelText('Authentication code');
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    fireEvent.change(code, { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));
    await waitFor(() => expect(auth.loginMfa).toHaveBeenCalledWith('654321'));
  });

  it('shows an invalid-code error and stays on the challenge', async () => {
    auth.login.mockResolvedValue({ mfa_required: true });
    auth.loginMfa.mockRejectedValue(Object.assign(new Error('That code is not valid.'), { status: 422, errors: {} }));
    render(wrap(<AuthPage mode="login" />));
    fireEvent.change(screen.getByLabelText('Workspace'), { target: { value: 'alpha' } });
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'a@alpha.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPassword123' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/ }));
    fireEvent.change(await screen.findByLabelText('Authentication code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That code is not valid.');
    expect(screen.getByLabelText('Authentication code')).toBeInTheDocument();
  });
});

describe('sessions', () => {
  const sessions = (extra = []) => ({
    data: [
      { uuid: 's1', device: 'Chrome on Windows', ip_address: '10.0.0.1', signed_in_at: '2026-10-01T10:00:00Z', last_seen_at: '2026-10-01T11:00:00Z', current: true },
      { uuid: 's2', device: 'Firefox on Linux', ip_address: '10.0.0.2', signed_in_at: '2026-10-01T09:00:00Z', last_seen_at: '2026-10-01T09:30:00Z', current: false },
      ...extra,
    ],
  });

  it('lists devices, marks this one and revokes another session', async () => {
    let list = sessions();
    mockApi(api, {
      '/v1/security/sessions/s2': () => {
        list = { data: list.data.filter((s) => s.uuid !== 's2') };
        return null;
      },
      '/v1/security/sessions': () => list,
    });
    render(wrap(<SessionsPanel />));
    expect(await screen.findAllByText('Firefox on Linux')).not.toHaveLength(0);
    expect(screen.getAllByText('This device').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: /Sign out Firefox on Linux/ })[0]);
    await waitFor(() => expect(screen.queryAllByText('Firefox on Linux')).toHaveLength(0));
    expect(calls(api, '/v1/security/sessions/s2', 'DELETE')).toHaveLength(1);
  });

  it('signs out all other sessions', async () => {
    mockApi(api, {
      '/v1/security/sessions/revoke-others': { revoked: 1 },
      '/v1/security/sessions': sessions(),
    });
    render(wrap(<SessionsPanel />));
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out all other sessions' }));
    await waitFor(() => expect(calls(api, '/v1/security/sessions/revoke-others')).toHaveLength(1));
  });

  it('shows a 403 state instead of data', async () => {
    mockApi(api, { '/v1/security/sessions': Object.assign(new Error('You do not have access'), { status: 403 }) });
    render(wrap(<SessionsPanel />));
    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
  });
});
