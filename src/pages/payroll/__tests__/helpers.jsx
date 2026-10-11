/** Route-table api mock (first matching substring wins, so list specific paths before generic ones). Unmatched calls reject. */
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
export const apiError = (message, status) => Object.assign(new Error(message), { status });
export const calls = (api, part, method = 'POST') => api.mock.calls.filter(([p, o]) => p.includes(part) && (o?.method ?? 'GET') === method);
