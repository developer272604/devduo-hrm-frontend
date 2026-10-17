import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TalentPage, scorePct } from './TalentPages';
import { api } from '../../lib/api';

const access = vi.hoisted(() => ({ perms: [] }));
vi.mock('../../lib/auth', () => ({ useAuth: () => ({ can: (p) => p.split('|').some((k) => access.perms.includes(k)) }) }));
vi.mock('../../lib/api', () => ({ api: vi.fn(), query: (o) => new URLSearchParams(o).toString() }));

const browse = {
  profile: { discoverable: false, spare_hours_per_week: 0, committed_hours: 0, free_hours: 0, privacy: 'Others can find you only while discoverable is on.' },
  limitations: 'Match scores are a guide, not a decision.',
  items: [
    {
      uuid: 'o1',
      title: 'Data migration project',
      kind: 'project',
      status: 'open',
      hours_per_week: 10,
      starts_on: '2026-10-20',
      ends_on: null,
      openings: 1,
      placed: 0,
      posted_by: 'Meera Rao',
      description: 'Move reports to the new warehouse.',
      skills: [{ skill: 'Python', skill_uuid: 's1', required: 'Advanced', mandatory: true }],
      my_application: null,
      match: {
        score: 0.33,
        eligible: false,
        met: [],
        gaps: [{ skill: 'Python', skill_uuid: 's1', required: 'Advanced', has: 'Beginner', mandatory: true, courses: [{ title: 'Python for analysts', code: 'PY1' }] }],
      },
    },
  ],
};
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  access.perms = ['talent.self'];
  api.mockImplementation((path) => Promise.resolve(path.includes('/talent/opportunities') ? browse : { items: [] }));
});

it('formats the match score', () => {
  expect(scorePct({ score: 0.67 })).toBe('67%');
  expect(scorePct(null)).toBe('0%');
});

it('shows fit, gaps with helpful courses, and the privacy promise', async () => {
  render(<TalentPage />);
  expect(await screen.findByText('Data migration project')).toBeInTheDocument();
  expect(screen.getByText('skill gap')).toBeInTheDocument();
  expect(screen.getByText(/Match 33%/)).toBeInTheDocument();
  expect(screen.getByText(/Courses that can help: Python for analysts/)).toBeInTheDocument();
  expect(screen.getByText(/Others can find you only while discoverable is on/)).toBeInTheDocument();
  expect(screen.getByText(/not a decision/)).toBeInTheDocument();
});

it('saves availability with an explicit opt-in', async () => {
  render(<TalentPage />);
  fireEvent.click(await screen.findByLabelText(/Let colleagues who post opportunities find me/));
  fireEvent.change(screen.getByLabelText('Spare hours per week I can give'), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      expect.stringContaining('/talent/my/profile'),
      expect.objectContaining({ method: 'PUT', body: { discoverable: true, spare_hours_per_week: 8 } }),
    ),
  );
});

it('sends interest and explains that the manager must release the person', async () => {
  render(<TalentPage />);
  fireEvent.click(await screen.findByRole('button', { name: "I'm interested" }));
  expect(await screen.findByText(/your manager must release you/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Send interest' }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(expect.stringContaining('/opportunities/o1/apply'), expect.objectContaining({ method: 'POST' })),
  );
});

it('shows only the tabs the user may use', async () => {
  access.perms = ['talent.self'];
  const { unmount } = render(<TalentPage />);
  expect(await screen.findByRole('tab', { name: 'My responses' })).toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'Posted by me' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'Release requests' })).not.toBeInTheDocument();
  unmount();
  access.perms = ['talent.self', 'talent.post', 'talent.approve'];
  render(<TalentPage />);
  expect(await screen.findByRole('tab', { name: 'Posted by me' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Release requests' })).toBeInTheDocument();
});

it('shows career paths with gaps, courses and opportunities, and the not-a-promise notice', async () => {
  const career = {
    current_designation: 'Engineer',
    limitations: 'It is not a promise of a move or promotion.',
    roles: [
      {
        designation: 'Senior Engineer',
        readiness: 0.33,
        ready_now: false,
        skills_met: ['Python'],
        gaps: [{ skill: 'SQL', required: 'Intermediate', current: 'none', mandatory: true, courses: [{ title: 'SQL basics' }], opportunities: [{ title: 'Reporting revamp' }] }],
      },
    ],
  };
  api.mockImplementation((path) => Promise.resolve(path.includes('/my/career') ? career : path.includes('/talent/opportunities') ? browse : { items: [] }));
  render(<TalentPage />);
  fireEvent.click(await screen.findByRole('tab', { name: 'Career paths' }));
  expect(await screen.findByText('Senior Engineer')).toBeInTheDocument();
  expect(screen.getByText(/Fit 33%/)).toBeInTheDocument();
  expect(screen.getByText(/Courses: SQL basics/)).toBeInTheDocument();
  expect(screen.getByText(/Open opportunities to practise it: Reporting revamp/)).toBeInTheDocument();
  expect(screen.getByText(/not a promise/)).toBeInTheDocument();
});
