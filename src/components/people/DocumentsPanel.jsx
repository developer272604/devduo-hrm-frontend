import { useRef, useState } from 'react';
import { Download, FilePlus2, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { useResource } from '../../lib/hooks';
import { downloadDocument, fieldErrors, label, uploadDocument } from '../../lib/peopleApi';
import { Badge, Button, ConfirmationDialog, EmptyState, FormError, Input, Modal, Resource, Select, useToast } from '../ui';
import { useOptions } from './lookups';

const TONES = { verified: 'green', pending: 'amber', rejected: 'amber' };
const MAX_BYTES = 10 * 1024 * 1024;

function UploadForm({ uuid, target, onDone, onCancel }) {
  const types = useOptions('/v1/people/document-types', {
    map: (t) => ({ value: t.code, label: t.name }),
  });
  const file = useRef(null);
  const [fields, setFields] = useState({ document_type: '', title: '', issue_date: '', expiry_date: '', reference_number: '' }),
    [errors, setErrors] = useState({}),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  const set = (k) => (e) => setFields((f) => ({ ...f, [k]: e.target.value }));
  async function submit(event) {
    event.preventDefault();
    const chosen = file.current?.files?.[0];
    const local = {};
    if (!chosen) local.file = 'Choose a file to upload.';
    else if (chosen.size > MAX_BYTES) local.file = 'The file is larger than 10 MB.';
    if (!target && !fields.document_type) local.document_type = 'Choose a document type.';
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    setError(null);
    try {
      await uploadDocument(uuid, target ? {} : fields, chosen, target?.uuid);
      onDone();
    } catch (e) {
      setError(e);
      setErrors(fieldErrors(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} noValidate>
      <FormError error={error} />
      {!target && (
        <>
          <Select label="Document type" required value={fields.document_type} error={errors.document_type}
            onChange={set('document_type')} options={[{ value: '', label: 'Choose…' }, ...types]} />
          <Input label="Title" value={fields.title} onChange={set('title')} />
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Input label="Issue date" type="date" value={fields.issue_date} onChange={set('issue_date')} />
            <Input label="Expiry date" type="date" value={fields.expiry_date} error={errors.expiry_date} onChange={set('expiry_date')} />
          </div>
          <Input label="Reference number" value={fields.reference_number} onChange={set('reference_number')} />
        </>
      )}
      <Input
        label={target ? 'New version file' : 'File'}
        type="file"
        ref={file}
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
        error={errors.file}
        hint="PDF, image, Word or Excel, up to 10 MB."
      />
      <div className="mt-4 flex justify-end gap-2.5">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={busy}>Upload</Button>
      </div>
    </form>
  );
}

export default function DocumentsPanel({ uuid, mode = 'none' }) {
  const { can } = useAuth(),
    toast = useToast();
  const resource = useResource(`/v1/employees/${uuid}/documents`);
  const [upload, setUpload] = useState(null), // {} new, {target} version
    [removing, setRemoving] = useState(null),
    [busy, setBusy] = useState(false);
  const act = async (fn, ok) => {
    try {
      await fn();
      toast(ok);
      resource.reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  return (
    <Resource resource={resource}>
      {(data) => {
        const docs = data.data || [];
        const canUpload = mode !== 'none';
        return (
          <section aria-label="Documents" className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="m-0 text-sm">Documents</h2>
              {canUpload && (
                <Button variant="secondary" onClick={() => setUpload({})}>
                  <Upload size={16} /> Upload document
                </Button>
              )}
            </div>
            {docs.length === 0 ? (
              <EmptyState title="No documents" description="Uploaded documents will appear here." />
            ) : (
              <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800">
                {docs.map((d) => (
                  <li key={d.uuid} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <strong className="block wrap-break-word text-sm">{d.title || d.type?.name}</strong>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {[d.type?.name, d.current_version?.original_name, d.expiry_date && `Expires ${d.expiry_date}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <span className="ml-2 inline-flex gap-1">
                        <Badge tone={TONES[d.verification_status] || 'neutral'}>{label(d.verification_status)}</Badge>
                        {d.expiry_status === 'expired' && <Badge tone="amber">Expired</Badge>}
                        {d.expiry_status === 'expiring' && <Badge tone="amber">Expiring soon</Badge>}
                        {d.current_version && <Badge>v{d.current_version.version}</Badge>}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {d.can?.download !== false && (
                        <Button variant="ghost" aria-label={`Download ${d.title || d.type?.name}`}
                          onClick={() => act(() => downloadDocument(uuid, d.uuid, d.current_version?.original_name), 'Download started.')}>
                          <Download size={16} />
                        </Button>
                      )}
                      {d.can?.edit && canUpload && (
                        <Button variant="ghost" aria-label={`Upload new version of ${d.title || d.type?.name}`} onClick={() => setUpload({ target: d })}>
                          <FilePlus2 size={16} />
                        </Button>
                      )}
                      {d.can?.verify && can('people.documents.verify') && (
                        <Button variant="ghost" aria-label={`Verify ${d.title || d.type?.name}`}
                          onClick={() => act(() => api(`/v1/employees/${uuid}/documents/${d.uuid}/verify`, { method: 'POST', body: { status: 'verified' } }), 'Document verified.')}>
                          <ShieldCheck size={16} />
                        </Button>
                      )}
                      {d.can?.delete && (
                        <Button variant="ghost" aria-label={`Delete ${d.title || d.type?.name}`} onClick={() => setRemoving(d)}>
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Modal open={Boolean(upload)} onClose={() => setUpload(null)} title={upload?.target ? 'Upload new version' : 'Upload document'}>
              {upload && (
                <UploadForm uuid={uuid} target={upload.target} onCancel={() => setUpload(null)}
                  onDone={() => { setUpload(null); toast('Document uploaded.'); resource.reload(); }} />
              )}
            </Modal>
            <ConfirmationDialog open={Boolean(removing)} onClose={() => setRemoving(null)} loading={busy}
              title={`Delete "${removing?.title || removing?.type?.name}"?`}
              onConfirm={async () => {
                setBusy(true);
                await act(() => api(`/v1/employees/${uuid}/documents/${removing.uuid}`, { method: 'DELETE' }), 'Document deleted.');
                setBusy(false);
                setRemoving(null);
              }} />
          </section>
        );
      }}
    </Resource>
  );
}
