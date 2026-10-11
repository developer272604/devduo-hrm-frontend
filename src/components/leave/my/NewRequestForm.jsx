import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../../lib/api';
import {
  PORTIONS,
  allowedPortions,
  buildRequestBody,
  describeError,
  leavePaths,
  listOf,
  newKey,
  previewRequest,
  submitRequest,
} from '../../../lib/leaveApi';
import { Button, Card, FormError, Input, Select, Textarea, useToast } from '../../ui';
import ImpactPreview from '../shared/ImpactPreview';
import { ConflictList } from '../shared/LeaveBadge';
import { emptyRequest, validateLeaveRequest } from './leaveForm';

/** Colleague lookup for the delegate field (directory search, debounced). */
function DelegateSelect({ value, onChange }) {
  const [term, setTerm] = useState('');
  const [options, setOptions] = useState([]);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      const q = new URLSearchParams({ per_page: '25', ...(term ? { q: term } : {}) });
      api(`${leavePaths.directory}?${q}`)
        .then((r) => live && setOptions(listOf(r).map((x) => ({ value: x.uuid, label: x.display_name || x.name }))))
        .catch(() => live && setOptions([]));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [term]);
  const shown = value && !options.some((o) => o.value === value) ? [{ value, label: 'Selected colleague' }, ...options] : options;
  return (
    <>
      <Input label="Search for someone to cover" type="search" value={term} onChange={(e) => setTerm(e.target.value)} />
      <Select
        label="Delegate (optional)"
        name="delegate_employee"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={[{ value: '', label: 'No one' }, ...shown]}
      />
    </>
  );
}

/**
 * New / modify / comp-off-claim request with a live impact preview.
 *   mode "new"    POST requests
 *   mode "modify" POST requests/{original}/modify (preview carries `modifies`)
 *   mode "claim"  POST comp-off/{credit}/claim (leave type fixed to the credit's)
 * One Idempotency-Key per attempt: kept after a lost connection (safe retry), renewed after any definite server answer.
 */
