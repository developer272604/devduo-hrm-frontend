import { useState } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, FormError, Input, Skeleton, useToast } from '../ui';
import { Banner, ConfirmDialog } from './kit';
import { useAuth } from '../../lib/auth';
import { download } from '../../lib/api';
import { fmtDate, fmtSize, paths, resumeError, send, useAction, useList } from '../../lib/recruitmentApi';

/** Private resume versions for one candidate. Read needs recruitment.view; upload/remove need recruitment.manage. */
export default function ResumesPanel({ candidateUuid }) {
  const { can } = useAuth();
  const toast = useToast();
  const list = useList(paths.resumes(candidateUuid));
  const manage = can('recruitment.manage');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [inputKey, setInputKey] = useState(0);
  const [removing, setRemoving] = useState(null);
  const up = useAction();

  async function upload(e) {
    e.preventDefault();
    const problem = resumeError(file);
    setFileError(problem);
    if (problem) return;
    const body = new FormData();
    body.append('file', file);
    const ok = await up.run(() => send('POST', paths.resumes(candidateUuid), body));
    if (ok) {
      toast('Resume uploaded');
      setFile(null);
      setInputKey((k) => k + 1);
      list.reload();
    }
  }
  async function get(r) {
    try {
      await download(paths.resumeDownload(candidateUuid, r.version), r.original_name || `resume-v${r.version}`);
      toast('Download started');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <Card title="Resumes" className="mb-5">
      <div className="px-6 pb-5">
        <p className="mt-0 text-xs text-slate-500 dark:text-slate-400">
          Resumes are stored privately, never get a public link, and every download is audited. Each upload becomes a new version; earlier versions are kept until removed.
        </p>
        {manage && (
          <form onSubmit={upload} noValidate aria-label="Upload resume" className="mb-4">
            <FormError error={up.error} />
            <Input
              key={inputKey}
              label="Resume file"
              type="file"
              accept=".pdf,.doc,.docx"
              hint="PDF, DOC or DOCX, up to 5 MB."
              error={fileError}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setFileError('');
              }}
            />
            <Button type="submit" loading={up.busy}>
              <Upload size={16} /> Upload resume
            </Button>
          </form>
        )}
        {!manage && <Banner tone="info">You can view and download resumes. Uploading and removing needs the recruitment manage permission.</Banner>}
      </div>
      {list.loading ? (
        <Skeleton rows={2} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.rows.length === 0 ? (
        <EmptyState title="No resumes" description={manage ? 'Upload a resume to start the version history.' : 'No resume has been uploaded for this candidate.'} />
      ) : (
        <ul className="m-0 list-none divide-y divide-slate-100 p-0 px-6 pb-4 dark:divide-slate-800" aria-label="Resume versions">
          {list.rows.map((r) => (
            <li key={r.version} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <strong className="block wrap-break-word text-sm">{r.available ? r.original_name : 'File removed'}</strong>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Uploaded {fmtDate(r.uploaded_at)} · {fmtSize(r.size)}
                </span>{' '}
                <Badge>v{r.version}</Badge>
              </div>
              {r.available && (
                <div className="flex gap-1">
                  <Button variant="ghost" aria-label={`Download resume version ${r.version}`} onClick={() => get(r)}>
                    <Download size={16} />
                  </Button>
                  {manage && (
                    <Button variant="ghost" aria-label={`Remove resume version ${r.version}`} onClick={() => setRemoving(r)}>
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={`Remove resume version ${removing?.version ?? ''}?`}
        intro="The stored file is deleted permanently. A metadata record stays for the audit trail."
        confirmLabel="Remove resume"
        danger
        onConfirm={async () => {
          await send('DELETE', paths.resume(candidateUuid, removing.version));
          toast('Resume removed');
          list.reload();
        }}
      />
    </Card>
  );
}
