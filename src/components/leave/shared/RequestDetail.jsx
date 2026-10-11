import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useResource } from '../../../lib/hooks';
import { download } from '../../../lib/api';
import {
  leavePaths,
  decideRequest,
  describeError,
  fmtDate,
  fmtDateTime,
  fmtRange,
  fmtUnits,
  personName,
  typeName,
  unwrap,
} from '../../../lib/leaveApi';
import { Button, Checkbox, EmptyState, FormError, Modal, Resource, Textarea, useToast } from '../../ui';
import { ConflictList, StatusChip } from './LeaveBadge';
import TimeStory from './TimeStory';

function DecisionDialog({ open, kind, request, onClose, onDone }) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState(false);
  const toast = useToast();
  const reject = kind === 'reject';
  const missing = reject && !comment.trim();
  async function submit(e) {
    e.preventDefault();
    setTouched(true);
    if (busy || missing) return;
    setBusy(true);
    setError(null);
    try {
      await decideRequest(request.uuid, kind, comment.trim() ? { comment: comment.trim() } : {});
      toast(reject ? 'Request rejected. The balance hold was released.' : 'Request approved.');
      setComment('');
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={reject ? 'Reject this request' : 'Approve this request'}>
      <form onSubmit={submit} noValidate>
        <FormError error={error && { message: describeError(error) }} />
        <Textarea
          label={reject ? 'Reason for rejecting (required)' : 'Comment (optional)'}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          error={touched && missing ? 'Give a reason so the employee understands.' : undefined}
        />
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={reject ? 'danger' : 'primary'} loading={busy}>
            {reject ? 'Reject request' : 'Approve request'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CancelDialog({ open, request, onClose, onDone }) {
  const dates = (request.segments || []).filter((s) => s.charged !== false && !s.cancelled).map((s) => s.date);
  const [picked, setPicked] = useState([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await decideRequest(request.uuid, 'cancel', {
        ...(picked.length && picked.length < dates.length ? { dates: picked } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      toast(picked.length && picked.length < dates.length ? 'Selected days cancelled.' : 'Request cancelled.');
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Cancel leave">
      <form onSubmit={submit} noValidate>
        <FormError error={error && { message: describeError(error) }} />
        {dates.length > 1 && (
          <fieldset className="mb-5 space-y-2 rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
            <legend className="px-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Cancel only some days (leave all unticked to cancel everything)
            </legend>
            {dates.map((d) => (
              <Checkbox
                key={d}
                label={fmtDate(d)}
                checked={picked.includes(d)}
                onChange={(e) => setPicked(e.target.checked ? [...picked, d] : picked.filter((x) => x !== d))}
              />
            ))}
          </fieldset>
        )}
        <Textarea label="Reason (needed for past days)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            Keep leave
          </Button>
          <Button type="submit" variant="danger" loading={busy}>
            Cancel leave
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="m-0 text-sm text-slate-800 wrap-anywhere dark:text-slate-100">{children}</dd>
    </div>
  );
}

function ExplainButton({ uuid }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant="secondary" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? 'Hide full charge explanation' : 'Explain this charge'}
      </Button>
      {open && <ExplainBody uuid={uuid} />}
    </div>
  );
}
function ExplainBody({ uuid }) {
  const resource = useResource(leavePaths.explainRequest(uuid));
  return (
    <div className="mt-3">
      <Resource resource={resource}>
        {(res) => {
          const d = unwrap(res);
          return (
            <div className="space-y-2 text-xs text-slate-700 dark:text-slate-200">
              {d?.sentence && <p className="m-0">{d.sentence}</p>}
              <ul className="m-0 list-disc space-y-1 pl-5">
                {(d?.segments || []).map((s) => (
                  <li key={s.date}>
                    {fmtDate(s.date)}: {s.explanation || s.why}
                  </li>
                ))}
              </ul>
            </div>
          );
        }}
      </Resource>
    </div>
  );
}

/**
 * Full request view with the audit timeline and every action the viewer is allowed (server flags can_*).
 * `perspective="manager"` adds the employee's name, a decision area and the Time Story.
 */
export default function RequestDetail({ uuid, perspective = 'employee', onChanged = () => {} }) {
  const resource = useResource(leavePaths.request(uuid));
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function withdraw(r) {
    setBusy(true);
    try {
      await decideRequest(r.uuid, 'withdraw');
      toast('Request withdrawn. Your balance hold was released.');
      resource.reload();
      onChanged();
    } catch (err) {
      toast(describeError(err), 'error');
    } finally {
      setBusy(false);
    }
  }
  const done = () => {
    setDialog(null);
    resource.reload();
    onChanged();
  };
  return (
    <Resource resource={resource}>
      {(res) => {
        const r = unwrap(res);
        if (!r) return <EmptyState title="Request not found" description="It may have been removed or is not available to you." />;
        const unit = r.unit;
        const hiddenType = r.type?.sensitive;
        return (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="m-0 text-lg font-semibold">{typeName(r.type)}</h2>
                <p className="m-0 text-xs text-slate-500 dark:text-slate-400">
                  {perspective === 'manager' && `${personName(r.employee)} · `}
                  {fmtRange(r)}
                </p>
              </div>
              <StatusChip status={r.status} />
            </div>
            <dl className="m-0 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Fact label="Requested">{fmtUnits(r.requested_units, unit)}</Fact>
              <Fact label="Charged">{fmtUnits(r.charged_units, unit)}</Fact>
              <Fact label="Balance after">{fmtUnits(r.projected_balance, unit)}</Fact>
              <Fact label="Submitted">{fmtDateTime(r.submitted_at)}</Fact>
              {r.status === 'pending' && (
                <Fact label="Waiting on">
                  {personName(r.current_approver)}
                  {r.total_steps ? ` (step ${r.current_step} of ${r.total_steps})` : ''}
                </Fact>
              )}
              {r.delegate && <Fact label="Covering for me">{personName(r.delegate)}</Fact>}
              {r.decided_at && <Fact label="Decided">{fmtDateTime(r.decided_at)}</Fact>}
              {r.confidence && <Fact label="Confidence">{r.confidence.label ?? String(r.confidence)}</Fact>}
            </dl>
            {r.reason_hidden ? (
              <p className="m-0 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                {hiddenType ? 'This is confidential leave. The type, reason and documents are private.' : 'The reason is private.'}
              </p>
            ) : (
              r.reason && <Fact label="Reason">{r.reason}</Fact>
            )}
            {r.handover_notes && <Fact label="Handover notes">{r.handover_notes}</Fact>}

            {(r.warnings || []).length > 0 && (
              <ul className="m-0 list-disc space-y-1 pl-5 text-xs text-amber-900 dark:text-amber-200" aria-label="Warnings">
                {r.warnings.map((w, i) => (
                  <li key={i}>{typeof w === 'string' ? w : w.message}</li>
                ))}
              </ul>
            )}
            <ConflictList conflicts={r.conflicts} label="Conflicts and checks" />

            {(r.segments || []).length > 0 && (
              <section aria-label="Days">
                <h3 className="m-0 mb-2 text-xs font-semibold">Day by day</h3>
                <ul className="m-0 list-none divide-y divide-slate-100 p-0 text-xs dark:divide-slate-800">
                  {r.segments.map((s, i) => (
                    <li key={s.id ?? s.date ?? i} className="flex flex-wrap justify-between gap-2 py-2">
                      <span>
                        {fmtDate(s.date)}
                        {s.explanation ? ` - ${s.explanation}` : ''}
                      </span>
                      <span className="font-medium">{fmtUnits(s.charged_units ?? s.units, unit)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {(r.explanation || []).length > 0 && (
              <ul className="m-0 list-disc space-y-1 pl-5 text-xs text-slate-700 dark:text-slate-200">
                {r.explanation.map((x, i) => (
                  <li key={i}>{typeof x === 'string' ? x : x.text || x.message}</li>
                ))}
              </ul>
            )}
            {!hiddenType || !r.reason_hidden ? <ExplainButton uuid={r.uuid} /> : null}

            {(r.documents || []).length > 0 && (
              <section aria-label="Documents">
                <h3 className="m-0 mb-2 text-xs font-semibold">Documents</h3>
                <ul className="m-0 list-none space-y-1 p-0 text-xs">
                  {r.documents.map((d) => (
                    <li key={d.uuid ?? d.id}>
                      <button
                        type="button"
                        className="p-0 text-brand-700 underline dark:text-brand-300"
                        onClick={() =>
                          download(leavePaths.document(r.uuid, d.uuid ?? d.id), d.name || 'document').catch((e) =>
                            toast(describeError(e), 'error'),
                          )
                        }
                      >
                        {d.name || d.filename || 'Document'}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(r.children || []).length > 0 && (
              <section aria-label="Modifications">
                <h3 className="m-0 mb-2 text-xs font-semibold">Modifications</h3>
                <ul className="m-0 list-none space-y-1 p-0 text-xs">
                  {r.children.map((c) => (
                    <li key={c.uuid} className="flex items-center gap-2">
                      <Link className="text-brand-700 underline dark:text-brand-300" to={`/leave/requests/${c.uuid}`}>
                        {fmtRange(c)}
                      </Link>
                      <StatusChip status={c.status} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {r.modification_of && (
              <p className="m-0 text-xs">
                Modifies{' '}
                <Link className="text-brand-700 underline dark:text-brand-300" to={`/leave/requests/${r.modification_of.uuid ?? r.modification_of}`}>
                  the original request
                </Link>
                . The original stays valid until this is approved.
              </p>
            )}

            <section aria-label="History">
              <h3 className="m-0 mb-2 text-xs font-semibold">History</h3>
              {(r.history || []).length === 0 ? (
                <p className="m-0 text-xs text-slate-500 dark:text-slate-400">No activity recorded yet.</p>
              ) : (
                <ol className="m-0 list-none space-y-3 p-0">
                  {r.history.map((h, i) => (
                    <li key={h.id ?? i} className="flex gap-3 text-xs">
                      <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-brand-400" />
                      <div className="min-w-0">
                        <strong className="capitalize text-slate-800 dark:text-slate-100">
                          {String(h.action ?? h.event).replaceAll('_', ' ')}
                        </strong>
                        <span className="text-slate-500 dark:text-slate-400">
                          {' '}
                          · {personName(h.actor)} · {fmtDateTime(h.at ?? h.created_at)}
                        </span>
                        {h.comment && <p className="m-0 mt-0.5 text-slate-700 wrap-anywhere dark:text-slate-200">{h.comment}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {(r.ledger || []).length > 0 && (
              <section aria-label="Ledger postings">
                <h3 className="m-0 mb-2 text-xs font-semibold">Balance postings</h3>
                <ul className="m-0 list-none divide-y divide-slate-100 p-0 text-xs dark:divide-slate-800">
                  {r.ledger.map((l, i) => (
                    <li key={l.id ?? i} className="flex justify-between gap-2 py-2">
                      <span className="capitalize">
                        {fmtDate(l.effective_date ?? l.date)} · {String(l.kind ?? l.bucket ?? 'entry').replaceAll('_', ' ')}
                      </span>
                      <span>{fmtUnits(l.units, unit)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {perspective === 'manager' && r.employee?.uuid && (
              <details className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <summary className="cursor-pointer text-xs font-semibold">Employee time story</summary>
                <div className="mt-3">
                  <TimeStory employee={r.employee.uuid} />
                </div>
              </details>
            )}

            <div className="flex flex-wrap justify-end gap-2" role="group" aria-label="Actions">
              {r.can_withdraw && (
                <Button variant="secondary" loading={busy} onClick={() => withdraw(r)}>
                  Withdraw
                </Button>
              )}
              {r.can_modify && (
                <Link
                  to={`/leave/new?modify=${r.uuid}`}
                  className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600 hover:bg-brand-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-brand-950"
                >
                  Modify
                </Link>
              )}
              {r.can_cancel && (
                <Button variant="secondary" onClick={() => setDialog('cancel')}>
                  Cancel leave
                </Button>
              )}
              {r.can_decide && (
                <>
                  <Button variant="danger" onClick={() => setDialog('reject')}>
                    Reject
                  </Button>
                  <Button onClick={() => setDialog('approve')}>Approve</Button>
                </>
              )}
            </div>
            <DecisionDialog
              open={dialog === 'approve' || dialog === 'reject'}
              kind={dialog}
              request={r}
              onClose={() => setDialog(null)}
              onDone={done}
            />
            {dialog === 'cancel' && <CancelDialog open request={r} onClose={() => setDialog(null)} onDone={done} />}
          </div>
        );
      }}
    </Resource>
  );
}
