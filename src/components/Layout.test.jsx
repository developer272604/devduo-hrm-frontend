import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Layout, { NAV_GROUPS, activeItemFor, groupOf } from './Layout';

const auth = vi.hoisted(() => ({ allowed: null }));
vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    session: { tenant: { name: 'Acme', settings: {} }, user: { name: 'Asha Rao', email: 'a@x.test' }, roles: [{ name: 'Workspace administrator' }] },
    can: (p) => !p || auth.allowed === null || p.split('|').some((k) => auth.allowed.includes(k)),
    enabled: () => true,
    logout: vi.fn(),
  }),
}));
vi.mock('../lib/theme', () => ({ ThemeToggle: () => null }));

const ui = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="*" element={<p>page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
const sidebar = () => screen.getAllByRole('complementary')[0];

afterEach(cleanup);
beforeEach(() => {
  auth.allowed = null;
  window.localStorage.clear();
});

it('places items by module and keeps unknown modules visible in the last section', () => {
  expect(groupOf({ module: undefined })).toBeNull();
  expect(groupOf({ module: 'work' })).toBeNull();
  expect(groupOf({ module: 'payroll' })).toBe('time');
  expect(groupOf({ module: 'travel' })).toBe('operations');
  expect(groupOf({ module: 'brand-new-module' })).toBe(NAV_GROUPS[NAV_GROUPS.length - 1].id);
});

it('chooses the most specific nav item for a path', () => {
  const items = [{ to: '/leave' }, { to: '/leave/hr' }, { to: '/' }];
  expect(activeItemFor(items, '/leave/hr/settings').to).toBe('/leave/hr');
  expect(activeItemFor(items, '/leave').to).toBe('/leave');
  expect(activeItemFor(items, '/').to).toBe('/');
  expect(activeItemFor(items, '/unknown')).toBeUndefined();
});

it('shows section headers, opens only the section holding the current page, and hides the rest', () => {
  ui('/leave');
  const bar = within(sidebar());
  for (const name of ['PEOPLE', 'TIME & PAY', 'OPERATIONS', 'AUTOMATION & INSIGHT', 'PLATFORM']) {
    expect(bar.getByRole('button', { name })).toBeInTheDocument();
  }
  expect(bar.getByRole('button', { name: 'TIME & PAY' })).toHaveAttribute('aria-expanded', 'true');
  expect(bar.getByRole('link', { name: 'My leave' })).toBeInTheDocument();
  expect(bar.getByRole('button', { name: 'PEOPLE' })).toHaveAttribute('aria-expanded', 'false');
  expect(bar.queryByRole('link', { name: 'Employees' })).not.toBeInTheDocument();
  // Always-visible shortcuts stay outside the sections.
  expect(bar.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
  expect(bar.getByRole('link', { name: 'My Work' })).toBeInTheDocument();
});

it('expands and collapses a section and remembers the choice', () => {
  const first = ui('/leave');
  fireEvent.click(within(sidebar()).getByRole('button', { name: 'PEOPLE' }));
  expect(within(sidebar()).getByRole('link', { name: 'Employees' })).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem('devduo.nav.groups')).people).toBe(true);
  first.unmount();
  ui('/leave');
  expect(within(sidebar()).getByRole('link', { name: 'Employees' })).toBeInTheDocument(); // remembered across visits
  fireEvent.click(within(sidebar()).getByRole('button', { name: 'PEOPLE' }));
  expect(within(sidebar()).queryByRole('link', { name: 'Employees' })).not.toBeInTheDocument();
});

it('hides a section the user has no access to', () => {
  auth.allowed = ['work.view', 'attendance.view', 'leave.view'];
  ui('/leave');
  const bar = within(sidebar());
  expect(bar.getByRole('button', { name: 'TIME & PAY' })).toBeInTheDocument();
  expect(bar.queryByRole('button', { name: 'PLATFORM' })).not.toBeInTheDocument();
  expect(bar.queryByRole('button', { name: 'OPERATIONS' })).not.toBeInTheDocument();
});

it('works when browser storage is blocked', () => {
  const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  ui('/leave');
  fireEvent.click(within(sidebar()).getByRole('button', { name: 'PEOPLE' }));
  expect(within(sidebar()).getByRole('link', { name: 'Employees' })).toBeInTheDocument();
  spy.mockRestore();
  set.mockRestore();
});

it('highlights only the most specific item when one path is a prefix of another', () => {
  ui('/leave/hr');
  const bar = within(sidebar());
  expect(bar.getByRole('link', { name: 'Leave operations' })).toHaveClass('active');
  expect(bar.getByRole('link', { name: 'My leave' })).not.toHaveClass('active');
});
