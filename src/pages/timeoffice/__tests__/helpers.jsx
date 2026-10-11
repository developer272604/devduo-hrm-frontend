import { fireEvent, screen } from '@testing-library/react';

/** Route-table style api mock: `routes` maps a path substring to a response (or function). Unmatched calls reject. */
export function mockApi(api, routes) {
  api.mockImplementation(async (path, opts = {}) => {
    const hit = Object.keys(routes).find((k) => path.includes(k));
    if (!hit) throw Object.assign(new Error(`No mock for ${path}`), { status: 404 });
    const r = routes[hit];
    const value = typeof r === 'function' ? await r(path, opts) : r;
    if (value instanceof Error) throw value;
    return value;
  });
}

/** Opens the themed Select by label and picks an option by its visible name. */
export function choose(label, optionName) {
  fireEvent.click(screen.getByRole('combobox', { name: new RegExp(label, 'i') }));
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}
