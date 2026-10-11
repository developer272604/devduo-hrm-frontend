import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

/**
 * Polls `path` until `isDone(data)` is true (or the component unmounts / path becomes null).
 * The first request is immediate; later ones wait `interval` ms.
 */
export function usePoll(path, isDone, interval = 2000) {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    if (!path) return undefined;
    let cancelled = false,
      timer;
    const controller = new AbortController();
    const tick = async () => {
      try {
        const data = await api(path, { signal: controller.signal });
        if (cancelled) return;
        setState({ data, error: null });
        if (!isDone(data)) timer = setTimeout(tick, interval);
      } catch (error) {
        if (cancelled || error.name === 'AbortError') return;
        setState((s) => ({ ...s, error }));
        // Transient failures keep polling; auth/permission failures stop.
        if (![401, 403, 404, 419].includes(error.status)) timer = setTimeout(tick, interval * 2);
      }
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
    // isDone is a stable module-level predicate at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, interval]);
  return state;
}

export const IMPORT_FINAL = ['completed', 'partial', 'failed', 'rolled_back'];
export const EXPORT_FINAL = ['completed', 'failed', 'expired'];
export const BULK_FINAL = ['completed', 'partial', 'failed'];
export const importDone = (d) => IMPORT_FINAL.includes(d?.status);
export const exportDone = (d) => EXPORT_FINAL.includes(d?.status);
export const bulkDone = (d) => BULK_FINAL.includes(d?.status);
