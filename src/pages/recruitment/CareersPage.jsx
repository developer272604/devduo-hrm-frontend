import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button, ErrorState, Skeleton } from '../../components/ui';

export default function CareersPage() {
  const { workspace } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let live = true;
    setData(null); setError(null); setSelected(null); setMessage('');
    api(`/v1/careers/${encodeURIComponent(workspace)}/jobs?q=${encodeURIComponent(search)}&page=${page}`)
      .then((r) => live && setData(r)).catch((e) => live && setError(e));
    return () => { live = false; };
  }, [workspace, search, page]);
  async function apply(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true); setError(null);
    try {
      const result = await api(`/v1/careers/${encodeURIComponent(workspace)}/jobs/${selected.uuid}/apply`, { method: 'POST', body: { name: fields.get('name'), email: fields.get('email'), phone: fields.get('phone') || null, consent: fields.get('consent') === 'on', notice_version: selected.notice_version } });
      setMessage(result.message); setSelected(null);
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  const inputClass = 'block w-full rounded border border-slate-300 bg-white p-2 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white';
  return <main className="mx-auto max-w-3xl space-y-6 p-6">
    <h1>{data?.company ? `${data.company} careers` : 'Careers'}</h1>
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(query); }}>
      <label className="grow">Search jobs<input className={inputClass} value={query} maxLength={100} onChange={(e) => setQuery(e.target.value)} /></label>
      <Button type="submit">Search</Button>
    </form>
    {error && <ErrorState error={error} />}
    {!data && !error && <Skeleton />}
    {message && <p role="status">{message}</p>}
    {data?.jobs.data.length === 0 && <p>No open jobs at the moment.</p>}
    {data?.jobs.data.map((job) => <article key={job.uuid} className="space-y-3 rounded-xl border border-slate-200 p-5 dark:border-slate-700">
      <h2>{job.title}</h2><p>{job.location_text}</p><p className="whitespace-pre-wrap">{job.description}</p>
      <Button onClick={() => { setSelected(job); setMessage(''); setError(null); }}>Apply for {job.title}</Button>
    </article>)}
    {data && <div className="flex gap-2"><Button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page} of {data.jobs.last_page}</span><Button disabled={page >= data.jobs.last_page} onClick={() => setPage(page + 1)}>Next</Button></div>}
    {selected && <form onSubmit={apply} className="space-y-4 rounded-xl border border-brand-300 p-5">
      <h2>Apply for {selected.title}</h2>
      <label className="block">Full name<input className={inputClass} name="name" required maxLength={160} autoComplete="name" /></label>
      <label className="block">Email<input className={inputClass} name="email" type="email" required maxLength={254} autoComplete="email" /></label>
      <label className="block">Phone (optional)<input className={inputClass} name="phone" maxLength={40} autoComplete="tel" /></label>
      <p className="whitespace-pre-wrap">{selected.privacy_notice}</p>
      <label className="block"><input type="checkbox" name="consent" required /> I have read and agree to this recruitment privacy notice ({selected.notice_version}).</label>
      <p>Submission is subject to recruiter review. This form does not create a candidate account.</p>
      <Button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</Button>
      <Button variant="secondary" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button>
    </form>}
  </main>;
}
