import { useState } from 'react';
import { Button, Pagination } from '../../components/ui';
import {
  Banner,
  ConfirmDialog,
  FormModal,
  ListCard,
  Page,
  StatusBadge,
  useEmployeeOptions,
} from '../../components/lifecycle/kit';
import { useAuth } from '../../lib/auth';
import { clean, pageOf, paths, send, titleCase, today, useList } from '../../lib/lifecycleApi';

const KINDS = ['transfer', 'promotion', 'manager_change', 'location_change'].map((k) => ({
  value: k,
  label: titleCase(k),
}));
const num = (v) => (v === '' || v === undefined ? undefined : Number(v));
const employeeName = (move) => move.employee_name ?? move.employee?.name ?? 'Employee';
/** impact may be a list of notes or an object of dimension -> note. */
const impactLines = (i) =>
  (Array.isArray(i) ? i : Object.values(i ?? {})).map((x) =>
    typeof x === 'string' ? x : (x.note ?? x.message ?? JSON.stringify(x)),
  );

export default function MovesPage() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const list = useList(`${paths.moves}?page=${page}`);
  const employees = useEmployeeOptions();
  const [create, setCreate] = useState(null);
  const [decide, setDecide] = useState(null);
  const [cancel, setCancel] = useState(null);
  const manage = can('lifecycle.moves.manage');
  const approve = can('lifecycle.moves.approve');

  const actions = (m) => {
    if (m.status !== 'pending') return null;
    const blocked = m.can_decide === false;
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {approve && (
          <>
            <Button
              variant="secondary"
              disabled={blocked}
              aria-label={`Approve move for ${employeeName(m)}`}
              onClick={() => setDecide({ row: m, decision: 'approve' })}
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              disabled={blocked}
              aria-label={`Reject move for ${employeeName(m)}`}
              onClick={() => setDecide({ row: m, decision: 'reject' })}
            >
              Reject
            </Button>
            {blocked && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Another approver is needed
              </span>
            )}
          </>
        )}
        <Button
          variant="secondary"
          aria-label={`Cancel move for ${employeeName(m)}`}
          onClick={() => setCancel(m)}
        >
          Cancel
        </Button>
      </div>
    );
  };
  const impact = (m) => {
    const lines = impactLines(m.impact);
    return lines.length ? (
      <ul className="m-0 mt-1 list-disc pl-4 text-[11px] text-slate-500 dark:text-slate-400">
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    ) : null;
  };

  return (
    <Page
      permission="lifecycle.moves.manage|lifecycle.moves.approve"
      title="Internal moves"
      description="Transfers, promotions and manager changes. The requester cannot approve their own request."
      action={
        manage && (
          <Button onClick={() => setCreate({ kind: 'transfer', effective_date: today() })}>
            Request a move
          </Button>
        )
      }
    >
      <Banner tone="info">
        Approved moves dated today or earlier apply immediately; future-dated moves apply on their
        effective date.
      </Banner>
      <ListCard
        title="Moves"
        list={list}
        columns={[
          { key: 'employee_name', label: 'Employee' },
          { key: 'kind', label: 'Kind', priority: 'md', render: (m) => titleCase(m.kind) },
          { key: 'effective_date', label: 'Effective', priority: 'md' },
          { key: 'status', label: 'Status', render: (m) => <StatusBadge value={m.status} /> },
          {
            key: 'actions',
            label: 'Actions',
            render: (m) => (
              <div>
                {actions(m)}
                {impact(m)}
              </div>
            ),
          },
        ]}
        card={(m) => (
          <div>
            <div className="flex items-start justify-between gap-2">
          <strong className="text-sm">{employeeName(m)}</strong>
              <StatusBadge value={m.status} />
            </div>
            <p className="m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">
              {titleCase(m.kind)} · effective {m.effective_date}
            </p>
            {impact(m)}
            <div className="mt-2">{actions(m)}</div>
          </div>
        )}
        empty={{
          title: 'No moves',
          description: 'Requested transfers and promotions appear here.',
        }}
      />
      <Pagination data={list.data ? pageOf(list.data) : null} onChange={setPage} />

      <FormModal
        open={Boolean(create)}
        onClose={() => setCreate(null)}
        title="Request a move"
        initial={create ?? {}}
        fields={[
          {
            name: 'employee_uuid',
            label: 'Employee',
            options: [{ value: '', label: 'Select' }, ...employees],
          },
          { name: 'kind', label: 'Kind', options: KINDS },
          { name: 'effective_date', label: 'Effective date', type: 'date' },
          {
            name: 'manager_uuid',
            label: 'New manager',
            options: [{ value: '', label: 'No change' }, ...employees],
            required: false,
          },
          { name: 'department_id', label: 'New department ID', type: 'number', required: false },
          { name: 'designation_id', label: 'New designation ID', type: 'number', required: false },
          { name: 'location_id', label: 'New location ID', type: 'number', required: false },
          { name: 'reason', label: 'Reason', textarea: true, required: false },
        ]}
        onSubmit={async (v) => {
          const changes = clean({
            manager_uuid: v.manager_uuid,
            department_id: num(v.department_id),
            designation_id: num(v.designation_id),
            location_id: num(v.location_id),
          });
          await send(
            'POST',
            paths.moves,
            clean({
              employee_uuid: v.employee_uuid,
              kind: v.kind,
              effective_date: v.effective_date,
              reason: v.reason,
              changes,
            }),
          );
          list.reload();
        }}
        success="Move requested; awaiting a different approver"
      />
      <ConfirmDialog
        open={Boolean(decide)}
        onClose={() => setDecide(null)}
        title={decide?.decision === 'approve' ? 'Approve this move?' : 'Reject this move?'}
        intro={
          decide &&
          `${employeeName(decide.row)}: ${titleCase(decide.row.kind)} effective ${decide.row.effective_date}.`
        }
        confirmLabel={decide?.decision === 'approve' ? 'Approve' : 'Reject'}
        danger={decide?.decision === 'reject'}
        onConfirm={async () => {
          await send('POST', paths.move(decide.row.uuid, 'decision'), {
            decision: decide.decision,
          });
          list.reload();
        }}
      />
      <ConfirmDialog
        open={Boolean(cancel)}
        onClose={() => setCancel(null)}
        title="Cancel this move request?"
        intro={cancel && `${employeeName(cancel)}: ${titleCase(cancel.kind)}.`}
        confirmLabel="Cancel move"
        danger
        onConfirm={async () => {
          await send('POST', paths.move(cancel.uuid, 'cancel'));
          list.reload();
        }}
      />
    </Page>
  );
}
