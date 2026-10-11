import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button, ErrorState } from '../../components/ui';

export default function CandidatePortalPage() {
  const { workspace } = useParams();
  const base = `/v1/careers/${encodeURIComponent(workspace)}/portal`;
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [withdrawal, setWithdrawal] = useState(null);
  const [reason, setReason] = useState('');
  const [offerResponse, setOfferResponse] = useState(null);
  useEffect(() => {
    let live = true;
    setStatus(null); setError(null); setCode(''); setMessage('');
    api(base, { sessionEvents: false }).then((r) => live && setStatus(r)).catch((e) => { if (live && e.status !== 401) setError(e); });
    return () => { live = false; };
  }, [base]);
  async function act(action) {
    setBusy(true); setError(null);
    try { await action(); } catch (e) { setError(e); } finally { setBusy(false); }
  }
  const inputClass = 'block w-full rounded border border-slate-300 bg-white p-2 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white';
  return <main className="mx-auto max-w-2xl space-y-5 p-6">
    <h1>Candidate application status</h1>
    <Link className="text-brand-700 underline" to={`/careers/${encodeURIComponent(workspace)}`}>Browse jobs</Link>
    {error && <ErrorState error={error} />}
    {message && <p role="status">{message}</p>}
    {status ? <section className="space-y-4">
      <h2>Hello, {status.name}</h2>
      {(status.offers ?? []).map((offer) => <article key={offer.uuid} className="space-y-3 rounded border border-brand-300 p-4">
        <h3>Offer: {offer.job_title}</h3><p>Version {offer.release_version} · {offer.status}</p>
        <p className="whitespace-pre-wrap">{offer.content}</p>
        {offer.can_respond && <div className="flex gap-2"><Button disabled={busy} onClick={() => setOfferResponse({ offer, decision: 'accepted' })}>Accept offer</Button><Button disabled={busy} variant="secondary" onClick={() => setOfferResponse({ offer, decision: 'declined' })}>Decline offer</Button></div>}
      </article>)}
      {offerResponse && <section className="space-y-3 rounded border border-brand-300 p-4">
        <p>Confirm that you have reviewed version {offerResponse.offer.release_version} and want to {offerResponse.decision === 'accepted' ? 'accept' : 'decline'} this offer. This response is recorded and cannot be changed here.</p>
        <Button disabled={busy} onClick={() => act(async () => {
          await api(`${base}/offers/${offerResponse.offer.uuid}/respond`, { method: 'POST', sessionEvents: false, body: { confirmed: true, decision: offerResponse.decision, release_uuid: offerResponse.offer.release_uuid } });
          setOfferResponse(null); setStatus(await api(base, { sessionEvents: false })); setMessage('Offer response recorded.');
        })}>Confirm offer response</Button><Button disabled={busy} variant="secondary" onClick={() => setOfferResponse(null)}>Cancel response</Button>
      </section>}
      {status.applications.length === 0 ? <p>No applications available to show.</p> : <ul className="space-y-3">{status.applications.map((a, i) => <li className="rounded border border-slate-200 p-4 dark:border-slate-700" key={a.uuid ?? i}><strong>{a.job_title}</strong><p>{a.status}</p>{a.can_withdraw && <Button disabled={busy} variant="secondary" onClick={() => { setWithdrawal(a); setReason(''); }}>Withdraw application for {a.job_title}</Button>}</li>)}</ul>}
      {withdrawal && <form className="space-y-3 rounded border border-rose-300 p-4" onSubmit={(e) => { e.preventDefault(); act(async () => {
        await api(`${base}/applications/${withdrawal.uuid}/withdraw`, { method: 'POST', sessionEvents: false, body: { confirmed: true, reason } });
        setWithdrawal(null); setReason(''); setStatus(await api(base, { sessionEvents: false })); setMessage('Application withdrawn.');
      }); }}>
        <h3>Withdraw from {withdrawal.job_title}?</h3>
        <p>This closes your application and cancels its pending offers and interviews. This action cannot be undone here.</p>
        <label className="block">Withdrawal reason<textarea className={inputClass} required maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <Button disabled={busy} type="submit">Confirm withdrawal</Button>
        <Button disabled={busy} variant="secondary" onClick={() => setWithdrawal(null)}>Keep application</Button>
      </form>}
      <Button disabled={busy} onClick={() => act(async () => { await api(`${base}/logout`, { method: 'POST', sessionEvents: false }); setStatus(null); setCode(''); setMessage('Signed out of candidate access.'); })}>Sign out</Button>
    </section> : <section className="space-y-5">
      <p>Use the email on your candidate record. Newly submitted applications become available after recruiter review. A verification code is valid for 15 minutes in this browser.</p>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(async () => { const r = await api(`${base}/code`, { method: 'POST', body: { email }, sessionEvents: false }); setMessage(r.message); setCode(''); }); }}>
        <label className="block">Email<input type="email" required maxLength={254} autoComplete="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <Button type="submit" disabled={busy}>Email verification code</Button>
      </form>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(async () => { await api(`${base}/verify`, { method: 'POST', body: { email, code: code.trim() }, sessionEvents: false }); setCode(''); setMessage(''); setStatus(await api(base, { sessionEvents: false })); }); }}>
        <label className="block">Verification code<input required minLength={64} maxLength={64} autoComplete="one-time-code" className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} /></label>
        <Button type="submit" disabled={busy || !email}>Verify and view applications</Button>
      </form>
    </section>}
  </main>;
}
