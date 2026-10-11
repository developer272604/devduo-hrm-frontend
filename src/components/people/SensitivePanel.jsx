import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import { isChangeRequired, label, revealIdentity, submitChangeRequest } from '../../lib/peopleApi';
import { Badge, Button, EmptyState, Input, Modal, Resource, Select, useToast } from '../ui';

const HIDE_AFTER_MS = 30000;
const IDENTITY = {
  kind: 'identity',
  title: 'Identity documents',
  noun: 'identity document',
  section: 'identity',
  heading: (r) => r.type_label || label(r.type),
  masked: (r) => r.number_masked,
  detail: (r) =>
    [r.country, r.expiry_date && `Expires ${r.expiry_date}`].filter(Boolean).join(' · '),
  revealed: (r) => r.number,
};
const BANK = {
  kind: 'bank-accounts',
  title: 'Bank accounts',
  noun: 'bank account',
  section: 'bank',
  heading: (r) => `${r.bank_name} (${r.account_holder})`,
  masked: (r) => r.account_masked || `••••${r.account_last4 || ''}`,
  detail: (r) => [r.currency, r.is_primary && 'Primary', r.status].filter(Boolean).join(' · '),
  revealed: (r) =>
    Object.entries(r.details || {})
      .map(([k, v]) => `${label(k)}: ${v}`)
      .join(', '),
};

