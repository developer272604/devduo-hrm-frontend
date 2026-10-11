import { useEffect, useState } from 'react';
import { Input, PageHeader, Select } from '../../components/ui';
import Access from '../../components/Access';
import { api } from '../../lib/api';
import { listOf, paths } from '../../lib/performanceApi';

/** Page chrome plus permission gate (403 state when the role may not open it). */
export function Page({ permission, title, description, action, children }) {
  return (
    <Access permission={permission} module="performance">
      <PageHeader title={title} description={description} action={action} />
      {children}
    </Access>
  );
}

/** Searchable colleague picker backed by the coworker directory (basic fields only). */
export function PersonPicker({ label = 'Person', value, onChange, hint }) {
  const [options, setOptions] = useState([]);
  const [term, setTerm] = useState('');
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      api(`${paths.directory}?${new URLSearchParams({ per_page: '25', ...(term ? { q: term } : {}) })}`)
        .then((r) => live && setOptions(listOf(r).map((x) => ({ value: x.uuid, label: `${x.display_name ?? x.name}${x.employee_number ? ` (${x.employee_number})` : ''}` }))))
        .catch(() => live && setOptions([]));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [term]);
  const shown = value && !options.some((o) => o.value === value) ? [{ value, label: 'Selected person' }, ...options] : options;
  return (
    <>
      <Input label={`Search ${label.toLowerCase()}`} type="search" hint={hint} value={term} onChange={(e) => setTerm(e.target.value)} />
      <Select label={label} required value={value ?? ''} options={[{ value: '', label: 'Choose...' }, ...shown]} onChange={(e) => onChange(e.target.value)} />
    </>
  );
}

export const initialsName = (p) => p?.name ?? p?.display_name ?? 'Employee';
