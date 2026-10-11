let csrfToken;
export class ApiError extends Error {
  constructor(message, status, errors = {}, data = null) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.data = data;
    this.code = data?.code;
  }
}
export async function api(path, { method = 'GET', body, signal, headers: extraHeaders, ...rest } = {}) {
  const base = import.meta.env.VITE_API_BASE || '/api';
  if (method !== 'GET' && !csrfToken) {
    const response = await fetch(`${base}/csrf`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok)
      throw new ApiError('Could not start a secure session. Please try again.', response.status);
    csrfToken = (await response.json()).csrf_token;
  }
  const response = await fetch(`${base}${path}`, {
    method,
    signal,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      // Multipart bodies must let the browser set the boundary.
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
      ...extraHeaders,
    },
    ...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    ...rest,
  });
  const data =
    response.status === 204
      ? null
      : await response
          .json()
          .catch(() => ({ message: 'The server returned an unexpected response.' }));
  if (!response.ok) {
    if (response.status === 419) csrfToken = undefined;
    if ([401, 419].includes(response.status) && path !== '/me')
      window.dispatchEvent(new CustomEvent('session-expired'));
    throw new ApiError(
      data?.message || 'Something went wrong. Please try again.',
      response.status,
      data?.errors,
      data,
    );
  }
  // Laravel rotates the CSRF token when a session is regenerated.
  if (['/login', '/logout', '/change-password', '/reset-password'].includes(path))
    csrfToken = undefined;
  return data;
}
export function query(values) {
  const p = new URLSearchParams();
  Object.entries(values).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) p.set(k, v);
  });
  return p.toString();
}
export function localAction(action) {
  return typeof action === 'string' && /^\/(?!\/)/.test(action) && !action.includes('\\')
    ? action
    : null;
}

/** Downloads an authorized file (exports, documents) without exposing a permanent URL. */
export async function download(path, fallbackName = 'download') {
  const base = import.meta.env.VITE_API_BASE || '/api';
  const response = await fetch(`${base}${path}`, { credentials: 'include' });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if ([401, 419].includes(response.status)) window.dispatchEvent(new CustomEvent('session-expired'));
    throw new ApiError(data?.message || 'The file could not be downloaded.', response.status);
  }
  const disposition = response.headers.get('Content-Disposition') || '';
  const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1] || fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = decodeURIComponent(name);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