export default function NewRequestForm({ types, mode = 'new', original, credit, initial }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [values, setValues] = useState(() => emptyRequest(initial));
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const key = useRef(null);
  const submitting = useRef(false);

  const type = types.find((t) => t.uuid === values.leave_type);
  const portions = allowedPortions(type);
  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }));
  const checks = useMemo(() => validateLeaveRequest(values, type, files), [values, type, files]);
  const previewBody = useMemo(
    () => buildRequestBody(values, mode === 'modify' && original ? { modifies: original.uuid } : {}),
    [values, mode, original],
  );
  const previewable = Boolean(values.leave_type && values.start_date && !checks.end_date && !checks.start_time && !checks.portion);
  const previewKey = JSON.stringify(previewBody);

  useEffect(() => {
    if (!previewable) {
      setPreview(null);
      setPreviewError(null);
      return undefined;
    }
    const controller = new AbortController();
    setPreviewing(true);
    const timer = setTimeout(() => {
      previewRequest(JSON.parse(previewKey), controller.signal)
        .then((res) => {
          setPreview(res?.data && !Array.isArray(res.data) && res.data.duration !== undefined ? res.data : res);
          setPreviewError(null);
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          if (err.status === 422 && (err.data?.conflicts || err.data?.duration)) {
            // "Cannot proceed" is a normal answer: show why, keep the form usable.
            setPreview({ can_submit: false, duration: err.data.duration, conflicts: err.data.conflicts || [], errors: err.errors });
            setPreviewError(null);
          } else {
            setPreview(null);
            setPreviewError(describeError(err));
          }
        })
        .finally(() => !controller.signal.aborted && setPreviewing(false));
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [previewKey, previewable]);

  async function submit(e) {
    e.preventDefault();
    if (submitting.current) return;
    setErrors(checks);
    setServerError(null);
    setConflicts([]);
    if (Object.keys(checks).length) return;
    submitting.current = true;
    setBusy(true);
    key.current ??= newKey();
    const path =
      mode === 'modify' ? leavePaths.requestAction(original.uuid, 'modify') : mode === 'claim' ? leavePaths.compOffAction(credit.uuid, 'claim') : leavePaths.requests;
    try {
      const res = await submitRequest({ path, body: buildRequestBody(values), files, key: key.current });
      key.current = null;
      const data = res?.data ?? res;
      toast(res?.duplicate ? 'This request was already submitted. Showing the original.' : mode === 'modify' ? 'Your change was submitted for approval.' : 'Your leave request was submitted.');
      navigate(`/leave/requests/${data.uuid}`);
    } catch (err) {
      if (err instanceof ApiError) key.current = null; // a definite answer: a retry is a new attempt
      setServerError(err);
      setConflicts(err.data?.conflicts || []);
      const fe = {};
      Object.entries(err.errors || {}).forEach(([k, v]) => (fe[k.split('.')[0]] = [].concat(v).join(' ')));
      setErrors(fe);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const fieldNames = ['leave_type', 'start_date', 'end_date', 'portion', 'start_time', 'end_time', 'reason', 'handover_notes', 'delegate_employee', 'documents'];
  const formLevel = serverError && {
    message:
      serverError.status === 422 && Object.keys(serverError.errors || {}).length
        ? [serverError.message, ...Object.entries(serverError.errors).filter(([k]) => !fieldNames.includes(k.split('.')[0])).flatMap(([, v]) => v)].filter(Boolean).join(' ')
        : describeError(serverError),
  };
  const blocked = preview?.can_submit === false;
  const label = mode === 'modify' ? 'Submit change' : mode === 'claim' ? 'Claim comp-off' : 'Submit request';
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <Card title={mode === 'modify' ? 'Change approved leave' : mode === 'claim' ? 'Use a comp-off credit' : 'New leave request'}>
        <form onSubmit={submit} noValidate aria-label="Leave request">
          <FormError error={formLevel} />
          {conflicts.length > 0 && (
            <div className="mb-5">
              <ConflictList conflicts={conflicts} label="Why this could not be submitted" />
            </div>
          )}
          <Select
            label="Leave type"
            name="leave_type"
            value={values.leave_type}
            disabled={mode === 'claim'}
            error={errors.leave_type}
            options={[{ value: '', label: 'Choose a type…' }, ...types.map((t) => ({ value: t.uuid, label: t.name }))]}
            onChange={(e) => {
              const next = types.find((t) => t.uuid === e.target.value);
              setValues((v) => ({
                ...v,
                leave_type: e.target.value,
                portion: allowedPortions(next).includes(v.portion) ? v.portion : 'full_day',
              }));
            }}
          />
          <div className="grid gap-x-5 sm:grid-cols-2">
            <Input label="First day" type="date" name="start_date" value={values.start_date} error={errors.start_date} onChange={set('start_date')} />
            <Input label="Last day" type="date" name="end_date" min={values.start_date} value={values.end_date} error={errors.end_date} hint="Leave empty for a single day." onChange={set('end_date')} />
          </div>
          {portions.length > 1 && (
            <Select
              label="How much of the day"
              name="portion"
              value={values.portion}
              error={errors.portion}
              options={portions.map((p) => ({ value: p, label: PORTIONS[p] || p }))}
              onChange={set('portion')}
            />
          )}
          {values.portion === 'hours' && (
            <div className="grid gap-x-5 sm:grid-cols-2">
              <Input label="From" type="time" name="start_time" value={values.start_time} error={errors.start_time} onChange={set('start_time')} />
              <Input label="To" type="time" name="end_time" value={values.end_time} error={errors.end_time} hint="An earlier end time means it runs past midnight." onChange={set('end_time')} />
            </div>
          )}
          <Textarea label="Reason" name="reason" value={values.reason} error={errors.reason} onChange={set('reason')} />
          <Textarea label="Handover notes (optional)" name="handover_notes" value={values.handover_notes} error={errors.handover_notes} onChange={set('handover_notes')} />
          <DelegateSelect value={values.delegate_employee} onChange={(v) => setValues((s) => ({ ...s, delegate_employee: v }))} />
          {errors.delegate_employee && <p role="alert" className="m-0 mb-4 text-xs text-rose-700 dark:text-rose-300">{errors.delegate_employee}</p>}
          <div className="mb-5">
            <label htmlFor="leave-docs" className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Supporting documents (optional, up to 5 MB each)
            </label>
            <input
              id="leave-docs"
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg"
              className="block w-full text-xs"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            {files.length > 0 && (
              <ul className="m-0 mt-2 list-none p-0 text-xs text-slate-600 dark:text-slate-300">
                {files.map((f) => (
                  <li key={f.name}>{f.name}</li>
                ))}
              </ul>
            )}
            {errors.documents && <p role="alert" className="m-0 mt-1 text-xs text-rose-700 dark:text-rose-300">{errors.documents}</p>}
          </div>
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={blocked}>
              {busy ? 'Submitting…' : label}
            </Button>
          </div>
          {blocked && (
            <p className="m-0 mt-3 text-right text-xs text-rose-700 dark:text-rose-300">
              This cannot be submitted as it stands. See the problems in the preview.
            </p>
          )}
        </form>
      </Card>
      <Card title="What this will do">
        <div className="px-6 pb-6">
          <ImpactPreview preview={preview} loading={previewing} error={previewError} unit={type?.unit} />
        </div>
      </Card>
    </div>
  );
}
