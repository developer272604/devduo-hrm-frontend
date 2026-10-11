import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  ErrorState,
  FormError,
  Input,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '../../../components/ui';
import ResponsiveList from '../../../components/ResponsiveList';
import { Banner, Screen, StatusBadge, guarded } from '../../../components/timeoffice/parts';
import { useOptions } from '../../../components/people/lookups';
import { useDebounced, useResource } from '../../../lib/hooks';
import { listOf, paths, query, send, today, useAction, unwrap } from '../../../lib/leaveHrApi';

const blankParams = {
  trigger: 'transfer',
  effective_date: today(),
  balance_mode: '',
};
function BulkActionsPageInner() {
  const catalog = useResource(paths.bulkActions);
  const toast = useToast();
  const previewAction = useAction();
  const runAction = useAction();
  const [key, setKey] = useState('');
  const [params, setParams] = useState(blankParams);
  const [search, setSearch] = useState('');
  const [employee, setEmployee] = useState('');
  const [selected, setSelected] = useState([]);
  const [preview, setPreview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [completed, setCompleted] = useState(false);
  const delayedSearch = useDebounced(search, 300);
  const employees = useOptions(
    delayedSearch.trim().length >= 2
      ? `/v1/employees?${query({ q: delayedSearch.trim(), per_page: 10 })}`
      : null,
    {
      map: (row) => ({
        value: row.uuid,
        label: `${row.display_name || row.name}${row.employee_number ? ` (${row.employee_number})` : ''}`,
      }),
    },
  );
  const actions = catalog.data ? listOf(catalog.data) : [];
  const action = actions.find((item) => item.key === key);
  const results = preview?.results ?? [];
  let paramsError = null;
  if (key && key !== 'prepare_handling') {
    try {
      const parsed = JSON.parse(params.json || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        paramsError = 'Parameters must be a JSON object.';
    } catch {
      paramsError = 'Enter valid JSON parameters.';
    }
  }
  const runnable = useMemo(
    () => results.some((row) => ['ok', 'warning'].includes(row.status)),
    [results],
  );

  useEffect(() => {
    setPreview(null);
    setConfirmed(false);
    setCompleted(false);
  }, [key, params, selected]);

  function addEmployee() {
    const option = employees.find((row) => row.value === employee);
    if (!option || selected.some((row) => row.uuid === employee)) return;
    setSelected((rows) => [...rows, { uuid: employee, label: option.label }]);
    setEmployee('');
  }

  async function requestPreview() {
    setPreview(null);
    setConfirmed(false);
    const result = await previewAction.run(() =>
      send('POST', paths.bulkActionPreview(key), {
        employees: selected.map((row) => row.uuid),
        params: paramsFor(key),
      }),
    );
    if (result) {
      setPreview(unwrap(result));
      setCompleted(false);
    }
  }

  async function run() {
    const result = await runAction.run(() =>
      send('POST', paths.bulkActionRun(key), {
        employees: selected.map((row) => row.uuid),
        params: paramsFor(key),
      }),
    );
    if (result) {
      setPreview(unwrap(result));
      setConfirmed(false);
      setCompleted(true);
      toast('Bulk action finished. Review each employee result below.');
    }
  }

  return (
    <Screen
      title="Leave bulk actions"
      description="Run registered leave operations for employees in your data scope. Every action is previewed before it runs."
      permission="leave.manage"
    >
      {catalog.loading ? (
        <Skeleton />
      ) : catalog.error ? (
        <ErrorState error={catalog.error} onRetry={catalog.reload} />
      ) : (
        <>
          <Card title="Choose an action" className="mb-5">
            <div className="grid gap-4 px-6 pb-5 sm:grid-cols-2">
              <Select
                label="Registered action"
                value={key}
                options={[
                  { value: '', label: 'Choose an action…' },
                  ...actions.map((item) => ({ value: item.key, label: item.label })),
                ]}
                onChange={(event) => {
                  setKey(event.target.value);
                  setParams(blankParams);
                }}
              />
              {action && (
                <p className="m-0 self-center text-xs text-slate-600 dark:text-slate-300">
                  {action.description} Maximum {action.max_employees ?? 500} employees.
                </p>
              )}
            </div>
          </Card>
          {action && (
            <Card title="Select employees and parameters" className="mb-5">
              <div className="grid gap-4 px-6 pb-5 sm:grid-cols-2 lg:grid-cols-3">
                <Input
                  label="Find employee"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Type 2 or more characters"
                  autoComplete="off"
                />
                <Select
                  label="Search results"
                  value={employee}
                  options={[
                    {
                      value: '',
                      label:
                        delayedSearch.trim().length < 2 ? 'Type to search' : 'Choose an employee…',
                    },
                    ...employees,
                  ]}
                  onChange={(event) => setEmployee(event.target.value)}
                />
                <div className="self-end">
                  <Button
                    variant="secondary"
                    disabled={!employee || selected.length >= (action.max_employees ?? 500)}
                    onClick={addEmployee}
                  >
                    Add employee
                  </Button>
                </div>
                {key === 'prepare_handling' ? (
                  <>
                    <Select
                      label="Handling event"
                      value={params.trigger}
                      options={[
                        { value: 'transfer', label: 'Transfer' },
                        { value: 'separation', label: 'Separation' },
                        { value: 'policy_change', label: 'Policy change' },
                      ]}
                      onChange={(event) =>
                        setParams((value) => ({ ...value, trigger: event.target.value }))
                      }
                    />
                    <Input
                      label="Effective date"
                      type="date"
                      required
                      value={params.effective_date}
                      onChange={(event) =>
                        setParams((value) => ({ ...value, effective_date: event.target.value }))
                      }
                    />
                    <Select
                      label="Balance handling"
                      value={params.balance_mode}
                      options={[
                        { value: '', label: 'Follow policy' },
                        { value: 'preserve', label: 'Preserve' },
                        { value: 'transfer', label: 'Transfer' },
                        { value: 'convert', label: 'Convert' },
                        { value: 'expire', label: 'Expire' },
                      ]}
                      onChange={(event) =>
                        setParams((value) => ({ ...value, balance_mode: event.target.value }))
                      }
                    />
                  </>
                ) : (
                  <Textarea
                    label="Action parameters (JSON)"
                    value={params.json ?? '{}'}
                    onChange={(event) =>
                      setParams((value) => ({ ...value, json: event.target.value }))
                    }
                  />
                )}
                {paramsError && (
                  <p role="alert" className="m-0 text-xs text-rose-700 dark:text-rose-300">
                    {paramsError}
                  </p>
                )}
              </div>
              {selected.length > 0 && (
                <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-700">
                  <p className="mt-0 text-xs font-semibold">
                    Selected employees ({selected.length})
                  </p>
                  <ul
                    className="m-0 flex flex-wrap gap-2 p-0 text-xs"
                    aria-label="Selected employees"
                  >
                    {selected.map((row) => (
                      <li
                        key={row.uuid}
                        className="list-none rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800"
                      >
                        {row.label}
                        <button
                          type="button"
                          className="ml-2 font-bold"
                          aria-label={`Remove ${row.label}`}
                          onClick={() =>
                            setSelected((items) => items.filter((item) => item.uuid !== row.uuid))
                          }
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
                <span className="text-xs text-slate-500">
                  {selected.length} selected · maximum {action.max_employees ?? 500}
                </span>
                <Button
                  variant="secondary"
                  loading={previewAction.busy}
                  disabled={
                    !selected.length ||
                    selected.length > (action.max_employees ?? 500) ||
                    Boolean(paramsError)
                  }
                  onClick={requestPreview}
                >
                  Preview action
                </Button>
              </div>
              {previewAction.error && (
                <div className="px-6 pb-4">
                  <FormError error={previewAction.error} />
                </div>
              )}
            </Card>
          )}
          {preview && (
            <Card title={completed ? 'Run results' : 'Preview results'} className="mb-5">
              <div className="px-6 pb-3">
                <Banner tone={completed ? 'success' : 'info'}>
                  {preview.count} employee result(s).{' '}
                  {completed
                    ? 'The bulk action finished.'
                    : 'Preview does not make changes. Running the action creates the leave handling plans for eligible employees.'}
                </Banner>
              </div>
              <ResponsiveList
                label="Bulk action results"
                rows={results}
                rowKey={(row) => row.employee_uuid}
                columns={[
                  {
                    key: 'name',
                    label: 'Employee',
                    render: (row) => (
                      <span>
                        {row.name} <small className="text-slate-500">{row.employee_number}</small>
                      </span>
                    ),
                  },
                  {
                    key: 'status',
                    label: 'Result',
                    render: (row) => <StatusBadge status={row.status} />,
                  },
                  {
                    key: 'reason',
                    label: 'Details',
                    render: (row) => row.reason ?? (row.detail ? JSON.stringify(row.detail) : '—'),
                  },
                ]}
                mobile={{
                  title: 'name',
                  subtitle: (row) => row.reason ?? row.employee_number,
                  badge: (row) => <StatusBadge status={row.status} />,
                }}
              />
              {!completed && (
                <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-700">
                  <div className="mb-4">
                    <Checkbox
                      label="I reviewed the preview and want to create plans for eligible employees."
                      checked={confirmed}
                      disabled={!runnable}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                  </div>
                  <FormError error={runAction.error} />
                  <Button loading={runAction.busy} disabled={!confirmed || !runnable} onClick={run}>
                    Run bulk action
                  </Button>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </Screen>
  );

  function paramsFor(actionKey) {
    if (actionKey === 'prepare_handling')
      return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== ''));
    try {
      const parsed = JSON.parse(params.json || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('Parameters must be a JSON object.');
      return parsed;
    } catch (error) {
      throw new Error(error.message || 'Enter valid JSON parameters.');
    }
  }
}

export default guarded(BulkActionsPageInner, {
  title: 'Leave bulk actions',
  permission: 'leave.manage',
});
