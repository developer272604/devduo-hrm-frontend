import { useState } from 'react';
import { Badge, Button, FormError, Input, Modal, Textarea, useToast } from '../../components/ui';
import { Banner, ListCard, Page, Section } from '../../components/recruitment/kit';
import { ALLOWED_TAGS, MERGE_FIELDS, fmtDate, paths, send, strippedTags, unknownMergeFields, useAction, useList } from '../../lib/recruitmentApi';

function TemplateForm({ fields, initial, onClose, onDone }) {
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [local, setLocal] = useState({});
  const { busy, error, run } = useAction();
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const removed = strippedTags(v.body);
  const server = Object.fromEntries(Object.entries(error?.errors ?? {}).map(([k, m]) => [k, m[0]]));
  const errors = { ...server, ...local };
  async function submit(e) {
    e.preventDefault();
    const next = {};
    const unknown = unknownMergeFields(v.body, fields);
    if (!/^[a-z0-9_-]+$/.test(v.code ?? '')) next.code = 'Use lowercase letters, numbers, hyphens or underscores.';
    if (!v.name?.trim()) next.name = 'Enter a name.';
    if (!v.body?.trim()) next.body = 'Enter the letter body.';
    else if (unknown.length) next.body = `Unknown merge fields: ${unknown.join(', ')}. Allowed: ${fields.join(', ')}.`;
    setLocal(next);
    if (Object.keys(next).length) return;
    if (await run(() => send('POST', paths.offerTemplates, { code: v.code, name: v.name.trim(), body: v.body }))) {
      toast('Template version created');
      onDone();
      onClose();
    }
  }
  return (
    <Modal open onClose={onClose} title="New template version">
      <form onSubmit={submit} noValidate>
        <p className="mt-0 text-sm">Saving creates the next version for this code and retires the active one. Existing offer documents are not changed.</p>
        <FormError error={error && !error.errors ? error : null} />
        <Input label="Code" value={v.code ?? ''} onChange={set('code')} error={errors.code} hint="Reuse an existing code to add a version." maxLength={60} />
        <Input label="Name" value={v.name ?? ''} onChange={set('name')} error={errors.name} maxLength={160} />
        <Textarea label="Body" rows={8} value={v.body ?? ''} onChange={set('body')} error={errors.body} aria-describedby="tpl-help" />
        <div id="tpl-help" className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          <p className="mt-0">
            Merge fields, written as {'{{field}}'}:{' '}
            {fields.map((f) => (
              <code key={f} className="mr-1">
                {f}
              </code>
            ))}
          </p>
          <p className="mb-0" aria-live="polite">
            Preview note: only basic HTML tags are kept ({ALLOWED_TAGS.join(', ')}). Attributes are removed and any other markup is shown as plain text.
            {removed.length > 0 && ` Will be escaped: ${removed.join(', ')}.`}
          </p>
        </div>
        <div className="mt-4 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Create version
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function OfferTemplatesPage() {
  const list = useList(paths.offerTemplates);
  const [form, setForm] = useState(null);
  const fields = Array.isArray(list.data?.merge_fields) ? list.data.merge_fields : MERGE_FIELDS;
  const codes = [...new Set(list.rows.map((t) => t.code))].map((code) => {
    const versions = list.rows.filter((t) => t.code === code).sort((a, b) => b.version - a.version);
    return { uuid: code, code, versions, active: versions.find((t) => t.status === 'active') };
  });
  const actions = (c) => (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span>{c.versions.length} version(s)</span>
      <Button variant="secondary" aria-label={`New version of ${c.code}`} onClick={() => setForm({ code: c.code, name: c.active?.name ?? c.versions[0].name, body: c.active?.body ?? '' })}>
        New version
      </Button>
    </div>
  );
  return (
    <Page permission="recruitment.offer.manage" title="Offer templates" description="Versioned letter templates with merge fields." action={<Button onClick={() => setForm({})}>New template</Button>}>
      <Banner tone="info">Letters are restricted HTML. No e-signature or email delivery: documents are printed from the offer.</Banner>
      <ListCard
        title="Templates"
        list={{ ...list, rows: codes }}
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Active name', render: (c) => c.active?.name ?? 'No active version' },
          { key: 'version', label: 'Active version', render: (c) => (c.active ? <Badge tone="green">v{c.active.version}</Badge> : '—') },
          { key: 'created', label: 'Created', priority: 'md', render: (c) => fmtDate(c.active?.created_at) },
          { key: 'actions', label: 'Actions', render: actions },
        ]}
        card={(c) => (
          <div>
            <strong className="text-sm">{c.code}</strong>
            <p className="m-0 mt-1 text-xs text-slate-500 dark:text-slate-400">{c.active ? `${c.active.name} · v${c.active.version} active` : 'No active version'}</p>
            <div className="mt-2">{actions(c)}</div>
          </div>
        )}
        empty={{ title: 'No templates', description: 'Without an active template, approving an offer creates no letter.' }}
      />
      <Section title="Merge fields">
        <p className="m-0 text-xs text-slate-600 dark:text-slate-300">{fields.join(', ')}</p>
      </Section>
      {form && <TemplateForm fields={fields} initial={form} onClose={() => setForm(null)} onDone={list.reload} />}
    </Page>
  );
}
