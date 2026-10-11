import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { GENDERS, isChangeRequired, label, savePersonal, submitChangeRequest } from '../../lib/peopleApi';
import { Button, Modal, useToast } from '../ui';
import RecordForm from './RecordForm';

const FIELDS = [
  { key: 'preferred_name', label: 'Preferred name', type: 'text' },
  { key: 'pronouns', label: 'Pronouns', type: 'text' },
  { key: 'gender', label: 'Gender', type: 'select', options: GENDERS.map((v) => ({ value: v, label: label(v) })) },
  { key: 'date_of_birth', label: 'Date of birth', type: 'date' },
  { key: 'marital_status', label: 'Marital status', type: 'text' },
  { key: 'nationality', label: 'Nationality (2 letters)', type: 'text', maxLength: 2 },
  { key: 'blood_group', label: 'Blood group', type: 'text' },
  { key: 'personal_email', label: 'Personal email', type: 'email' },
  { key: 'personal_phone', label: 'Personal phone', type: 'text' },
  { key: 'preferred_language', label: 'Preferred language', type: 'text' },
];

/** Read the personal data the API returned (hidden fields are absent) and edit it per `viewer.edit.personal`. */
export default function PersonalPanel({ uuid, person, mode, onSaved }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const shown = FIELDS.filter((f) => f.key in person);
  const readOnly = ['legal_name', 'legal_first_name', 'legal_middle_name', 'legal_last_name', 'display_name'].filter((k) => person[k]);
  const writable = mode === 'direct' || mode === 'request';
  async function save(body) {
    const changed = Object.fromEntries(
      Object.entries(body).filter(([k, v]) => (v ?? '') !== (person[k] ?? '') && !(typeof person[k] === 'string' && person[k].includes('••'))),
    );
    if (!Object.keys(changed).length) {
      const error = new Error('No changes were made.');
      error.errors = {};
      throw error;
    }
    const request = async () => {
      await submitChangeRequest(uuid, { section: 'personal', operation: 'update', requested_value: changed });
      toast('Change request submitted for approval.');
    };
    if (mode === 'request') await request();
    else {
      try {
        await savePersonal(uuid, changed);
        toast('Personal details saved.');
      } catch (e) {
        if (isChangeRequired(e)) await request();
        else throw e;
      }
    }
    setOpen(false);
    onSaved();
  }
  return (
    <section aria-label="Personal details" className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-sm">Personal details</h2>
          {mode === 'request' && <p className="m-0 text-xs text-slate-500 dark:text-slate-400">Changes are sent for approval.</p>}
          {mode === 'none' && <p className="m-0 text-xs text-slate-500 dark:text-slate-400">This section is read-only for you.</p>}
        </div>
        {writable && (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <Pencil size={16} /> {mode === 'request' ? 'Request change' : 'Edit'}
          </Button>
        )}
      </div>
      <dl className="m-0 grid gap-5 sm:grid-cols-2">
        {[...readOnly.map((k) => ({ key: k, label: label(k) })), ...shown].map((f) => (
          <div key={f.key}>
            <dt className="text-xs text-slate-500 dark:text-slate-400">{f.label}</dt>
            <dd className="m-0 mt-1 wrap-break-word text-sm font-medium">{person[f.key] || '—'}</dd>
          </div>
        ))}
      </dl>
      <Modal open={open} onClose={() => setOpen(false)} title={mode === 'request' ? 'Request a change' : 'Edit personal details'}>
        {open && (
          <RecordForm
            fields={shown}
            initial={person}
            editing
            onSubmit={save}
            onCancel={() => setOpen(false)}
            submitLabel={mode === 'request' ? 'Submit for approval' : 'Save'}
          />
        )}
      </Modal>
    </section>
  );
}
