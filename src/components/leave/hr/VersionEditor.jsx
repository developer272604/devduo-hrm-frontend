import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, ErrorState, FormError, Input, Modal, Select, Skeleton, Textarea, useToast } from '../../ui';
import { Banner, StatusBadge } from '../../timeoffice/parts';
import RuleDocEditor, { POLICY_GROUPS, TYPE_GROUPS } from './RuleDocEditor';
import { paths, send, typeOptions, unwrap, useAction } from '../../../lib/leaveHrApi';
import { useResource } from '../../../lib/hooks';

export const typeCodeOf = (t) => (typeof t.type === 'string' ? t.type : (t.type?.code ?? t.leave_type?.code ?? t.leave_type_code ?? t.code));

/**
 * Edit (draft) or inspect (published) one policy version.
 * Assumed detail shape: `{version, status, effective_from, effective_to, change_note, immutable, integrity_ok, checksum, rules, type_rules:[{type|leave_type:{code}, rules}]}`.
 * Save sends PATCH `{rules, type_rules:[{type:<code>, rules}], effective_from, effective_to, change_note}`.
 */
function Editor({ onClose, policyUuid, version, types, onSaved }) {
  const open = true;
  const toast = useToast();
  const detail = useResource(paths.policyVersion(policyUuid, version));
  const v = detail.data ? unwrap(detail.data) : null;
  const draft = v?.status === 'draft' && !v?.immutable;
  const [meta, setMeta] = useState({});
  const [rules, setRules] = useState({});
  const [typeRules, setTypeRules] = useState([]);
  const [current, setCurrent] = useState('');
  const [addCode, setAddCode] = useState('');
  const { busy, error, run, clear } = useAction();
  useEffect(() => {
    if (!v) return;
    setMeta({ effective_from: v.effective_from ?? '', effective_to: v.effective_to ?? '', change_note: v.change_note ?? '' });
    setRules(v.rules ?? {});
    const trs = (v.type_rules ?? []).map((t) => ({ type: typeCodeOf(t), rules: t.rules ?? {} }));
    setTypeRules(trs);
    setCurrent(trs[0]?.type ?? '');
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.data]);
  const used = new Set(typeRules.map((t) => t.type));
  const free = useMemo(() => types.filter((t) => !used.has(t.code)), [types, typeRules]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = typeRules.find((t) => t.type === current);
  const setActiveRules = (next) => setTypeRules((all) => all.map((t) => (t.type === current ? { ...t, rules: next } : t)));
  async function save(e) {
    e.preventDefault();
    const body = {
      rules,
      type_rules: typeRules,
      effective_from: meta.effective_from || undefined,
      effective_to: meta.effective_to || null,
      change_note: meta.change_note || undefined,
    };
    if (await run(() => send('PATCH', paths.policyVersion(policyUuid, version), body))) {
      toast(`Draft v${version} saved`);
      onSaved?.();
      onClose();
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={`${draft ? 'Edit' : 'View'} version ${version}`} drawer>
      {detail.loading && <Skeleton rows={3} />}
      {detail.error && <ErrorState error={detail.error} onRetry={detail.reload} />}
      {v && (
        <form onSubmit={save} className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusBadge status={v.status} />
            {v.checksum && <span className="font-mono text-[11px] text-slate-500">sha256 {String(v.checksum).slice(0, 12)}</span>}
            {v.integrity_ok === false && <Banner tone="error" title="Integrity check failed">The stored rules no longer match this version's checksum. Contact support before relying on it.</Banner>}
          </div>
          {!draft && (
            <Banner tone="info" title="Published versions are read-only">
              To change a rule, create a new draft version from this one and publish it.
            </Banner>
          )}
          <FormError error={error} />
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Input label="Effective from" type="date" value={meta.effective_from ?? ''} disabled={!draft} onChange={(e) => setMeta((m) => ({ ...m, effective_from: e.target.value }))} />
            <Input label="Effective to (optional)" type="date" value={meta.effective_to ?? ''} disabled={!draft} onChange={(e) => setMeta((m) => ({ ...m, effective_to: e.target.value }))} />
          </div>
          <Textarea label="Change note" value={meta.change_note ?? ''} disabled={!draft} onChange={(e) => setMeta((m) => ({ ...m, change_note: e.target.value }))} />
          <h3 className="m-0 text-sm">Policy-wide rules</h3>
          <RuleDocEditor groups={POLICY_GROUPS} rules={rules} onChange={setRules} disabled={!draft} errors={error?.errors ?? {}} />
          <h3 className="m-0 text-sm">Leave type rules</h3>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1">
              <Select label="Leave type" value={current} options={typeRules.length ? typeRules.map((t) => ({ value: t.type, label: t.type })) : [{ value: '', label: 'No type rules yet' }]} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            {draft && (
              <>
                <div className="min-w-48 flex-1">
                  <Select label="Add a leave type" value={addCode} options={typeOptions(free, 'Choose…')} onChange={(e) => setAddCode(e.target.value)} />
                </div>
                <div className="mb-5">
                  <Button
                    variant="secondary"
                    disabled={!addCode}
                    onClick={() => {
                      setTypeRules((all) => [...all, { type: addCode, rules: {} }]);
                      setCurrent(addCode);
                      setAddCode('');
                    }}
                  >
                    <Plus size={14} /> Add
                  </Button>
                </div>
                {active && (
                  <div className="mb-5">
                    <Button variant="ghost" aria-label={`Remove ${active.type} rules`} onClick={() => { setTypeRules((all) => all.filter((t) => t.type !== current)); setCurrent(''); }}>
                      <Trash2 size={14} /> Remove
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
          {active ? (
            <RuleDocEditor key={active.type} groups={TYPE_GROUPS} rules={active.rules} onChange={setActiveRules} disabled={!draft} />
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">A policy needs at least one leave type rule before it can be published.</p>
          )}
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={onClose}>{draft ? 'Cancel' : 'Close'}</Button>
            {draft && <Button type="submit" loading={busy}>Save draft</Button>}
          </div>
        </form>
      )}
    </Modal>
  );
}

/** Mount-on-open wrapper: no request is made while the drawer is closed. */
export default function VersionEditor({ open, ...props }) {
  return open && props.version != null ? <Editor {...props} /> : null;
}
