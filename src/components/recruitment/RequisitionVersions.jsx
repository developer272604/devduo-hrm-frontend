import { useCallback, useEffect, useState } from 'react';
import { Button, EmptyState, ErrorState, Modal, Skeleton } from '../ui';
import { Banner, FormModal, StatusBadge, useDo } from './kit';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { fmtDate, needsReapproval, paths, send, titleCase } from '../../lib/recruitmentApi';

const show = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));
const FIELDS = ['openings', 'budget_amount', 'budget_currency', 'department_id', 'location_id', 'target_date'];

/** Material-field amendment with a required reason. Explains up front whether re-approval is needed. */
export function AmendDialog({ req, departments = [], locations = [], onClose, onDone }) {
  const initial = {
    openings: String(req?.openings ?? ''),
    budget_amount: req?.budget_amount ?? '',
    budget_currency: req?.budget_currency ?? '',
    department_id: req?.department_id != null ? String(req.department_id) : '',
    location_id: req?.location_id != null ? String(req.location_id) : '',
    target_date: req?.target_date ?? '',
    reason: '',
  };
  const diff = (v) => {
    const out = {};
    FIELDS.forEach((k) => {
      if (String(v[k] ?? '') !== String(initial[k] ?? '') && !(v[k] === '' && ['department_id', 'location_id', 'budget_amount', 'budget_currency'].includes(k))) out[k] = v[k];
    });
    return out;
  };
  const none = (o) => [{ value: '', label: 'No change' }, ...o];
  return (
    <FormModal
      open={Boolean(req)}
      onClose={onClose}
      title={`Amend ${req?.title ?? 'requisition'} (v${req?.version ?? 1})`}
      intro="Each amendment is recorded as a new version with a before/after comparison."
      initial={initial}
      submitLabel="Submit amendment"
      fields={[
        { name: 'openings', label: 'Openings (headcount)', type: 'number' },
        { name: 'budget_amount', label: 'Budget amount', type: 'number', required: false },
        { name: 'budget_currency', label: 'Budget currency (3 letters)', required: false },
        { name: 'department_id', label: 'Department', required: false, options: none(departments) },
        { name: 'location_id', label: 'Location', required: false, options: none(locations) },
        { name: 'target_date', label: 'Target date', type: 'date' },
        { name: 'reason', label: 'Reason for the amendment', textarea: true },
      ]}
      extra={(v) => {
        const changes = diff(v);
        const changed = Object.keys(changes);
        const reapprove = needsReapproval(req, changes);
        return (
          <Banner tone={reapprove ? 'warn' : 'info'} title={reapprove ? 'Re-approval needed' : 'No re-approval needed'}>
            {reapprove
              ? 'Increasing openings or budget, or changing the budget currency, on an open requisition waits for a different approver. The live requisition stays unchanged until then.'
              : req?.status === 'pending'
                ? 'This requisition is still awaiting its first approval, so the amendment applies immediately.'
                : changed.length
                  ? 'Decreases and changes to department, location or date apply immediately.'
                  : 'Increasing openings or budget, or changing the budget currency, will need a different approver. Decreases and other changes apply immediately.'}
          </Banner>
        );
      }}
      onSubmit={async (v) => {
        const changes = diff(v);
        if (!Object.keys(changes).length) throw new Error('Change at least one field to amend the requisition.');
        if (!v.reason.trim()) throw new Error('A reason is required.');
        const body = { ...changes, reason: v.reason.trim(), expected_version: req.version };
        if (body.openings != null) body.openings = Number(body.openings);
        ['department_id', 'location_id'].forEach((k) => {
          if (body[k] != null) body[k] = Number(body[k]);
        });
        if (body.budget_currency) body.budget_currency = body.budget_currency.toUpperCase();
        await send('POST', paths.requisitionAmend(req.uuid), body);
        onDone();
      }}
      success="Amendment submitted"
    />
  );
}

