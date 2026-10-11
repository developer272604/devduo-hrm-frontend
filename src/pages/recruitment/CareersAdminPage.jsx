import { useState } from 'react';
import { Button, Pagination } from '../../components/ui';
import { Page, ListCard, FormModal, useAll, optionsOf, Banner } from '../../components/recruitment/kit';
import { paths, send, useList } from '../../lib/recruitmentApi';

export default function CareersAdminPage() {
  const postings = useAll(paths.postings);
  const [page, setPage] = useState(1);
  const list = useList(`/v1/recruitment/submissions?page=${page}`);
  const [configure, setConfigure] = useState(false);
  const [review, setReview] = useState(null);
  const [link, setLink] = useState('');
  return <Page permission="recruitment.manage" title="Public careers" description="Control public posting visibility and review incoming applications." action={<Button onClick={() => setConfigure(true)}>Configure public posting</Button>}>
    <Banner tone="info">Only explicitly enabled external postings appear publicly. Review identity and consent before accepting a submission. Duplicate candidates require separate review; they are never merged automatically.</Banner>
    {link && <a className="text-brand-700 underline" href={link} target="_blank" rel="noreferrer">Open careers page</a>}
    <ListCard title="Applications awaiting review" list={list} columns={[
      { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'notice_version', label: 'Notice' },
      { key: 'actions', label: 'Actions', render: (s) => <Button onClick={() => setReview(s)}>Review</Button> },
    ]} card={(s) => <div><strong>{s.name}</strong><p>{s.email}</p><Button onClick={() => setReview(s)}>Review</Button></div>} empty={{ title: 'No submissions awaiting review' }} />
    <Pagination data={list.data} onChange={setPage} />
    <FormModal open={configure} onClose={() => setConfigure(false)} title="Public posting visibility" initial={{ public_enabled: 'yes', retention_days: '90' }} fields={[
      { name: 'posting_uuid', label: 'Posting', options: optionsOf(postings.rows, (p) => `${p.title} (${p.channel}, ${p.status})`) },
      { name: 'public_enabled', label: 'Public visibility', options: [{ value: 'yes', label: 'Enable' }, { value: 'no', label: 'Disable' }] },
      { name: 'privacy_notice', label: 'Approved recruitment privacy notice', textarea: true, required: false },
      { name: 'notice_version', label: 'Notice version', required: false },
      { name: 'retention_days', label: 'Retention days', type: 'number', required: false },
    ]} intro="Enabling requires an approved notice, version and retention period appropriate for your jurisdiction. The suggested period is editable and is not legal advice." onSubmit={async (v) => {
      const body = v.public_enabled === 'yes' ? { public_enabled: true, privacy_notice: v.privacy_notice, notice_version: v.notice_version, retention_days: Number(v.retention_days) } : { public_enabled: false };
      const result = await send('PUT', `/v1/recruitment/postings/${v.posting_uuid}/public`, body); setLink(result.careers_path); postings.reload();
    }} success="Public visibility updated" />
    <FormModal open={Boolean(review)} onClose={() => setReview(null)} title={`Review ${review?.name ?? 'submission'}`} intro={`${review?.email ?? ''} ${review?.phone ?? ''}. Consent recorded: ${review?.consented_at ?? ''}. Notice ${review?.notice_version ?? ''}: ${review?.privacy_notice ?? ''}`} initial={{ decision: 'reject', identity_reviewed: false }} fields={[
      { name: 'decision', label: 'Decision', options: [{ value: 'reject', label: 'Reject and remove submitted details' }, { value: 'accept', label: 'Create candidate and application' }] },
      { name: 'identity_reviewed', label: 'I have reviewed identity and consent', type: 'checkbox', required: false },
    ]} onSubmit={async (v) => { await send('POST', `/v1/recruitment/submissions/${review.uuid}/review`, { decision: v.decision, identity_reviewed: Boolean(v.identity_reviewed) }); list.reload(); }} success="Submission reviewed" />
  </Page>;
}
