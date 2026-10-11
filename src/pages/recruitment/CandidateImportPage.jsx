import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { Badge, Button, Card, Checkbox, ErrorState, useToast } from '../../components/ui';
import { Banner, Page } from '../../components/recruitment/kit';
import { api } from '../../lib/api';
import { IMPORT_HEADERS, IMPORT_MAX_BYTES, fmtDate, paths } from '../../lib/recruitmentApi';

const STEPS = ['Upload', 'Preview', 'Result'];
const SAMPLE = ['Jane Doe', 'jane.doe@example.com', '', 'referral', 'v1', 'Signed web form #1234', '2026-01-15T09:30:00Z', '2027-01-15'];

function downloadTemplate() {
  const csv = `${IMPORT_HEADERS.join(',')}\n${SAMPLE.join(',')}\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'candidate-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

const Stepper = ({ step }) => (
  <ol className="m-0 mb-5 flex list-none flex-wrap gap-2 p-0" aria-label="Import progress">
    {STEPS.map((label, i) => (
      <li key={label} aria-current={i === step ? 'step' : undefined}>
        <Badge tone={i === step ? 'purple' : i < step ? 'green' : 'neutral'}>{`${i + 1}. ${label}`}</Badge>
      </li>
    ))}
  </ol>
);

const Reasons = ({ errors }) =>
  errors?.length ? (
    <ul className="m-0 list-disc pl-4 text-xs text-rose-700 dark:text-rose-300">
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  ) : (
    <span className="text-xs text-slate-500 dark:text-slate-400">None</span>
  );

/** Responsive rows: a table from md up, stacked cards below. */
function Rows({ label, columns, rows }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr className="text-slate-500 dark:text-slate-400">
              {columns.map((c) => (
                <th key={c.label} scope="col" className="px-4 py-2 font-semibold">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.row} className="border-t border-slate-100 align-top dark:border-slate-800">
                {columns.map((c) => (
                  <td key={c.label} className="px-4 py-2">{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="m-0 list-none space-y-2 p-3 md:hidden" aria-label={`${label} (cards)`}>
        {rows.map((r) => (
          <li key={r.row} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            {columns.map((c) => (
              <div key={c.label} className="mb-1 text-xs">
                <span className="font-semibold text-slate-500 dark:text-slate-400">{c.label}: </span>
                {c.render(r)}
              </div>
            ))}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function CandidateImportPage() {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [expired, setExpired] = useState(false);
  const [preview, setPreview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState(null);

  const pick = (e) => {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    if (f && !/\.csv$/i.test(f.name)) {
      setFile(null);
      setFileError('Choose a .csv file.');
      return;
    }
    if (f && f.size > IMPORT_MAX_BYTES) {
      setFile(null);
      setFileError('The file is larger than 1 MB.');
      return;
    }
    setFileError('');
    setFile(f);
  };
  const restart = () => {
    setStep(0);
    setFile(null);
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setExpired(false);
    setError(null);
    setFileError('');
  };
  const fail = (e) => {
    if (e?.status === 410) {
      setExpired(true);
      return;
    }
    setError(e);
    toast(e?.message || 'The request failed', 'error');
  };
  const upload = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      setPreview(await api(paths.importPreview, { method: 'POST', body }));
      setConfirmed(false);
      setExpired(false);
      setStep(1);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const commit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api(paths.importCommit(preview.uuid), { method: 'POST', body: { confirmed: true } });
      setResult(r);
      setStep(2);
      toast(`${r.rows.filter((x) => x.status === 'imported').length} candidate(s) imported`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const bad = preview?.rows.filter((r) => r.errors?.length).length ?? 0;
  const good = (preview?.rows.length ?? 0) - bad;
  const imported = result?.rows.filter((r) => r.status === 'imported').length ?? 0;
  const skipped = (result?.rows.length ?? 0) - imported;
  const forbidden = error?.status === 403;

  return (
    <Page permission="recruitment.manage" title="Import candidates" description="Upload a CSV, review it, then confirm." action={<Link className="text-xs font-medium underline" to="/recruitment/candidates">Back to candidates</Link>}>
      <Stepper step={step} />
      {forbidden && <ErrorState error={error} />}
      {!forbidden && error && <Banner tone="error" title="Something went wrong">{error.message}</Banner>}
      {expired && (
        <Banner tone="warn" title="This preview has expired" action={<Button variant="secondary" onClick={restart}>Upload again</Button>}>
          Previews are kept for 24 hours and nothing was imported. Upload the file again to continue.
        </Banner>
      )}
      {!forbidden && step === 0 && (
        <Card title="Upload a CSV file">
          <div className="space-y-4 px-6 pb-6 text-xs text-slate-600 dark:text-slate-300">
            <Banner tone="info" title="Consent and retention">
              Every row must carry the consent fields from the template: privacy notice version, consent reference, consent date and retention date (at most two years ahead). Imported data is kept only until that retention date.
            </Banner>
            <p className="m-0">Columns: {IMPORT_HEADERS.map((h) => `${h}${h === 'phone' ? ' (optional)' : ''}`).join(', ')}. UTF-8, up to 500 rows and 1 MB.</p>
            <Button variant="secondary" onClick={downloadTemplate}><Download size={14} aria-hidden="true" />Download CSV template</Button>
            <div>
              <label htmlFor="candidate-csv" className="mb-2 block font-semibold">CSV file</label>
              <input id="candidate-csv" type="file" accept=".csv,text/csv" onChange={pick} aria-describedby={fileError ? 'candidate-csv-error' : undefined} aria-invalid={Boolean(fileError)} className="block w-full text-xs" />
              {fileError && <p id="candidate-csv-error" role="alert" className="m-0 mt-1 text-rose-700 dark:text-rose-300">{fileError}</p>}
            </div>
            <Button disabled={!file} loading={busy} onClick={upload}>Upload and preview</Button>
          </div>
        </Card>
      )}
      {!forbidden && step === 1 && preview && (
        <Card title="Preview">
          <div className="px-6 pb-4">
            <p className="mt-0 text-xs text-slate-600 dark:text-slate-300">
              {preview.rows.length} row(s): {good} ready, {bad} with problems. Preview expires {fmtDate(preview.expires_at)}.
            </p>
            {bad > 0 && (
              <Banner tone="warn" title={`${bad} row(s) will be skipped`}>
                Rows with errors or duplicate emails are not imported. Fix them in the file and import them separately.
              </Banner>
            )}
          </div>
          <Rows
            label="Import preview"
            rows={preview.rows}
            columns={[
              { label: 'Row', render: (r) => r.row },
              { label: 'Name', render: (r) => r.name },
              { label: 'Email', render: (r) => r.email },
              { label: 'Status', render: (r) => (r.errors?.length ? <Badge tone="amber">Will be skipped</Badge> : <Badge tone="green">Ready</Badge>) },
              { label: 'Problems', render: (r) => <Reasons errors={r.errors} /> },
            ]}
          />
          <div className="space-y-4 px-6 py-5">
            <Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} label="I confirm that consent was given for every row I am importing and that the retention dates are correct." />
            <div className="flex flex-wrap gap-2">
              <Button disabled={!confirmed || good === 0} loading={busy} onClick={commit}>Import {good} candidate(s)</Button>
              <Button variant="secondary" onClick={restart}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}
      {!forbidden && step === 2 && result && (
        <Card title="Import result">
          <div className="px-6 pb-4">
            <p className="mt-0 text-sm" role="status">{imported} imported, {skipped} skipped.</p>
          </div>
          <Rows
            label="Import results"
            rows={result.rows}
            columns={[
              { label: 'Row', render: (r) => r.row },
              { label: 'Status', render: (r) => <Badge tone={r.status === 'imported' ? 'green' : 'amber'}>{r.status}</Badge> },
              { label: 'Reason', render: (r) => <Reasons errors={r.errors} /> },
              { label: 'Candidate', render: (r) => (r.candidate_uuid ? <Link className="underline" to={`/recruitment/candidates/${r.candidate_uuid}`}>Open profile</Link> : '—') },
            ]}
          />
          <div className="flex flex-wrap gap-2 px-6 py-5">
            <Link className="text-xs font-medium underline" to="/recruitment/candidates">Back to candidates</Link>
            <Button variant="secondary" onClick={restart}>Import another file</Button>
          </div>
        </Card>
      )}
    </Page>
  );
}
