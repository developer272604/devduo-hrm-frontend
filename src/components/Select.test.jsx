import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Select } from './Select';
import { Modal } from './ui';
afterEach(cleanup);
it('dismisses the options before its parent dialog on Escape', () => {
  const close = vi.fn();
  render(
    <Modal open title="Edit task" onClose={close}>
      <Select label="Priority" options={['low', 'high']} value="low" onChange={() => {}} />
    </Modal>,
  );
  const control = screen.getByRole('combobox');
  fireEvent.click(control);
  fireEvent.keyDown(control, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(close).not.toHaveBeenCalled();
  fireEvent.keyDown(control, { key: 'Escape' });
  expect(close).toHaveBeenCalledOnce();
});
it('supports keyboard selection and closes without submitting the form', () => {
  const change = vi.fn();
  render(
    <Select
      label="Priority"
      options={['low', 'normal', 'high']}
      value="normal"
      onChange={change}
    />,
  );
  const control = screen.getByRole('combobox');
  fireEvent.keyDown(control, { key: 'ArrowDown' });
  fireEvent.keyDown(control, { key: 'ArrowDown' });
  fireEvent.keyDown(control, { key: 'Enter' });
  expect(change).toHaveBeenCalledWith({ target: { value: 'high', name: undefined } });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
it('skips disabled options and supports Escape', () => {
  render(
    <Select
      label="Role"
      value="a"
      options={[
        { value: 'a', label: 'Member' },
        { value: 'b', label: 'Disabled', disabled: true },
        { value: 'c', label: 'Manager' },
      ]}
      onChange={() => {}}
    />,
  );
  const control = screen.getByRole('combobox');
  fireEvent.click(control);
  fireEvent.keyDown(control, { key: 'ArrowDown' });
  expect(control.getAttribute('aria-activedescendant')).toMatch(/option-2$/);
  fireEvent.keyDown(control, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
