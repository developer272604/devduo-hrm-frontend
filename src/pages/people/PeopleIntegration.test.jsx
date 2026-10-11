import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import EmployeeDirectory from './EmployeeDirectory';
import PeopleActionCenter from './PeopleActionCenter';
import { peopleRoutes } from '../../routes/peopleRoutes';
import { ToastProvider } from '../../components/ui';
import { api } from '../../lib/api';

vi.mock('../../lib/auth', () => ({ useAuth: () => ({ can: () => true, enabled: () => true }) }));
vi.mock('../../lib/api', async (original) => ({
  ...(await original()),
  api: vi.fn(),
  download: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function Location() {
  const l = useLocation();
  return <p>{l.pathname + l.search + l.hash}</p>;
}
function mount(element, path = '/people') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>{element}</ToastProvider>
    </MemoryRouter>,
  );
}

describe('People integration', () => {
  it('preserves the insight query through the legacy employee directory redirect', async () => {
    api.mockResolvedValue({ data: [], last_page: 1 });
    mount(
      <>
        <Location />
        <Routes>{peopleRoutes}</Routes>
      </>,
      '/employees?insight=people.without_manager',
    );
    expect(await screen.findByText('/people?insight=people.without_manager')).toBeInTheDocument();
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        '/v1/people/action-center/people.without_manager/employees?page=1',
        expect.anything(),
      ),
    );
  });
  it('preserves profile deep links and anchors', async () => {
    api.mockResolvedValue({
      uuid: 'abc',
      header: { display_name: 'Alex' },
      person: {},
      sections: [],
    });
    mount(
      <>
        <Location />
        <Routes>{peopleRoutes}</Routes>
      </>,
      '/employees/abc?section=documents#record',
    );
    expect(await screen.findByText('/people/abc?section=documents#record')).toBeInTheDocument();
  });
  it('shows affected employees from the insight API rather than the full directory', async () => {
    api.mockResolvedValue({
      data: [{ employee_uuid: 'abc', name: 'Alex Morgan', detail: 'Missing manager' }],
      last_page: 1,
    });
    mount(<EmployeeDirectory />, '/people?insight=people.without_manager');
    expect(await screen.findAllByText('Alex Morgan')).toHaveLength(2);
    expect(api.mock.calls[0][0]).toContain('/action-center/people.without_manager/employees');
    expect(screen.queryByPlaceholderText('Search people…')).not.toBeInTheDocument();
  });
  it('requires confirmation before sending insight reminders', async () => {
    api.mockResolvedValue({
      data: [
        {
          key: 'people.incomplete',
          title: 'One incomplete profile',
          severity: 'warning',
          description: 'Missing required data',
          sample: [],
          actions: [
            {
              label: 'Remind employee',
              kind: 'api',
              method: 'POST',
              endpoint: '/api/v1/people/action-center/remind',
              body: { topic: 'profile' },
              requires_confirmation: true,
            },
          ],
        },
      ],
    });
    mount(<PeopleActionCenter />);
    fireEvent.click(await screen.findByRole('button', { name: 'Remind employee' }));
    expect(api.mock.calls.filter(([, o]) => o?.method === 'POST')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Send reminders' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/v1/people/action-center/remind', {
        method: 'POST',
        body: { topic: 'profile' },
      }),
    );
  });
});
