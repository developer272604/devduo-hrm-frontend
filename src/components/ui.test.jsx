import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Modal, MultiSelect, Tabs, DataTable } from './ui';
import { localAction } from '../lib/api';
afterEach(cleanup);
describe('Accessible foundations', () => {
  it('labels dialogs, closes with escape, and restores focus', () => {
    const close = vi.fn();
    const { rerender } = render(
      <>
        <button>Open</button>
        <Modal open={false} onClose={close} title="Edit record" />
      </>,
    );
    const trigger = screen.getByText('Open');
    trigger.focus();
    rerender(
      <>
        <button>Open</button>
        <Modal open onClose={close} title="Edit record">
          <button>Save</button>
        </Modal>
      </>,
    );
    expect(screen.getByRole('dialog', { name: 'Edit record' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(close).toHaveBeenCalled();
    rerender(
      <>
        <button>Open</button>
        <Modal open={false} onClose={close} title="Edit record" />
      </>,
    );
    expect(trigger).toHaveFocus();
  });
  it('traps keyboard focus inside modal', () => {
    render(
      <Modal open onClose={() => {}} title="Confirm">
        <button>Last</button>
      </Modal>,
    );
    const last = screen.getByText('Last');
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(screen.getByLabelText('Close dialog')).toHaveFocus();
  });
  it('updates a multi select without dropping other selections', () => {
    const change = vi.fn();
    render(
      <MultiSelect
        label="Roles"
        value={[1]}
        options={[
          { value: 1, label: 'Member' },
          { value: 2, label: 'HR' },
        ]}
        onChange={change}
      />,
    );
    fireEvent.click(screen.getByLabelText('HR'));
    expect(change).toHaveBeenCalledWith([1, 2]);
  });
  it('supports arrow-key tab navigation', () => {
    const change = vi.fn();
    render(
      <Tabs
        items={[
          { value: 'open', label: 'Open' },
          { value: 'done', label: 'Done' },
        ]}
        value="open"
        onChange={change}
      />,
    );
    fireEvent.keyDown(screen.getByText('Open'), { key: 'ArrowRight' });
    expect(change).toHaveBeenCalledWith('done');
    expect(screen.getByText('Done')).toHaveFocus();
  });
  it('renders an informative empty table state', () => {
    render(
      <DataTable
        columns={[]}
        rows={[]}
        empty={{ title: 'No people yet', description: 'Add a team member.' }}
      />,
    );
    expect(screen.getByText('No people yet')).toBeInTheDocument();
  });
  it('only accepts local action links', () => {
    expect(localAction('/my-work')).toBe('/my-work');
    for (const action of [
      '//evil.test',
      'https://evil.test',
      'javascript:alert(1)',
      '/\\evil.test',
    ])
      expect(localAction(action)).toBeNull();
  });
});
