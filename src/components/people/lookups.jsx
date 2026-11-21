import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { api, query } from '../../lib/api';
import { useDebounced } from '../../lib/hooks';
import { Input, Select } from '../ui';

/** Loads `[{value,label}]` options from a list endpoint. Failures (e.g. no permission) yield no options. */
export function useOptions(path, opts) {
  return useOptionsState(path, opts).options;
}

/** Same as useOptions but also reports whether the first load has finished. */
export function useOptionsState(path, { map } = {}) {
  const [options, setOptions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!path) return undefined;
    const controller = new AbortController();
    api(path, { signal: controller.signal })
      .then((data) => {
        const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        setOptions(
          rows
            .map(
              map ||
                ((r) => ({ value: String(r.id ?? r.code ?? r.uuid), label: r.name ?? r.label })),
            )
            .filter((o) => o.value && o.label),
        );
        setLoaded(true);
      })
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  return { options, loaded };
}

const orgPath = (type) => `/organization/${type}?per_page=100`;
export const useOrgOptions = (type, enabled = true) => useOptions(enabled ? orgPath(type) : null);

/** Organization single-select (department, location, employee-types, designations, legal-entities). */
export function OrgSelect({ type, label, value, onChange, any = 'Any', required, error, name }) {
  const { options, loaded } = useOptionsState(orgPath(type));
  const { can } = useAuth();
  const empty = loaded && options.length === 0;
  return (
    <div>
      <Select
        label={label}
        name={name}
        required={required}
        error={error}
        value={value ?? ''}
        onChange={onChange}
        options={[{ value: '', label: any }, ...options]}
      />
      {empty && required && (
        <p className="-mt-2 mb-3 text-xs text-slate-600">
          No {label.toLowerCase()} options exist yet.{' '}
          {can('organization.view') ? (
            <Link className="font-medium underline" to={`/organization/${type}`} target="_blank" rel="noreferrer">
              Add one in Settings
            </Link>
          ) : (
            'Ask an administrator to add one.'
          )}{' '}
          Reopen this list afterwards; what you typed here is kept.
        </p>
      )}
    </div>
  );
}

/** Type-ahead employee picker: search box plus a result list; emits the chosen employee uuid. */
export function EmployeePicker({ label, value, onChange, valueLabel, required = false, error }) {
  const [text, setText] = useState('');
  const q = useDebounced(text, 300);
  const options = useOptions(q.length >= 2 ? `/v1/employees?${query({ q, per_page: 10 })}` : null, {
    map: (r) => ({
      value: r.uuid,
      label: `${r.display_name || r.name}${r.employee_number ? ` (${r.employee_number})` : ''}`,
    }),
  });
  const list = [
    { value: '', label: value ? 'Clear selection' : 'Any' },
    ...(value && !options.some((o) => o.value === value)
      ? [{ value, label: valueLabel || 'Selected person' }]
      : []),
    ...options,
  ];
  return (
    <div>
      <Input
        label={`Find ${label.toLowerCase()}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type 2+ letters"
        autoComplete="off"
      />
      <Select
        label={label}
        required={required}
        error={error}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        options={list}
      />
    </div>
  );
}