function SensitiveEditor({ uuid, config, row, mode, onClose, onSaved }) {
  const { can } = useAuth();
  const toast = useToast();
  const countriesResource = useResource('/v1/people/countries');
  const [values, setValues] = useState(() => ({
    type: row?.type || '',
    country: row?.country || '',
    number: '',
    issue_date: row?.issue_date || '',
    expiry_date: row?.expiry_date || '',
    account_holder: row?.account_holder || '',
    bank_name: row?.bank_name || '',
    currency: row?.currency || '',
    is_primary: Boolean(row?.is_primary),
    effective_from: row?.effective_from || '',
    effective_to: row?.effective_to || '',
    details: {},
  }));
  const [pack, setPack] = useState(null),
    [revealed, setRevealed] = useState(!row || config.kind === 'identity');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const countries = countriesResource.data?.data || [];

  useEffect(() => {
    if (!values.country) return;
    let alive = true;
    api(`/v1/people/countries/${values.country}`)
      .then((result) => {
        if (alive) setPack(result);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [values.country]);

  async function loadExistingDetails() {
    setBusy(true);
    setError('');
    try {
      const result = await revealIdentity(uuid, row.uuid, config.kind);
      setValues((v) => ({ ...v, details: result.details || {} }));
      setRevealed(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const body =
      config.kind === 'identity'
        ? Object.fromEntries(
            Object.entries({
              type: values.type,
              country: values.country,
              number: values.number,
              issue_date: values.issue_date,
              expiry_date: values.expiry_date,
            }).filter(([, v]) => v !== ''),
          )
        : {
            account_holder: values.account_holder,
            bank_name: values.bank_name,
            country: values.country,
            currency: values.currency,
            is_primary: values.is_primary,
            effective_from: values.effective_from || null,
            effective_to: values.effective_to || null,
            details: values.details,
          };
    try {
      const operation = row ? 'update' : 'create';
      if (mode === 'request') {
        await submitChangeRequest(uuid, {
          section: config.section,
          operation,
          ...(row ? { target_id: row.uuid } : {}),
          requested_value: body,
        });
        toast('Change request submitted for approval.');
      } else {
        try {
          await api(`/v1/employees/${uuid}/${config.kind}${row ? `/${row.uuid}` : ''}`, {
            method: row ? 'PATCH' : 'POST',
            body,
          });
          toast('Saved.');
        } catch (e) {
          if (!isChangeRequired(e)) throw e;
          await submitChangeRequest(uuid, {
            section: config.section,
            operation,
            ...(row ? { target_id: row.uuid } : {}),
            requested_value: body,
          });
          toast('Change request submitted for approval.');
        }
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));
  const countryOptions = countries.map((c) => ({ value: c.code, label: c.name || c.code }));
  const idTypes = (pack?.identifier_types || [])
    .filter((t) => !t.kind || t.kind === 'identity')
    .map((t) => ({ value: t.key, label: t.label }));
  const schema = pack?.bank_schema || [];
  if (row && config.kind === 'bank-accounts' && !revealed)
    return (
      <div>
        <p>
          Bank details are encrypted. Reveal access is audited and required to load them before an
          edit so existing values cannot be overwritten accidentally.
        </p>
        {!can('people.sensitive.reveal') ? (
          <p role="alert">You need sensitive-data reveal access to edit this bank account.</p>
        ) : null}
        {error && <p role="alert">{error}</p>}
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {can('people.sensitive.reveal') && (
            <Button loading={busy} onClick={loadExistingDetails}>
              Load details securely
            </Button>
          )}
        </div>
      </div>
    );
  return (
    <form onSubmit={save} noValidate>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {config.kind === 'identity' ? (
          <>
            <Select
              label="Country"
              required
              value={values.country}
              onChange={(e) => {
                set('country', e.target.value);
                set('type', '');
              }}
              options={[{ value: '', label: 'Choose country…' }, ...countryOptions]}
            />
            <Select
              label="Document type"
              required
              value={values.type}
              onChange={(e) => set('type', e.target.value)}
              options={[{ value: '', label: 'Choose type…' }, ...idTypes]}
            />
            <Input
              label={row ? 'Replace number (leave blank to keep current)' : 'Document number'}
              required={!row}
              value={values.number}
              onChange={(e) => set('number', e.target.value)}
              autoComplete="off"
            />
            <Input
              label="Issue date"
              type="date"
              value={values.issue_date}
              onChange={(e) => set('issue_date', e.target.value)}
            />
            <Input
              label="Expiry date"
              type="date"
              value={values.expiry_date}
              onChange={(e) => set('expiry_date', e.target.value)}
            />
          </>
        ) : (
          <>
            <Input
              label="Account holder"
              required
              value={values.account_holder}
              onChange={(e) => set('account_holder', e.target.value)}
            />
            <Input
              label="Bank name"
              required
              value={values.bank_name}
              onChange={(e) => set('bank_name', e.target.value)}
            />
            <Select
              label="Country"
              required
              value={values.country}
              onChange={(e) => {
                set('country', e.target.value);
                set('details', {});
              }}
              options={[{ value: '', label: 'Choose country…' }, ...countryOptions]}
            />
            <Input
              label="Currency"
              maxLength={3}
              value={values.currency}
              onChange={(e) => set('currency', e.target.value.toUpperCase())}
            />
            <Input
              label="Effective from"
              type="date"
              value={values.effective_from}
              onChange={(e) => set('effective_from', e.target.value)}
            />
            <Input
              label="Effective to"
              type="date"
              value={values.effective_to}
              onChange={(e) => set('effective_to', e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.is_primary}
                onChange={(e) => set('is_primary', e.target.checked)}
              />{' '}
              Primary account
            </label>
            {schema.map((field) => (
              <Input
                key={field.key}
                label={field.label}
                required={Boolean(field.required)}
                value={values.details[field.key] || ''}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    details: { ...v.details, [field.key]: e.target.value },
                  }))
                }
                autoComplete="off"
              />
            ))}
          </>
        )}
      </div>
      <div className="mt-5 flex justify-end gap-2.5">
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {mode === 'request' ? 'Submit for approval' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

function SensitiveList({ uuid, config, mode = 'none' }) {
  const { can } = useAuth(),
    toast = useToast();
  const resource = useResource(`/v1/employees/${uuid}/${config.kind}`);
  const [confirm, setConfirm] = useState(null),
    [editor, setEditor] = useState(null),
    [shown, setShown] = useState({}),
    [busy, setBusy] = useState(false);
  const timers = useRef({});
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  const hide = (id) => {
    clearTimeout(timers.current[id]);
    setShown((s) => {
      const { [id]: _removed, ...rest } = s;
      return rest;
    });
  };
  async function reveal() {
    setBusy(true);
    try {
      const result = await revealIdentity(uuid, confirm.uuid, config.kind);
      const id = confirm.uuid;
      setShown((s) => ({ ...s, [id]: config.revealed(result) }));
      timers.current[id] = setTimeout(() => hide(id), HIDE_AFTER_MS);
      setConfirm(null);
    } catch (e) {
      toast(e.message, 'error');
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      if (mode === 'request')
        await submitChangeRequest(uuid, {
          section: config.section,
          operation: 'delete',
          target_id: confirm.uuid,
        });
      else if (config.kind === 'identity')
        await api(`/v1/employees/${uuid}/identity/${confirm.uuid}`, { method: 'DELETE' });
      else
        await api(`/v1/employees/${uuid}/bank-accounts/${confirm.uuid}/retire`, {
          method: 'POST',
          body: {},
        });
      toast(mode === 'request' ? 'Change request submitted for approval.' : 'Record updated.');
      setConfirm(null);
      resource.reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Resource resource={resource}>
      {(data) => {
        const rows = data.data || [],
          editMode = data.viewer?.edit ?? mode,
          writable = editMode === 'direct' || editMode === 'request';
        return (
          <section aria-label={config.title} className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-sm">{config.title}</h2>
                {editMode === 'request' && (
                  <p className="m-0 text-xs text-slate-500">Changes are sent for approval.</p>
                )}
              </div>
              {writable && (
                <Button variant="secondary" onClick={() => setEditor({})}>
                  <Plus size={16} /> {editMode === 'request' ? 'Request to add' : 'Add'}{' '}
                  {config.noun}
                </Button>
              )}
            </div>
            {rows.length === 0 ? (
              <EmptyState
                title={`No ${config.title.toLowerCase()}`}
                description="Nothing has been recorded."
              />
            ) : (
              <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800">
                {rows.map((r) => (
                  <li
                    key={r.uuid}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <strong className="block text-sm">{config.heading(r)}</strong>
                      <span className="break-all font-mono text-xs" aria-live="polite">
                        {shown[r.uuid] ?? config.masked(r)}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {config.detail(r)}
                      </span>
                      {r.verification_status && (
                        <Badge tone={r.verification_status === 'verified' ? 'green' : 'neutral'}>
                          {r.verification_status}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {can('people.sensitive.reveal') &&
                        (shown[r.uuid] ? (
                          <Button variant="secondary" onClick={() => hide(r.uuid)}>
                            <EyeOff size={16} /> Hide
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            aria-label={`Reveal ${config.heading(r)}`}
                            onClick={() => setConfirm({ action: 'reveal', ...r })}
                          >
                            <Eye size={16} /> Reveal
                          </Button>
                        ))}
                      {writable && (
                        <>
                          <Button
                            variant="ghost"
                            aria-label={`Edit ${config.heading(r)}`}
                            onClick={() => setEditor({ row: r })}
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label={`${config.kind === 'identity' ? 'Remove' : 'Retire'} ${config.heading(r)}`}
                            onClick={() => setConfirm({ action: 'remove', ...r })}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Modal
              open={Boolean(editor)}
              onClose={() => setEditor(null)}
              title={`${editor?.row ? 'Edit' : editMode === 'request' ? 'Request to add' : 'Add'} ${config.noun}`}
            >
              {editor && (
                <SensitiveEditor
                  uuid={uuid}
                  config={config}
                  row={editor.row}
                  mode={editMode}
                  onClose={() => setEditor(null)}
                  onSaved={resource.reload}
                />
              )}
            </Modal>
            <Modal
              open={Boolean(confirm)}
              onClose={() => setConfirm(null)}
              title={
                confirm?.action === 'remove'
                  ? `${config.kind === 'identity' ? 'Remove' : 'Retire'} record?`
                  : 'Reveal sensitive information?'
              }
            >
              {confirm?.action === 'remove' ? (
                <>
                  <p>
                    {editMode === 'request'
                      ? 'This change will be submitted for approval.'
                      : 'This action is recorded in the audit log.'}
                  </p>
                  <div className="mt-5 flex justify-end gap-2.5">
                    <Button variant="secondary" onClick={() => setConfirm(null)}>
                      Cancel
                    </Button>
                    <Button loading={busy} onClick={remove}>
                      {editMode === 'request' ? 'Submit request' : 'Confirm'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    This shows the full value of {confirm && config.heading(confirm)}. The access is
                    recorded in the audit log, and the value is hidden again after 30 seconds.
                  </p>
                  <div className="mt-6 flex justify-end gap-2.5">
                    <Button variant="secondary" onClick={() => setConfirm(null)}>
                      Cancel
                    </Button>
                    <Button onClick={reveal} loading={busy}>
                      Reveal
                    </Button>
                  </div>
                </>
              )}
            </Modal>
          </section>
        );
      }}
    </Resource>
  );
}

export default function SensitivePanel({ uuid, sections, edit = {} }) {
  return (
    <>
      {sections.includes('identity') && (
        <SensitiveList uuid={uuid} config={IDENTITY} mode={edit.identity || 'none'} />
      )}
      {sections.includes('bank') && (
        <SensitiveList uuid={uuid} config={BANK} mode={edit.bank || 'none'} />
      )}
    </>
  );
}
