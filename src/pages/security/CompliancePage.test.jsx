import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CompliancePage, { dueText } from './CompliancePage';
import { api } from '../../lib/api';

const access = vi.hoisted(() => ({ perms: [] }));
vi.mock('../../lib/auth', () => ({ useAuth: () => ({ can: (p) => !p || p.split('|').some((k) => access.perms.includes(k)) }) }));
vi.mock('../../lib/api', () => ({ api: vi.fn(), query: (o) => new URLSearchParams(o).toString() }));

const control = { uuid: 'c1', code: 'PF-RETURN', name: 'Monthly provident fund return', category: 'statutory', frequency: 'monthly', owner: { id: 1, name: 'Asha' }, next_due_on: '2026-10-01', days_until_due: -6, status: 'overdue', active: true, awaiting_review: 0, last_accepted_on: null };
const controls = { items: [control], summary: { overdue: 1, due_soon: 0, awaiting_review: 0, current: 0 }, note: 'This register starts empty. Dates should come from your own compliance advisor.' };
const queue = { items: [{ uuid: 'e1', title: 'September return', reference: 'drive://pf/09.pdf', collected_on: '2026-10-06', submitted_by: 'Ravi', can_review: true, control: { name: 'Monthly provident fund return' } }, { uuid: 'e2', title: 'Mine', reference: 'x', collected_on: '2026-10-06', submitted_by: 'Me', can_review: false, control: { name: 'Other' } }] };
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  access.perms = ['security.compliance.view', 'security.compliance.manage', 'security.compliance.review'];
  api.mockImplementation((path) => Promise.resolve(path.includes('/review-queue') ? queue : path.includes('/controls/c1') ? { ...control, evidence: [] } : path.includes('/controls') ? controls : { users: [] }));
});

it('words due dates', () => {
  expect(dueText({ next_due_on: '2026-10-01', days_until_due: -6 })).toBe('6 day(s) overdue (due 2026-10-01)');
  expect(dueText({ next_due_on: '2026-10-07', days_until_due: 0 })).toBe('due today (2026-10-07)');
  expect(dueText({ next_due_on: null, status: 'complete' })).toBe('completed');
});

it('lists controls with status, due wording and the advisor note', async () => {
  render(<CompliancePage />);
  expect(await screen.findByText('Monthly provident fund return')).toBeInTheDocument();
  expect(screen.getByText(/6 day\(s\) overdue \(due 2026-10-01\)/)).toBeInTheDocument();
  expect(screen.getAllByText(/compliance advisor/).length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: 'Submit evidence' })).toBeInTheDocument();
});

it('explains that a second person must accept submitted evidence', async () => {
  render(<CompliancePage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Submit evidence' }));
  expect(await screen.findByText(/Someone other than you must accept this/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'September return' } });
  fireEvent.change(screen.getByLabelText(/Where is the proof/), { target: { value: 'drive://pf/09.pdf' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('/controls/c1/evidence'), expect.objectContaining({ method: 'POST' })));
});

it('blocks reviewing your own evidence and requires a note to send evidence back', async () => {
  render(<CompliancePage />);
  fireEvent.click(await screen.findByRole('tab', { name: 'Review queue' }));
  expect(await screen.findByText(/You submitted this, so someone else must review it/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Send back' }));
  expect(screen.getByRole('button', { name: 'Send back with note' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('What is missing?'), { target: { value: 'Acknowledgement page missing' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send back with note' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('/evidence/e1/review'), expect.objectContaining({ body: { accept: false, note: 'Acknowledgement page missing' } })));
});

it('shows the review and pack tabs only to reviewers', async () => {
  access.perms = ['security.compliance.view'];
  render(<CompliancePage />);
  await screen.findByText('Monthly provident fund return');
  expect(screen.queryByRole('tab', { name: 'Review queue' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: 'Auditor pack' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'New control' })).not.toBeInTheDocument();
});
