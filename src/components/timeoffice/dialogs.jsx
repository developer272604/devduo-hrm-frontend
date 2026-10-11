import { useEffect, useState } from 'react';
import { Button, FormError, Modal, Skeleton, Textarea, ErrorState } from '../ui';
import { Banner, Impact } from './parts';
import { useAction } from '../../lib/timeOfficeApi';

/**
 * Decision dialog that always asks for a reason/comment. `notice` carries maker-checker wording
 * (for example "A second approver must confirm this before it takes effect").
 */
export function ReasonDialog({ open, onClose, title, intro, notice, label = 'Reason', required = true, confirmLabel = 'Confirm', danger, onConfirm }) {
  const [reason, setReason] = useState('');
  const { busy, error, run, clear } = useAction();
  useEffect(() => {
    if (open) {
      setReason('');
      clear();
    }
  }, [open, clear]);
  async function submit(e) {
    e.preventDefault();
    if (await run(() => onConfirm(reason.trim()))) onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit}>
        {intro && <p className="mt-0 text-sm">{intro}</p>}
        {notice && <Banner tone="info">{notice}</Banner>}
        <FormError error={error} />
        <Textarea label={label} value={reason} required={required} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Preview -> confirm. `load()` fetches the impact preview when the dialog opens; nothing is changed until the
 * user confirms. A preview that reports conflicts (`blocked`, or `can_apply === false`) disables confirmation.
 */
export function PreviewConfirm({ open, onClose, title, intro, notice, load, onConfirm, confirmLabel = 'Confirm and apply', withReason = false, danger }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [reason, setReason] = useState('');
  const { busy, error, run, clear } = useAction();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open) return;
    let live = true;
    setState({ loading: true, data: null, error: null });
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
  const blocked = state.data && (state.data.blocked === true || state.data.can_apply === false);
  async function submit(e) {
    e.preventDefault();
    if (await run(() => onConfirm(state.data, reason.trim()))) onClose();
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
            <h3 className="mb-2 text-sm">Impact preview</h3>
            <Impact data={state.data} />
            {blocked && <Banner tone="error" title="This cannot be applied">Resolve the conflicts listed above, then preview again.</Banner>}
          </>
        )}
        <FormError error={error} />
        {withReason && state.data && (
          <div className="mt-4">
            <Textarea label="Reason (recorded in the audit trail)" value={reason} required onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={busy} disabled={!state.data || blocked}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
