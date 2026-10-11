import { useState } from 'react';
import { api, download, query } from '../../lib/api';
import { useResource } from '../../lib/hooks';
import {
  Badge,
  Button,
  Checkbox,
  Field,
  FormError,
  Input,
  Modal,
  Pagination,
  Radio,
  Resource,
  Select,
  useToast,
} from '../ui';
import ResponsiveList from '../ResponsiveList';
import { usePoll, importDone } from './ImportExportPoll';

export const STEPS = [
  ['upload', 'Upload'],
  ['mapping', 'Map columns'],
  ['validate', 'Validate'],
  ['commit', 'Import'],
];
const MAX_BYTES = 10 * 1024 * 1024;

export function validateFile(file) {
  if (!file) return 'Choose a CSV or XLSX file.';
  if (!/\.(csv|xlsx)$/i.test(file.name)) return 'Only .csv and .xlsx files are supported.';
  if (file.size > MAX_BYTES) return 'The file is larger than 10 MB.';
  return '';
}

function Stepper({ step }) {
  const current = STEPS.findIndex(([key]) => key === step);
  return (
    <ol
      className="m-0 mb-6 flex list-none flex-wrap gap-2 p-0 text-xs"
      aria-label="Import progress"
    >
      {STEPS.map(([key, label], i) => (
        <li key={key} aria-current={i === current ? 'step' : undefined}>
          <Badge tone={i === current ? 'purple' : i < current ? 'green' : 'neutral'}>
            {i + 1}. {label}
          </Badge>
        </li>
      ))}
    </ol>
  );
}

function UploadStep({ onStaged }) {
  const [error, setError] = useState(null),
    [fileError, setFileError] = useState(''),
    [busy, setBusy] = useState(false),
    [dateFormat, setDateFormat] = useState('Y-m-d');
  async function submit(event) {
    event.preventDefault();
    const file = event.target.elements.file?.files?.[0],
      problem = validateFile(file),
      form = new FormData();
    setFileError(problem);
    if (problem) return;
    form.set('file', file);
    form.set('options[date_format]', dateFormat);
    setBusy(true);
    setError(null);
    try {
      onStaged(await api('/v1/people/imports', { method: 'POST', body: form }));
    } catch (e) {
      setError(e);
      if (e.errors?.file) setFileError(e.errors.file.join(' '));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} noValidate className="max-w-xl">
      <FormError error={error} />
      <Field
        label="Employee spreadsheet"
        htmlFor="import-file"
        error={fileError}
        hint="CSV or XLSX, up to 10 MB and 20,000 rows."
      >
        <input
          id="import-file"
          name="file"
          type="file"
          accept=".csv,.xlsx"
          aria-invalid={!!fileError}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-brand-700 dark:file:bg-brand-950 dark:file:text-brand-300"
        />
      </Field>
      {fileError && (
        <p role="alert" className="-mt-3 mb-5 text-xs text-rose-700 dark:text-rose-300">
          {fileError}
        </p>
      )}
      <Select
        label="Date format in the file"
        value={dateFormat}
        onChange={(e) => setDateFormat(e.target.value)}
        options={[
          { value: 'Y-m-d', label: 'YYYY-MM-DD' },
          { value: 'd/m/Y', label: 'DD/MM/YYYY' },
          { value: 'm/d/Y', label: 'MM/DD/YYYY' },
        ]}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={busy}>
          Upload and continue
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            download('/v1/people/imports/template?format=csv', 'employee-template.csv').catch(
              setError,
            )
          }
        >
          Download template
        </Button>
      </div>
    </form>
  );
}

