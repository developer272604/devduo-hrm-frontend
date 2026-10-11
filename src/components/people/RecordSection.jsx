import { useState } from 'react';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import {
  createRecord,
  deleteRecord,
  isChangeRequired,
  submitChangeRequest,
  updateRecord,
} from '../../lib/peopleApi';
import { api } from '../../lib/api';
import { Badge, Button, ConfirmationDialog, EmptyState, Modal, Resource, useToast } from '../ui';
import RecordForm from './RecordForm';

const EDIT_NOTE = {
  request: 'Changes to this section are sent for approval before they apply.',
  none: 'This section is read-only for you.',
};

/**
 * One list-and-edit section of the profile. The edit mode comes from the API (`viewer.edit` of the list
 * response, falling back to the profile's) so the UI never offers an action the server would refuse.
 *   direct  -> save immediately
 *   request -> submit a change request (when the section supports one)
 *   none    -> read-only
 */
export default function RecordSection({ uuid, config, mode: profileMode = 'none', title }) {
  const { can } = useAuth(),
    toast = useToast();
  const resource = useResource(`/v1/employees/${uuid}/${config.segment}`);
  const [editor, setEditor] = useState(null), // {row?}
    [removing, setRemoving] = useState(null),
    [busy, setBusy] = useState(false);
  const idOf = config.idOf || ((r) => r.uuid ?? r.id);
  const requestable = Boolean(config.requestSection);

  async function save(row, body) {
    const asRequest = async () => {
      await submitChangeRequest(uuid, {
        section: config.requestSection,
        operation: row ? 'update' : 'create',
        ...(row ? { target_id: idOf(row) } : {}),
        requested_value: body,
      });
      toast('Change request submitted for approval.');
    };
    const mode = resource.data?.viewer?.edit ?? profileMode;
    if (mode === 'request' && requestable) await asRequest();
    else {
      try {
        if (row) await updateRecord(uuid, config.segment, idOf(row), body);
        else await createRecord(uuid, config.segment, body);
        toast('Saved.');
      } catch (e) {
        if (requestable && isChangeRequired(e)) await asRequest();
        else throw e;
      }
    }
    setEditor(null);
    resource.reload();
  }
  async function remove() {
    setBusy(true);
    const mode = resource.data?.viewer?.edit ?? profileMode;
    try {
      if (mode === 'request' && requestable) {
        await submitChangeRequest(uuid, { section: config.requestSection, operation: 'delete', target_id: idOf(removing) });
        toast('Removal request submitted for approval.');
      } else {
        await deleteRecord(uuid, config.segment, idOf(removing));
        toast('Removed.');
      }
      setRemoving(null);
      resource.reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  async function verify(row, status) {
    try {
      await api(`/v1/employees/${uuid}/${config.segment}/${idOf(row)}/verify`, { method: 'POST', body: { status } });
      toast(`Marked ${status}.`);
      resource.reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <Resource resource={resource}>
      {(data) => {
        const mode = data.viewer?.edit ?? profileMode;
        const writable = mode === 'direct' || (mode === 'request' && requestable);
        const rows = data.data || [];
        return (
          <section aria-label={title || config.title} className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-sm">{title || config.title}</h2>
                {config.summary?.(data) && (
                  <p className="m-0 text-xs text-slate-500 dark:text-slate-400">{config.summary(data)}</p>
                )}
                {EDIT_NOTE[mode] && (!writable || mode === 'request') && (
                  <p className="m-0 text-xs text-slate-500 dark:text-slate-400">{EDIT_NOTE[mode]}</p>
                )}
              </div>
              {writable && (
                <Button variant="secondary" onClick={() => setEditor({})}>
                  <Plus size={16} /> {mode === 'request' ? 'Request to add' : 'Add'} {config.noun}
                </Button>
              )}
            </div>
            {rows.length === 0 ? (
              <EmptyState title={`No ${config.title.toLowerCase()} yet`} description="Nothing has been recorded here." />
            ) : (
              <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800">
                {rows.map((row) => (
                  <li key={idOf(row)} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <strong className="block wrap-break-word text-sm">{config.heading(row)}</strong>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{config.detail(row)}</span>
                      {row.verification?.status && row.verification.status !== 'unverified' && (
                        <span className="ml-2">
                          <Badge tone={row.verification.status === 'verified' ? 'green' : 'amber'}>
                            {row.verification.status}
                          </Badge>
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {config.verifiable && can('people.documents.verify') && !row.is_self && (
                        <Button variant="ghost" aria-label={`Verify ${config.heading(row)}`} onClick={() => verify(row, 'verified')}>
                          <ShieldCheck size={16} />
                        </Button>
                      )}
                      {writable && (
                        <>
                          <Button variant="ghost" aria-label={`Edit ${config.heading(row)}`} onClick={() => setEditor({ row })}>
                            <Pencil size={16} />
                          </Button>
                          <Button variant="ghost" aria-label={`Remove ${config.heading(row)}`} onClick={() => setRemoving(row)}>
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
              title={`${editor?.row ? 'Edit' : mode === 'request' ? 'Request to add' : 'Add'} ${config.noun}`}
            >
              {editor && (
                <RecordForm
                  fields={config.fields}
                  initial={editor.row ? { ...editor.row, skill_id: editor.row.skill?.id } : {}}
                  editing={Boolean(editor.row)}
                  onSubmit={(body) => save(editor.row, body)}
                  onCancel={() => setEditor(null)}
                  submitLabel={mode === 'request' ? 'Submit for approval' : 'Save'}
                />
              )}
            </Modal>
            <ConfirmationDialog
              open={Boolean(removing)}
              onClose={() => setRemoving(null)}
              onConfirm={remove}
              loading={busy}
              title={`${mode === 'request' ? 'Request removal of' : 'Remove'} this ${config.noun}?`}
            />
          </section>
        );
      }}
    </Resource>
  );
}
