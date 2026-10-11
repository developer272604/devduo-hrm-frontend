import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Pagination, useToast } from '../../components/ui';
import { Banner, FormModal, KeyValues, ListCard, Page, StatusBadge, useAll } from '../../components/recruitment/kit';
import ResumesPanel from '../../components/recruitment/ResumesPanel';
import { useAuth } from '../../lib/auth';
import { clean, fmtDate, pageOf, paths, send, titleCase, useList } from '../../lib/recruitmentApi';

const isMasked = (v) => typeof v === 'string' && v.includes('*');
const Email = ({ value }) =>
  isMasked(value) ? (
    <span>
      {value}
      <span className="sr-only"> (masked: you do not have permission to see the full address)</span>
    </span>
  ) : (
    value
  );

export function CandidatesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const list = useList(`${paths.candidates}?page=${page}`);
  const [form, setForm] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [erase, setErase] = useState(null);
  const manage = can('recruitment.manage');
  const privacy = can('recruitment.privacy.manage');
  const actions = (c) => (
    <div className="flex flex-wrap items-center gap-2">
      <Link className="text-xs font-medium text-brand-700 underline dark:text-brand-300" to={`/recruitment/candidates/${c.uuid}`}>
        Profile
      </Link>
      {privacy && (
        <Button variant="secondary" onClick={() => setErase(c)}>
          Anonymize
        </Button>
      )}
    </div>
  );
  return (
    <Page permission="recruitment.view" title="Candidates" description="Candidate records with consent and retention tracking." action={manage && (
      <>
        <Link className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-brand-950" to="/recruitment/candidates/import">Import candidates</Link>
        <Button onClick={() => setForm(true)}>New candidate</Button>
      </>
    )}>
      {duplicates.length > 0 && (
        <Banner tone="warn" title="Possible duplicate candidates" action={<Button variant="secondary" onClick={() => setDuplicates([])}>Dismiss</Button>}>
          The candidate was saved, but {duplicates.length} other candidate(s) share this name. Review them; nothing was merged.
          <ul className="m-0 mt-1 list-none p-0">
            {duplicates.map((u) => (
              <li key={u}>
                <Link className="underline" to={`/recruitment/candidates/${u}`}>
                  Review candidate {u.slice(0, 8)}
                </Link>
              </li>
            ))}
          </ul>
        </Banner>
      )}
      {!manage && <Banner tone="info">Contact details are masked for your role.</Banner>}
      <ListCard
        title="Candidates"
        list={list}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email', priority: 'md', render: (c) => <Email value={c.email} /> },
          { key: 'source', label: 'Source', priority: 'md' },
          { key: 'retention_until', label: 'Retain until', priority: 'lg' },
          { key: 'actions', label: 'Actions', render: actions },
        ]}
        card={(c) => (
          <div>
            <strong className="text-sm">{c.name}</strong>
            <p className="m-0 mt-1 text-xs text-slate-500 dark:text-slate-400"><Email value={c.email} /> · {c.source}</p>
            <div className="mt-2">{actions(c)}</div>
          </div>
        )}
        empty={{ title: 'No candidates', description: manage ? 'Add a candidate to begin.' : 'Candidates you can access will appear here.' }}
      />
      <Pagination data={list.data ? pageOf(list.data) : null} onChange={setPage} />
      <FormModal
        open={form}
        onClose={() => setForm(false)}
        title="New candidate"
        intro="Consent and a retention date are mandatory. An existing email is refused rather than merged."
        initial={{ source: 'direct', privacy_notice_version: 'v1' }}
        fields={[
          { name: 'name', label: 'Full name' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'phone', label: 'Phone', required: false },
          { name: 'source', label: 'Source' },
          { name: 'privacy_notice_version', label: 'Privacy notice version' },
          { name: 'consent_reference', label: 'Consent reference', textarea: true, hint: 'Where and how consent was given' },
          { name: 'consented_at', label: 'Consent given at', type: 'datetime-local' },
          { name: 'retention_until', label: 'Retain until', type: 'date', hint: 'At most two years from today' },
        ]}
        onSubmit={async (v) => {
          const r = await send('POST', paths.candidates, { ...clean(v), consented_at: new Date(v.consented_at).toISOString() });
          setDuplicates(r?.possible_duplicates ?? []);
          list.reload();
        }}
        success="Candidate added"
      />
      <FormModal
        open={Boolean(erase)}
        onClose={() => setErase(null)}
        title={`Anonymize ${erase?.name ?? 'candidate'}?`}
        intro="Personal data is permanently removed. This is allowed after the retention date, or for an erasure request. Hired candidates cannot be anonymized."
        fields={[{ name: 'erasure_request', label: 'This is a candidate erasure request', type: 'checkbox' }]}
        submitLabel="Anonymize"
        onSubmit={async (v) => { await send('POST', paths.anonymize(erase.uuid), { erasure_request: Boolean(v.erasure_request) }); toast('Candidate anonymized'); list.reload(); }}
      />
    </Page>
  );
}

export function CandidateProfilePage() {
  const { uuid } = useParams();
  const candidates = useAll(paths.candidates);
  const apps = useAll(paths.applications);
  const candidate = candidates.rows.find((c) => c.uuid === uuid);
  const mine = apps.rows.filter((a) => a.candidate_uuid === uuid);
  const loading = candidates.loading || apps.loading;
  const error = candidates.error || apps.error;
  return (
    <Page permission="recruitment.view" title={candidate?.name ?? 'Candidate'} description="Candidate profile and applications." action={<Link className="text-xs font-medium underline" to="/recruitment/candidates">Back to candidates</Link>}>
      {!loading && !error && !candidate ? (
        <Banner tone="warn" title="Candidate not found">This candidate does not exist, is outside your hiring scope, or has been anonymized.</Banner>
      ) : (
        <>
          <Card title="Profile" className="mb-5">
            <div className="px-6 pb-5">
              {candidate ? (
                <>
                  <p className="mt-0 text-xs">
                    Email: <Email value={candidate.email} />
                  </p>
                  <KeyValues data={candidate} skip={['uuid', 'email', 'name']} />
                </>
              ) : (
                <p className="m-0 text-xs text-slate-500">{error ? 'Unavailable.' : 'Loading…'}</p>
              )}
            </div>
          </Card>
          <ResumesPanel candidateUuid={uuid} />
          <ListCard
            title="Applications"
            list={{ loading, error, reload: () => { candidates.reload(); apps.reload(); }, rows: mine }}
            columns={[
              { key: 'job_title', label: 'Role' },
              { key: 'stage', label: 'Stage', render: (a) => titleCase(a.stage) },
              { key: 'status', label: 'Status', render: (a) => <StatusBadge value={a.status} /> },
              { key: 'stage_entered_at', label: 'In stage since', priority: 'md', render: (a) => fmtDate(a.stage_entered_at) },
              { key: 'pipeline', label: '', render: (a) => <Link className="text-xs underline" to={`/recruitment/pipeline/${a.requisition_uuid}`}>Open pipeline</Link> },
            ]}
            mobile={{ title: 'job_title', badge: (a) => <StatusBadge value={a.status} />, subtitle: (a) => titleCase(a.stage) }}
            empty={{ title: 'No applications', description: 'Add this candidate to a requisition pipeline.' }}
          />
        </>
      )}
    </Page>
  );
}
