import { useState } from 'react';
import { Badge, Button, FormError, Input, Select, useToast } from '../ui';
import { useOptions, OrgSelect, EmployeePicker } from './lookups';
import { bulkApply, bulkPreview } from '../../lib/peopleApi';
import { useResource } from '../../lib/hooks';

const ORG_PARAM = {
  assign_department: ['department_id', 'departments', 'Department'],
  assign_location: ['location_id', 'locations', 'Location'],
  assign_employee_type: ['employee_type_id', 'employee-types', 'Employee type'],
};

/**
 * Bulk action flow: choose action -> preview (nothing changes) -> explicit confirm with the single-use token.
 * Any change to the action, parameters or selection invalidates the preview.
 */
export default function BulkPanel({ uuids, onDone, onClear }) {
  const toast = useToast();
  const actions = useResource('/v1/people/bulk/actions');
  const tags = useOptions('/v1/people/tags?per_page=100');
  const [action, setAction] = useState(''),
    [params, setParams] = useState({}),
    [preview, setPreview] = useState(null),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const list = Array.isArray(actions.data) ? actions.data : actions.data?.data || [];
  const reset = () => setPreview(null);
  const setParam = (key, value) => {
    setParams((p) => ({ ...p, [key]: value }));
    reset();
  };
  const org = ORG_PARAM[action];

  async function run(kind) {
    setBusy(true);
    setError(null);
    try {
      if (kind === 'preview') {
        setPreview(await bulkPreview({ action, params, employee_uuids: uuids }));
      } else {
        const result = await bulkApply(preview.confirmation_token);
        toast(
          result.status === 'queued' || result.status === 'processing'
            ? 'Bulk action queued. Results will appear shortly.'
            : `Bulk action applied to ${result.applied ?? preview.counts?.ok ?? 0} employees.`,
        );
        reset();
        onDone();
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (actions.error)
    return (
      <p className="px-5 py-3 text-xs text-rose-700 dark:text-rose-300" role="alert">
        Bulk actions are unavailable: {actions.error.message}
      </p>
    );
  const rows = preview?.rows || [];
  return (
    <section
      aria-label="Bulk actions"
      className="space-y-4 border-b border-slate-200 bg-brand-50/40 p-5 dark:border-slate-700 dark:bg-brand-950/30"
    >
      <div className="flex flex-wrap items-end gap-4">
        <strong className="pb-3 text-sm">{uuids.length} selected</strong>
        <Select
          label="Bulk action"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setParams({});
            reset();
          }}
          options={[
            { value: '', label: 'Choose an action…' },
            ...list.map((a) => ({ value: a.key, label: a.label })),
          ]}
        />
        {org && (
          <OrgSelect
            type={org[1]}
            label={org[2]}
            value={params[org[0]]}
            any="Choose…"
            onChange={(e) => setParam(org[0], Number(e.target.value) || '')}
          />
        )}
        {['add_tag', 'remove_tag'].includes(action) && (
          <Select
            label="Tag"
            value={String(params.tag_id || '')}
            onChange={(e) => setParam('tag_id', Number(e.target.value) || '')}
            options={[{ value: '', label: 'Choose…' }, ...tags]}
          />
        )}
        {action === 'assign_manager' && (
          <EmployeePicker label="New manager" value={params.manager_uuid} onChange={(v) => setParam('manager_uuid', v)} />
        )}
        {(action.startsWith('assign_') || action === 'deactivate' || action === 'activate') && (
          <Input
            label="Effective date"
            type="date"
            value={params[action.startsWith('assign_') ? 'effective_from' : 'effective_date'] || ''}
            onChange={(e) => setParam(action.startsWith('assign_') ? 'effective_from' : 'effective_date', e.target.value)}
          />
        )}
        {action && action !== 'export' && !['add_tag', 'remove_tag'].includes(action) && (
          <Input label="Reason" value={params.reason || ''} onChange={(e) => setParam('reason', e.target.value)} />
        )}
        <div className="mb-5 flex gap-2">
          <Button variant="secondary" disabled={!action || busy} loading={busy && !preview} onClick={() => run('preview')}>
            Preview changes
          </Button>
          <Button variant="secondary" onClick={onClear}>
            Clear selection
          </Button>
        </div>
      </div>
      <FormError error={error} />
      {preview && (
        <div className="space-y-3" role="region" aria-label="Bulk action preview">
          <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
            <strong>{preview.affected_count ?? rows.length} employees affected.</strong>
            <Badge tone="green">{preview.counts?.ok ?? 0} will change</Badge>
            <Badge tone="neutral">{preview.counts?.skipped ?? 0} skipped</Badge>
            <Badge tone="amber">{preview.counts?.error ?? 0} errors</Badge>
            {preview.will_queue && <span className="text-xs">Large run: it will be processed in the background.</span>}
          </p>
          <ul className="m-0 max-h-48 list-none space-y-1 overflow-y-auto p-0 text-xs">
            {rows.slice(0, 50).map((r) => (
              <li key={r.uuid} className="flex justify-between gap-3">
                <span>
                  {r.name} {r.employee_number && `(${r.employee_number})`}
                </span>
                <span className={r.status === 'error' ? 'text-rose-700 dark:text-rose-300' : ''}>
                  {r.reason || r.status}
                </span>
              </li>
            ))}
          </ul>
          {preview.rows_truncated && <p className="m-0 text-xs">Only the first rows are listed.</p>}
          <Button disabled={(preview.counts?.ok ?? 1) === 0 || busy} loading={busy} onClick={() => run('apply')}>
            Confirm and apply
          </Button>
        </div>
      )}
    </section>
  );
}