/** One change as a before/after table. */
function Diff({ v }) {
  const fields = v.changed_fields ?? [];
  if (!fields.length) return null;
  return (
    <table className="mt-2 w-full border-collapse text-left text-xs" aria-label={`Changes in version ${v.version}`}>
      <thead>
        <tr className="text-slate-500 dark:text-slate-400">
          <th scope="col" className="py-1 pr-2 font-medium">Field</th>
          <th scope="col" className="py-1 pr-2 font-medium">Before</th>
          <th scope="col" className="py-1 font-medium">After</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((f) => (
          <tr key={f} className="border-t border-slate-200 dark:border-slate-700">
            <th scope="row" className="py-1 pr-2 text-left font-medium">{titleCase(f)}</th>
            <td className="py-1 pr-2 text-slate-600 line-through dark:text-slate-400">{show(v.before?.[f])}</td>
            <td className="py-1 font-semibold">{show(v.after?.[f])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Version history drawer with Approve / Reject for pending amendments. */
export function VersionsDrawer({ req, onClose, onChanged }) {
  const { can, session } = useAuth();
  const { busy, run } = useDo();
  const [state, setState] = useState({ loading: true, rows: [], error: null });
  const [attempt, setAttempt] = useState(0);
  const me = session?.user?.id;
  const reload = useCallback(() => setAttempt((a) => a + 1), []);
  useEffect(() => {
    if (!req) return undefined;
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(paths.requisitionVersions(req.uuid))
      .then((r) => live && setState({ loading: false, rows: Array.isArray(r) ? r : (r?.data ?? []), error: null }))
      .catch((error) => live && setState({ loading: false, rows: [], error }));
    return () => {
      live = false;
    };
  }, [req, attempt]);

  async function decide(v, decision) {
    const ok = await run(`${v.version}:${decision}`, () => send('POST', paths.requisitionDecision(req.uuid, v.version), { decision }), decision === 'approved' ? 'Amendment approved' : 'Amendment rejected');
    if (ok) {
      reload();
      onChanged?.();
    }
  }
  const approver = can('recruitment.approve');
  return (
    <Modal open={Boolean(req)} onClose={onClose} title={`Versions: ${req?.title ?? ''}`} drawer>
      <div className="px-6 pb-6">
        {state.loading ? (
          <Skeleton rows={3} />
        ) : state.error ? (
          <ErrorState error={state.error} onRetry={reload} />
        ) : state.rows.length === 0 ? (
          <EmptyState title="No amendments yet" description="Amendments to this requisition appear here with their before and after values." />
        ) : (
          <ol className="m-0 list-none space-y-3 p-0">
            {state.rows.map((v) => {
              const own = me != null && v.created_by === me;
              return (
                <li key={v.uuid ?? v.version} className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>Version {v.version}</strong>
                    <StatusBadge value={v.status} />
                    {v.requires_approval && <span className="text-slate-500 dark:text-slate-400">needs approval</span>}
                  </div>
                  <p className="m-0 mt-1">{v.reason}</p>
                  <Diff v={v} />
                  <small className="mt-2 block text-slate-500 dark:text-slate-400">
                    Requested by user #{v.created_by} on {fmtDate(v.created_at)}
                    {v.decided_at ? `; decided by user #${v.decided_by} on ${fmtDate(v.decided_at)}` : ''}
                  </small>
                  {v.status === 'pending' && approver && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Button variant="secondary" disabled={own || Boolean(busy)} loading={busy === `${v.version}:approved`} onClick={() => decide(v, 'approved')} aria-label={`Approve version ${v.version}`}>Approve</Button>
                      <Button variant="secondary" disabled={own || Boolean(busy)} loading={busy === `${v.version}:rejected`} onClick={() => decide(v, 'rejected')} aria-label={`Reject version ${v.version}`}>Reject</Button>
                      {own && <span className="text-[11px] text-slate-500 dark:text-slate-400">Another approver is needed</span>}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Modal>
  );
}
