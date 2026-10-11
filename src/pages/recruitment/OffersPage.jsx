import { useState } from 'react';
import { Button, Pagination, useToast } from '../../components/ui';
import { EmployeePicker } from '../../components/people/lookups';
import { Banner, ConfirmDialog, FormModal, ListCard, Page, StatusBadge, optionsOf, useAll, useOrg } from '../../components/recruitment/kit';
import OfferDocumentsModal from '../../components/recruitment/OfferDocumentsModal';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { clean, pageOf, paths, send, titleCase, today, useList } from '../../lib/recruitmentApi';

const VERBS = {
  submit: ['Submit for approval', 'The offer goes to an approver other than you.'],
  approve: ['Approve', 'You are approving this offer.'],
  send: ['Send to candidate', 'The offer is marked as sent.'],
  accept: ['Record acceptance', 'Record that the candidate accepted.'],
  decline: ['Record decline', 'Record that the candidate declined.'],
  withdraw: ['Withdraw', 'The offer is withdrawn and cannot be revived.'],
};
const DONE = { submit: 'Offer submitted', approve: 'Offer approved', reject: 'Offer rejected', send: 'Offer sent', accept: 'Acceptance recorded', decline: 'Decline recorded', withdraw: 'Offer withdrawn' };

export default function OffersPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const list = useList(`${paths.offers}?page=${page}`);
  const apps = useAll(paths.applications);
  const [create, setCreate] = useState(null);
  const [act, setAct] = useState(null);
  const [reject, setReject] = useState(null);
  const [handover, setHandover] = useState(null);
  const [dup, setDup] = useState(null);
  const [docs, setDocs] = useState(null);
  const [release, setRelease] = useState(null);
  const manage = can('recruitment.offer.manage');
  const approve = can('recruitment.offer.approve');
  const departments = useOrg('departments');
  const designations = useOrg('designations');
  const types = useOrg('employee-types');
  const locations = useOrg('locations');

  const actions = (o) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="secondary" aria-label={`Documents for ${o.candidate_name}`} onClick={() => setDocs(o)}>Documents</Button>
      {approve && o.status === 'sent' && <Button variant="secondary" onClick={() => setRelease(o)}>Release candidate terms</Button>}
      {manage && o.status === 'draft' && <Button variant="secondary" onClick={() => setAct({ row: o, verb: 'submit' })}>Submit</Button>}
      {approve && o.status === 'pending_approval' && (
        <>
          <Button variant="secondary" disabled={!o.can_review} onClick={() => setAct({ row: o, verb: 'approve' })}>Approve</Button>
          <Button variant="secondary" disabled={!o.can_review} onClick={() => setReject(o)}>Reject</Button>
          {!o.can_review && <span className="text-[11px] text-slate-500 dark:text-slate-400">Another approver is needed</span>}
        </>
      )}
      {manage && o.status === 'approved' && <Button variant="secondary" onClick={() => setAct({ row: o, verb: 'send' })}>Send</Button>}
      {manage && o.status === 'sent' && (
        <>
          <Button variant="secondary" onClick={() => setAct({ row: o, verb: 'accept' })}>Accepted</Button>
          <Button variant="secondary" onClick={() => setAct({ row: o, verb: 'decline' })}>Declined</Button>
        </>
      )}
      {can('recruitment.handover') && o.status === 'accepted' && <Button onClick={() => setHandover(o)}>Hand over to employee</Button>}
      {manage && ['draft', 'pending_approval', 'approved', 'sent'].includes(o.status) && <Button variant="secondary" onClick={() => setAct({ row: o, verb: 'withdraw' })}>Withdraw</Button>}
      {manage && ['draft', 'rejected', 'declined', 'withdrawn', 'expired'].includes(o.status) && (
        <Button variant="secondary" onClick={() => setCreate({ application_uuid: o.application_uuid, job_title: o.job_title, start_date: o.start_date, currency: o.currency ?? '' })}>New version</Button>
      )}
    </div>
  );

  async function doHandover(values, confirm) {
    const a = values.assignment;
    const body = clean({
      employee_number: values.employee_number, work_email: values.work_email, worker_type: values.worker_type,
      ...(values.handover_mode === 'rehire' ? { previous_employee_uuid: values.previous_employee_uuid, rehire_identity_confirmed: values.rehire_identity_confirmed, override_reason: values.override_reason } : {}),
      assignment: clean({ department_id: Number(a.department_id), designation_id: Number(a.designation_id), employee_type_id: Number(a.employee_type_id), location_id: Number(a.location_id) }),
      ...(confirm ? { confirm_duplicates: true } : {}),
    });
    return api(paths.offer(handover.uuid, 'handover'), { method: 'POST', body });
  }

  return (
    <Page permission="recruitment.offer.manage|recruitment.offer.approve" title="Offers" description="Create, approve (by someone other than the maker), send and hand over offers." action={manage && <Button onClick={() => setCreate({ currency: '', start_date: today() })}>New offer</Button>}>
      <Banner tone="info">Offers hold a compensation reference only, never salary figures.</Banner>
      <ListCard
        title="Offers"
        list={list}
        columns={[
          { key: 'candidate_name', label: 'Candidate' },
          { key: 'job_title', label: 'Role', priority: 'md' },
          { key: 'version', label: 'Version', priority: 'md', render: (o) => `v${o.version}` },
          { key: 'start_date', label: 'Start', priority: 'md' },
          { key: 'status', label: 'Status', render: (o) => <StatusBadge value={o.status} /> },
          { key: 'actions', label: 'Actions', render: actions },
        ]}
        card={(o) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <strong className="text-sm">{o.candidate_name}</strong>
              <StatusBadge value={o.status} />
            </div>
            <p className="m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">{o.job_title} · v{o.version} · starts {o.start_date}</p>
            <div className="mt-2">{actions(o)}</div>
          </div>
        )}
        empty={{ title: 'No offers', description: 'Offers are created for candidates at the offer stage.' }}
      />
      <Pagination data={list.data ? pageOf(list.data) : null} onChange={setPage} />

      <FormModal
        open={Boolean(create)}
        onClose={() => setCreate(null)}
        title="Offer"
        intro="A new version supersedes any open version for the same application."
        initial={create ?? {}}
        fields={[
          { name: 'application_uuid', label: 'Application (offer stage)', options: optionsOf(apps.rows.filter((a) => a.status === 'active' && a.stage === 'offer'), (a) => `${a.candidate_name}: ${a.job_title}`) },
          { name: 'job_title', label: 'Job title' },
          { name: 'start_date', label: 'Start date', type: 'date' },
          { name: 'expires_on', label: 'Offer expires on', type: 'date', required: false },
          { name: 'compensation_reference', label: 'Compensation reference', required: false, hint: 'A reference or structure name, not an amount' },
          { name: 'currency', label: 'Currency (3 letters)', required: false },
          { name: 'notes', label: 'Notes', textarea: true, required: false },
        ]}
        onSubmit={async (v) => { await send('POST', paths.offers, clean(v)); list.reload(); }}
        success="Offer saved"
      />
      <ConfirmDialog
        open={Boolean(act)}
        onClose={() => setAct(null)}
        title={`${VERBS[act?.verb]?.[0] ?? ''}?`}
        intro={`${act?.row.candidate_name}, ${act?.row.job_title} (v${act?.row.version}). ${VERBS[act?.verb]?.[1] ?? ''}`}
        confirmLabel={VERBS[act?.verb]?.[0]}
        danger={act?.verb === 'withdraw'}
        onConfirm={async () => { await send('POST', paths.offer(act.row.uuid, act.verb)); toast(DONE[act.verb]); list.reload(); }}
      />
      <FormModal
        open={Boolean(reject)}
        onClose={() => setReject(null)}
        title={`Reject offer for ${reject?.candidate_name ?? ''}`}
        fields={[{ name: 'note', label: 'Reason for rejecting', textarea: true }]}
        submitLabel="Reject offer"
        onSubmit={async (v) => { await send('POST', paths.offer(reject.uuid, 'reject'), { note: v.note }); list.reload(); }}
        success="Offer rejected"
      />
      <FormModal
        open={Boolean(handover)}
        onClose={() => setHandover(null)}
        title={`Hand over ${handover?.candidate_name ?? ''} to People`}
        intro="Create a new employment from the accepted offer. For a returning employee, select their most recent former employment to preserve the person record and history."
        initial={{ assignment: {}, worker_type: 'employee', handover_mode: 'new' }}
        submitLabel="Create employee"
        fields={[
          ...(can('people.rehire') && can('people.view') ? [{ name: 'handover_mode', label: 'Handover type', options: [{ value: 'new', label: 'New person' }, { value: 'rehire', label: 'Returning employee' }] }] : []),
          { name: 'employee_number', label: 'Employee number', required: false },
          { name: 'work_email', label: 'Work email', type: 'email', required: false },
          { name: 'worker_type', label: 'Worker type', options: ['employee', 'contractor', 'intern'].map((t) => ({ value: t, label: titleCase(t) })) },
        ]}
        extra={(v, set) => {
          const a = v.assignment ?? {};
          const pick = (name, label, options) => (
            <div key={name} className="mb-5">
              <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor={`ho-${name}`}>{label}</label>
              <select
                id={`ho-${name}`}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                value={a[name] ?? ''}
                onChange={(e) => set('assignment', { ...a, [name]: e.target.value })}
              >
                <option value="">Select…</option>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          );
          return [
            ...(v.handover_mode === 'rehire' ? [
              <EmployeePicker key="previous" label="Former employee" required value={v.previous_employee_uuid} onChange={(uuid) => set('previous_employee_uuid', uuid)} />,
              <label key="identity" className="my-3 flex gap-2 text-sm"><input type="checkbox" required checked={Boolean(v.rehire_identity_confirmed)} onChange={(e) => set('rehire_identity_confirmed', e.target.checked)} />I verified that this candidate and the selected former employee are the same person.</label>,
              <label key="override" className="mb-4 block text-sm">Rehire eligibility override reason (if needed)<textarea className="mt-1 w-full rounded border p-2" maxLength={1000} value={v.override_reason || ''} onChange={(e) => set('override_reason', e.target.value)} /></label>,
            ] : []),
            pick('department_id', 'Department', departments),
            pick('designation_id', 'Designation', designations),
            pick('employee_type_id', 'Employee type', types),
            pick('location_id', 'Location', locations),
          ];
        }}
        onSubmit={async (v) => {
          try {
            await doHandover(v, false);
            toast('Employee created');
            list.reload();
          } catch (e) {
            if (e.status === 409 && e.code === 'possible_duplicate') {
              setDup({ values: v, offer: handover, duplicates: e.data?.duplicates ?? [], message: e.message });
              return;
            }
            throw e;
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(dup)}
        onClose={() => setDup(null)}
        title="Possible duplicate employee"
        intro={`${dup?.message ?? 'A matching person already exists.'}${dup?.duplicates?.length ? ` Matches: ${dup.duplicates.map((d) => [d.name ?? d.display_name ?? d.uuid, d.employee_number].filter(Boolean).join(' ')).join('; ')}.` : ''} Create the employee only if this is a different person.`}
        confirmLabel="Create anyway"
        danger
        onConfirm={async () => {
          const r = await api(paths.offer(dup.offer.uuid, 'handover'), {
            method: 'POST',
            body: clean({
              employee_number: dup.values.employee_number, work_email: dup.values.work_email, worker_type: dup.values.worker_type,
              assignment: Object.fromEntries(Object.entries(dup.values.assignment).map(([k, x]) => [k, Number(x)])),
              confirm_duplicates: true,
            }),
          });
          toast(`Employee ${r?.employee_number ?? ''} created`.trim());
          list.reload();
        }}
      />
      <OfferDocumentsModal offer={docs} onClose={() => setDocs(null)} />
      <FormModal open={Boolean(release)} onClose={() => setRelease(null)} title="Release candidate-facing offer terms" intro="An approver other than the offer creator must review and release these terms. Only this plain text appears in the candidate portal; internal snapshots are not shared. Releasing again replaces the version awaiting a response." fields={[
        { name: 'content', label: 'Candidate-facing offer terms', textarea: true },
        { name: 'confirmed', label: 'I reviewed and approve these terms for the candidate', type: 'checkbox' },
      ]} onSubmit={async (v) => { await send('POST', `/v1/recruitment/offers/${release.uuid}/candidate-release`, v); list.reload(); }} success="Candidate terms released" />
    </Page>
  );
}
