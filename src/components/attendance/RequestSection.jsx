import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { useResource } from '../../lib/hooks';
import { newKey } from '../../lib/attendanceApi';
import { useAuth } from '../../lib/auth';
import { listOf, paths } from '../../lib/timeOfficeApi';
import ResponsiveList from '../ResponsiveList';
import {
  Button,
  Card,
  Checkbox,
  FormError,
  Input,
  Modal,
  Resource,
  Select,
  Textarea,
  useToast,
} from '../ui';
import { requestConfigs } from './requestConfigs';
import { toneClasses } from './StatusBadge';

function Chip({ status, tones }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize ${toneClasses[tones[status] || 'slate']}`}
    >
      {String(status).replaceAll('_', ' ')}
    </span>
  );
}

/** Lookup selects used by the shift swap form: coworkers come from the directory, shifts from the shift catalogue. */
function RemoteSelect({ label, error, name, value, onChange, kind }) {
  const [options, setOptions] = useState([]);
  const [term, setTerm] = useState('');
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      const path = kind === 'colleague' ? `/v1/directory?${new URLSearchParams({ per_page: '25', ...(term ? { q: term } : {}) })}` : `${paths.shifts}?active_only=1`;
      api(path)
        .then((r) => live && setOptions(listOf(r).map((x) => ({ value: x.uuid, label: kind === 'colleague' ? `${x.display_name}${x.employee_number ? ` (${x.employee_number})` : ''}` : `${x.name} (${x.code})` }))))
        .catch(() => live && setOptions([]));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [kind, term]);
  const shown = value && !options.some((o) => o.value === value) ? [{ value, label: 'Selected' }, ...options] : options;
  return (
    <>
      {kind === 'colleague' && <Input label="Search colleagues" type="search" value={term} onChange={(e) => setTerm(e.target.value)} />}
      <Select label={label} name={name} error={error} value={value} options={[{ value: '', label: 'Choose…' }, ...shown]} onChange={onChange} />
    </>
  );
}

function RequestForm({ config, initial, onDone, onClose }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(null);
  const toast = useToast();
  const set = (name) => (e) =>
    setValues((v) => ({ ...v, [name]: e.target?.type === 'checkbox' ? e.target.checked : e.target.value }));
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const found = config.validate(values);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    key.current ??= newKey();
    const body = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '' && v !== null));
    try {
      await api(config.path, { method: 'POST', body: { ...body, idempotency_key: key.current } });
      toast(`Your ${config.noun} was submitted.`);
      key.current = null;
      onDone();
    } catch (err) {
      if (err instanceof ApiError) key.current = null; // a definite answer: a retry is a new attempt
      setServerError(err);
      const fe = {};
      Object.entries(err.errors || {}).forEach(([k, v]) => (fe[k] = [].concat(v).join(' ')));
      setErrors(fe);
    } finally {
      setBusy(false);
    }
  }
  const shown = serverError && Object.keys(serverError.errors || {}).length ? { message: serverError.message } : serverError;
  return (
    <form onSubmit={submit} noValidate aria-label={`New ${config.noun}`}>
      <FormError error={shown && { message: serverError.status === 423 ? `Locked: ${serverError.message}` : shown.message }} />
      {config.fields
        .filter((f) => !f.showIf || f.showIf(values))
        .map((f) => {
          const common = { label: f.label, error: errors[f.name], name: f.name };
          if (f.type === 'colleague' || f.type === 'shift')
            return <RemoteSelect key={f.name} {...common} kind={f.type} value={values[f.name]} onChange={set(f.name)} />;
          if (f.type === 'select')
            return <Select key={f.name} {...common} options={f.options} value={values[f.name]} onChange={set(f.name)} />;
          if (f.type === 'textarea')
            return <Textarea key={f.name} {...common} value={values[f.name]} onChange={set(f.name)} />;
          if (f.type === 'checkbox')
            return <Checkbox key={f.name} label={f.label} checked={!!values[f.name]} onChange={set(f.name)} />;
          return (
            <Input
              key={f.name}
              {...common}
              type={f.type}
              {...(f.type === 'number' ? { min: 1, max: 1440 } : {})}
              value={values[f.name]}
              onChange={set(f.name)}
            />
          );
        })}
      <div className="mt-2 flex justify-end gap-2.5">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {busy ? 'Submitting…' : 'Submit request'}
        </Button>
      </div>
    </form>
  );
}

/** List + "new request" form for one request kind (regularization, overtime, on-duty, shift swap). */
export default function RequestSection({ kind }) {
  const config = requestConfigs[kind];
  const [params] = useSearchParams();
  const [open, setOpen] = useState(kind === 'regularization' && !!params.get('date'));
  const [pending, setPending] = useState(null);
  const resource = useResource(config.path);
  const toast = useToast();
  const me = useAuth()?.session?.user?.name;
  const initial = { ...config.initial, ...(kind === 'regularization' && params.get('date') ? { date: params.get('date') } : {}) };
  /** The shift-swap API names people but returns no role flags, so the viewer's role is derived from the names. */
  const flags = (r) =>
    kind === 'swaps'
      ? {
          ...r,
          can_withdraw: Boolean(me) && r.requester === me && ['pending', 'counterpart_accepted'].includes(r.status),
          can_respond: Boolean(me) && r.counterpart === me && r.type === 'swap' && r.status === 'pending',
        }
      : r;
  async function respond(row, accept) {
    setPending(row.uuid);
    try {
      await api(`${config.path}/${row.uuid}/respond`, { method: 'POST', body: { accept } });
      toast(accept ? 'You accepted the swap. Your approver decides next.' : 'You declined the swap.');
      resource.reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setPending(null);
    }
  }
  async function withdraw(row) {
    setPending(row.uuid);
    try {
      await api(`${config.path}/${row.uuid}/withdraw`, { method: 'POST' });
      toast('Request withdrawn.');
      resource.reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setPending(null);
    }
  }
  const card = (r) => (
    <div>
      <div className="flex items-start justify-between gap-2">
        <strong className="text-sm">{r.date ?? r.work_date}</strong>
        <Chip status={r.status} tones={config.statusTone} />
      </div>
      <p className="m-0 mt-0.5 text-xs text-slate-600 dark:text-slate-300">{r.type_label || r.reason}</p>
      {config.facts.map(([label, k]) => r[k] && (
        <p key={label} className="m-0 text-[11px] text-slate-500 dark:text-slate-400">{label}: {r[k]}</p>
      ))}
      {r.can_respond && (
        <span className="mt-2 flex gap-2">
          <Button loading={pending === r.uuid} onClick={() => respond(r, true)}>Accept</Button>
          <Button variant="secondary" disabled={pending === r.uuid} onClick={() => respond(r, false)}>Decline</Button>
        </span>
      )}
      {r.can_withdraw && (
        <Button variant="secondary" className="mt-2" loading={pending === r.uuid} onClick={(e) => { e.stopPropagation(); withdraw(r); }}>
          Withdraw
        </Button>
      )}
    </div>
  );
  return (
    <Card
      title={config.title}
      action={<Button onClick={() => setOpen(true)}>New request</Button>}
    >
      <p className="m-0 px-6 pb-3 text-xs text-slate-500 dark:text-slate-400">{config.description}</p>
        <Resource resource={resource}>
          {(data) => (
            <ResponsiveList
              label={`${config.title} requests`}
              rows={(data.data || []).map(flags)}
              empty={{ title: 'No requests yet', description: `Your ${config.noun}s will appear here.` }}
              card={card}
              columns={[
                ...config.columns,
                { key: 'status', label: 'Status', render: (r) => <Chip status={r.status} tones={config.statusTone} /> },
                {
                  key: 'actions',
                  label: '',
                  render: (r) => (
                    <span className="flex gap-2">
                      {r.can_respond && (
                        <>
                          <Button loading={pending === r.uuid} onClick={() => respond(r, true)}>Accept</Button>
                          <Button variant="secondary" disabled={pending === r.uuid} onClick={() => respond(r, false)}>Decline</Button>
                        </>
                      )}
                      {r.can_withdraw && (
                        <Button variant="secondary" loading={pending === r.uuid} onClick={() => withdraw(r)}>
                          Withdraw
                        </Button>
                      )}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </Resource>
      <Modal open={open} onClose={() => setOpen(false)} title={`New ${config.noun}`}>
        <RequestForm
          config={config}
          initial={initial}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            resource.reload();
          }}
        />
      </Modal>
    </Card>
  );
}