function MappingStep({ staged, onValidated }) {
  const [mapping, setMapping] = useState(staged.mapping || {}),
    [duplicates, setDuplicates] = useState('skip_duplicates'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [missing, setMissing] = useState([]);
  const headers = staged.headers || [],
    samples = Object.fromEntries((staged.columns || []).map((c) => [c.header, c.samples])),
    targets = staged.targets || [];
  async function validate() {
    const absent = targets
      .filter((t) => t.required && !mapping[t.key])
      .map((t) => t.label || t.key);
    setMissing(absent);
    if (absent.length) return;
    setBusy(true);
    setError(null);
    try {
      const clean = Object.fromEntries(Object.entries(mapping).filter(([, v]) => v));
      await api(`/v1/people/imports/${staged.uuid}/mapping`, {
        method: 'PUT',
        body: { mapping: clean, options: { [duplicates]: true } },
      });
      onValidated(await api(`/v1/people/imports/${staged.uuid}/validate`, { method: 'POST' }));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <FormError error={error} />
      {missing.length > 0 && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"
        >
          Map the required columns first: {missing.join(', ')}.
        </div>
      )}
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        {staged.filename} · {staged.total_rows} rows. Nothing is created until you confirm.
      </p>
      <div className="grid gap-x-5 sm:grid-cols-2">
        {targets.map((target) => (
          <Select
            key={target.key}
            label={`${target.label || target.key}${target.required ? ' *' : ''}`}
            value={mapping[target.key] || ''}
            onChange={(e) => setMapping({ ...mapping, [target.key]: e.target.value })}
            error={missing.includes(target.label || target.key) ? 'Required' : undefined}
            options={[
              { value: '', label: 'Do not import' },
              ...headers.map((h) => ({
                value: h,
                label: samples[h]?.length ? `${h} (e.g. ${samples[h].slice(0, 2).join(', ')})` : h,
              })),
            ]}
          />
        ))}
      </div>
      <fieldset className="mb-5 space-y-2">
        <legend className="mb-2 text-xs font-semibold">Possible duplicate employees</legend>
        <Radio
          label="Skip them"
          name="dupes"
          checked={duplicates === 'skip_duplicates'}
          onChange={() => setDuplicates('skip_duplicates')}
        />
        <Radio
          label="Import them anyway"
          name="dupes"
          checked={duplicates === 'allow_duplicates'}
          onChange={() => setDuplicates('allow_duplicates')}
        />
      </fieldset>
      <Button loading={busy} onClick={validate}>
        Validate rows
      </Button>
    </div>
  );
}

function ProblemRows({ uuid, onValidated }) {
  const [page, setPage] = useState(1),
    resource = useResource(
      `/v1/people/imports/${uuid}/rows?${query({ status: 'error,warning', page, per_page: 20 })}`,
    ),
    [editing, setEditing] = useState(null);
  const messages = (r) =>
    [...(r.errors || []), ...(r.warnings || [])].map((m) => m.message || String(m));
  async function save(values) {
    await api(`/v1/people/imports/${uuid}/rows/${editing.row_number}`, {
      method: 'PATCH',
      body: { values },
    });
    const updated = await api(`/v1/people/imports/${uuid}/validate`, { method: 'POST' });
    onValidated(updated);
    resource.reload();
    setEditing(null);
  }
  return (
    <Resource resource={resource}>
      {(data) => (
        <>
          <ResponsiveList
            label="Rows needing attention"
            rows={data.data || []}
            rowKey={(r) => r.row_number}
            columns={[
              { key: 'row_number', label: 'Row', priority: 'always' },
              {
                key: 'status',
                label: 'Status',
                priority: 'always',
                render: (r) => (
                  <Badge tone={r.status === 'error' ? 'amber' : 'neutral'}>{r.status}</Badge>
                ),
              },
              {
                key: 'summary',
                label: 'Employee',
                priority: 'md',
                render: (r) => (typeof r.summary === 'string' ? r.summary : r.summary?.name) || '—',
              },
              {
                key: 'messages',
                label: 'Problems',
                priority: 'always',
                render: (r) => (
                  <ul className="m-0 list-disc pl-4">
                    {messages(r).map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                ),
              },
              {
                key: 'edit',
                label: 'Correction',
                priority: 'always',
                render: (r) => (
                  <Button
                    variant="secondary"
                    disabled={r.status === 'imported'}
                    onClick={() => setEditing(r)}
                  >
                    Edit row
                  </Button>
                ),
              },
            ]}
            mobile={{
              title: (r) => `Row ${r.row_number}`,
              subtitle: (r) => messages(r).join('; '),
              badge: (r) => (
                <Badge tone={r.status === 'error' ? 'amber' : 'neutral'}>{r.status}</Badge>
              ),
            }}
            empty={{
              title: 'No problem rows',
              description: 'Every validated row is ready to import.',
            }}
          />
          <Pagination data={data} onChange={setPage} />
          {editing && (
            <ImportRowEditor row={editing} onClose={() => setEditing(null)} onSave={save} />
          )}
        </>
      )}
    </Resource>
  );
}

function ImportRowEditor({ row, onClose, onSave }) {
  const [values, setValues] = useState(row.raw || {});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave(values);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={`Correct import row ${row.row_number}`}>
      <form onSubmit={submit} noValidate>
        <FormError error={error} />
        <p className="mb-4 text-xs text-slate-500">
          Correct the source values, then the import is revalidated before you can confirm it.
        </p>
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {Object.entries(values).map(([header, value]) => (
            <Input
              key={header}
              label={header}
              value={value ?? ''}
              onChange={(event) =>
                setValues((current) => ({ ...current, [header]: event.target.value }))
              }
            />
          ))}
        </div>
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save and revalidate
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ValidateStep({ staged, onCommitted, onBack, onRevalidated }) {
  const [accept, setAccept] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    counts = staged.counts || {};
  async function commit() {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/people/imports/${staged.uuid}/commit`, {
        method: 'POST',
        body: { accept_errors: accept },
      });
      onCommitted();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const blocked = counts.error > 0 && !accept;
  return (
    <div className="space-y-5">
      <FormError error={error} />
      <p className="text-sm" role="status">
        {counts.valid ?? 0} valid · {counts.warning ?? 0} warnings · {counts.error ?? 0} errors
      </p>
      {(counts.error > 0 || counts.warning > 0) && (
        <ProblemRows uuid={staged.uuid} onValidated={onRevalidated} />
      )}
      {counts.error > 0 && (
        <Checkbox
          label="Import valid rows and skip rows with errors"
          checked={accept}
          onChange={(e) => setAccept(e.target.checked)}
        />
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back to mapping
        </Button>
        <Button
          loading={busy}
          disabled={blocked || (!counts.valid && !counts.warning)}
          onClick={commit}
        >
          Confirm import
        </Button>
      </div>
    </div>
  );
}

export function CommitStep({ uuid, onReset, interval }) {
  const { data, error } = usePoll(`/v1/people/imports/${uuid}`, importDone, interval),
    done = importDone(data),
    toast = useToast();
  const counts = data?.counts || {};
  return (
    <div className="space-y-5" aria-live="polite">
      <FormError error={error} />
      {!data && !error && <p className="text-sm">Starting import…</p>}
      {data && !done && (
        <div>
          <p className="mb-2 text-sm">
            Importing… {data.processed_rows ?? 0} of {data.total_rows ?? '?'} rows
          </p>
          <progress
            className="h-3 w-full accent-brand-500"
            max={data.total_rows || 1}
            value={data.processed_rows ?? 0}
            aria-label="Import progress"
          />
        </div>
      )}
      {done && (
        <div className="space-y-4">
          <Badge tone={data.status === 'completed' ? 'green' : 'amber'}>
            {data.status.replaceAll('_', ' ')}
          </Badge>
          <p className="text-sm">
            {counts.imported ?? 0} imported · {counts.error ?? 0} errors · {counts.skipped ?? 0}{' '}
            skipped
          </p>
          {data.error && <p className="text-sm text-rose-700 dark:text-rose-300">{data.error}</p>}
          <div className="flex flex-wrap gap-3">
            {counts.error > 0 && (
              <Button
                variant="secondary"
                onClick={() =>
                  download(`/v1/people/imports/${uuid}/errors.csv`, 'import-errors.csv').catch(
                    (e) => toast(e.message, 'error'),
                  )
                }
              >
                Download errors.csv
              </Button>
            )}
            <Button onClick={onReset}>Start another import</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ImportExportWizard({ onFinished, pollInterval }) {
  const [step, setStep] = useState('upload'),
    [staged, setStaged] = useState(null);
  const reset = () => {
    setStaged(null);
    setStep('upload');
    onFinished?.();
  };
  return (
    <div className="p-4 sm:p-6">
      <Stepper step={step} />
      {step === 'upload' && (
        <UploadStep
          onStaged={(s) => {
            setStaged(s);
            setStep('mapping');
          }}
        />
      )}
      {step === 'mapping' && (
        <MappingStep
          staged={staged}
          onValidated={(v) => {
            setStaged({ ...staged, ...v });
            setStep('validate');
          }}
        />
      )}
      {step === 'validate' && (
        <ValidateStep
          staged={staged}
          onBack={() => setStep('mapping')}
          onCommitted={() => setStep('commit')}
          onRevalidated={(v) => setStaged({ ...staged, ...v })}
        />
      )}
      {step === 'commit' && (
        <CommitStep uuid={staged.uuid} onReset={reset} interval={pollInterval} />
      )}
    </div>
  );
}
