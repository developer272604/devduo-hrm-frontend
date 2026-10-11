import { useCallback, useEffect, useState } from 'react';
import Access from '../Access';
import { PageHeader } from '../ui';
import { api } from '../../lib/api';
import { fetchAll } from '../../lib/recruitmentApi';

export { Amount, ConfirmDialog, ConfirmPreview, CountMap, FormModal, ListCard, Section, StatusBadge, Tiles, optionsOf, useDo, withEmpty, KeyValues } from '../payroll/kit';
export { Banner } from '../timeoffice/parts';

/** Page chrome plus permission gate. `action` is wrapped so the header's small-screen button rules do not hide its label. */
export function Page({ permission, title, description, action, children }) {
  return (
    <Access permission={permission} module="recruitment">
      <PageHeader title={title} description={description} action={action && <div className="flex flex-wrap gap-2">{action}</div>} />
      {children}
    </Access>
  );
}

/** Loads all pages of a list endpoint. Returns {rows, loading, error, reload}. */
export function useAll(path) {
  const [state, setState] = useState({ rows: [], loading: true, error: null });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchAll(api, path)
      .then((rows) => live && setState({ rows, loading: false, error: null }))
      .catch((error) => live && setState({ rows: [], loading: false, error }));
    return () => {
      live = false;
    };
  }, [path, version]);
  return { ...state, reload: useCallback(() => setVersion((v) => v + 1), []) };
}

/** Organization / recruiter lookups as select options. Failure degrades to an empty list. */
export function useOptions(path, label = (r) => r.name, value = (r) => String(r.id)) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let live = true;
    api(path)
      .then((r) => live && setRows(Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : []))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [path]);
  return rows.map((r) => ({ value: value(r), label: label(r) }));
}
export const useOrg = (type, label) => useOptions(`/organization/${type}?per_page=100`, label);
