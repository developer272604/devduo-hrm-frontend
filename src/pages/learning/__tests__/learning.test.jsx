import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let permissions = [];
vi.mock('../../../lib/auth', () => ({ useAuth: () => ({ can: (key) => key.split('|').some((p) => permissions.includes(p)), enabled: () => true }) }));
vi.mock('../../../lib/api', async (load) => ({ ...(await load()), api: vi.fn() }));
import { api } from '../../../lib/api';
import { ToastProvider } from '../../../components/ui';
import { CatalogPage, MySkillsPage } from '../LearningPages';
import { calls, mockApi } from '../../payroll/__tests__/helpers';

afterEach(() => { cleanup(); vi.resetAllMocks(); });
const wrap = (ui) => <ToastProvider><MemoryRouter>{ui}</MemoryRouter></ToastProvider>;

describe('Learning core screens', () => {
  it('lists published courses and submits a self-enrolment', async () => {
    permissions = ['learning.self'];
    mockApi(api, {
      '/courses': { data: [{ uuid: 'course-1', code: 'SAFE-101', title: 'Safety basics', delivery: 'online', status: 'published', duration_hours: 2 }] },
      '/enrol': { uuid: 'enrol-1', status: 'enrolled' },
    });
    render(wrap(<CatalogPage />));
    expect(await screen.findByText('Safety basics')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enroll' }));
    await waitFor(() => expect(calls(api, '/enrol')).toHaveLength(1));
  });

  it('declares a skill at the selected level', async () => {
    permissions = ['learning.self'];
    // The mock uses path matching; the submit route is matched before the base skill route.
    api.mockImplementation(async (path, opts = {}) => {
      if (path.endsWith('/my/skills') && opts.method === 'POST') return { skills: [] };
      if (path.endsWith('/my/skills')) return { profile: { skills: [] }, gap: { gaps: [] } };
      if (path.endsWith('/skills')) return [{ uuid: 'skill-1', name: 'Communication' }];
      throw new Error(`No mock for ${path}`);
    });
    render(wrap(<MySkillsPage />));
    fireEvent.change(await screen.findByLabelText('Skill'), { target: { value: 'skill-1' } });
    fireEvent.change(screen.getByLabelText('Level'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save skill' }));
    await waitFor(() => expect(calls(api, '/my/skills')[0][1].body).toEqual({ skill_uuid: 'skill-1', level: 4 }));
  });
});
