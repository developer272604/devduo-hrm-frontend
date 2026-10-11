import { useEffect, useState } from 'react';
import { Button, Card, Checkbox, ErrorState, FormError, Modal, Skeleton, Textarea } from '../../ui';
import ResponsiveList from '../../ResponsiveList';
import { Banner } from '../../timeoffice/parts';
import { titleCase, useAction } from '../../../lib/leaveHrApi';

/** Card with the standard four states: loading skeleton, error/403, empty and the list. `list` comes from useList(). */
export function ListCard({ title, list, columns, mobile, empty, action, onRowClick, rowKey, rows, label, extra, card }) {
  return (
    <Card title={title} action={action} className="mb-5">
      {extra}
      {list.loading ? (
        <Skeleton />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : (
        <ResponsiveList
          label={label ?? title ?? 'Records'}
          columns={columns}
          rows={rows ?? list.rows}
          rowKey={rowKey ?? ((r) => r.uuid ?? r.id)}
          mobile={mobile}
          card={card}
          onRowClick={onRowClick}
          empty={empty}
        />
      )}
    </Card>
  );
}

export const Tile = ({ label, value, tone, detail }) => (
  <div
    className={`rounded-lg border p-3 ${tone === 'warn' ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}
  >
    <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
    <dd className="m-0 text-xl font-semibold text-slate-800 dark:text-slate-100">{value ?? '—'}</dd>
    {detail && <small className="text-[11px] text-slate-500 dark:text-slate-400">{detail}</small>}
  </div>
);
export const Tiles = ({ items }) => (
  <dl className="m-0 mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
    {items.map((t) => (
      <Tile key={t.label} {...t} />
    ))}
  </dl>
);

/** Scalar fields of an object as a definition list. */
export function KeyValues({ data, skip = [] }) {
  const entries = Object.entries(data ?? {}).filter(([k, v]) => !skip.includes(k) && v !== null && v !== undefined && typeof v !== 'object');
  if (!entries.length) return null;
  return (
    <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
      {entries.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-slate-500 dark:text-slate-400">{titleCase(k)}</dt>
          <dd className="m-0 truncate text-slate-800 dark:text-slate-100">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export const Section = ({ title, children }) => (
  <div className="px-6 pb-5">
    {title && <h3 className="mb-2 mt-0 text-sm">{title}</h3>}
    {children}
  </div>
);

/** Plain confirmation (no preview needed): used for reversible actions like retire. */
export function ConfirmDialog({ open, onClose, title, intro, confirmLabel = 'Confirm', danger, onConfirm }) {
  const { busy, error, run, clear } = useAction();
  useEffect(() => {
    if (open) clear();
  }, [open, clear]);
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <FormError error={error} />
      {intro && <p className="mt-0 text-sm">{intro}</p>}
      <div className="mt-4 flex justify-end gap-2.5">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={async () => (await run(onConfirm)) && onClose()}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Preview, then confirm. `load()` runs when the dialog opens and writes nothing. `children(data)` renders the preview.
 * `blocked(data)` returns a message that disables confirmation. `ack(data)` returns a checkbox label that must be ticked.
 * `reason` adds a required reason box. `onConfirm(data, {reason, acknowledged})` performs the write.
 */
export function ConfirmPreview({ open, onClose, title, intro, notice, load, children, blocked, ack, reason: reasonLabel, confirmLabel = 'Confirm', danger, onConfirm }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const [acknowledged, setAck] = useState(false);
  const [reason, setReason] = useState('');
  const { busy, error, run, clear } = useAction();
  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setState({ loading: true, data: null, error: null });
    setAck(false);
    setReason('');
    clear();
    Promise.resolve()
      .then(load)
      .then((r) => live && setState({ loading: false, data: r?.data ?? r, error: null }))
      .catch((e) => live && setState({ loading: false, data: null, error: e }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attempt]);
  const block = state.data ? blocked?.(state.data) : null;
  const ackLabel = state.data ? ack?.(state.data) : null;
  async function submit(e) {
    e.preventDefault();
    if (await run(() => onConfirm(state.data, { reason: reason.trim(), acknowledged }))) onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit}>
        {intro && <p className="mt-0 text-sm">{intro}</p>}
        {notice && <Banner tone="info">{notice}</Banner>}
        {state.loading && <Skeleton rows={2} />}
        {state.error && <ErrorState error={state.error} onRetry={() => setAttempt((a) => a + 1)} />}
        {state.data && (
          <>
            <h3 className="mb-2 mt-0 text-sm">Preview (nothing has been changed yet)</h3>
            {children(state.data)}
            {block && (
              <Banner tone="error" title="This cannot be applied">
                {block}
              </Banner>
            )}
          </>
        )}
        <FormError error={error} />
        {ackLabel && !block && (
          <div className="mb-4">
            <Checkbox label={ackLabel} checked={acknowledged} onChange={(e) => setAck(e.target.checked)} />
          </div>
        )}
        {reasonLabel && state.data && <Textarea label={reasonLabel} value={reason} required onChange={(e) => setReason(e.target.value)} />}
        <div className="mt-4 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={busy} disabled={!state.data || Boolean(block) || (Boolean(ackLabel) && !acknowledged)}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** A label that always carries text (never colour alone). */
export const Pill = ({ children }) => (
  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
    {children}
  </span>
);

/** Renders `{key: n}` maps (by_type, totals) as a compact list. */
export function CountMap({ map, empty = 'None' }) {
  const entries = Object.entries(map ?? {});
  if (!entries.length) return <span className="text-xs text-slate-500">{empty}</span>;
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {entries.map(([k, v]) => (
        <li key={k}>
          <Pill>
            {titleCase(k)}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </Pill>
        </li>
      ))}
    </ul>
  );
}
