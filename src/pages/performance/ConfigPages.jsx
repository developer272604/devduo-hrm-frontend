import { useState } from 'react';
import { Button, Checkbox, FormError, Input, Modal, Pagination, Select, Tabs, useToast } from '../../components/ui';
import { ConfirmDialog, ConfirmPreview, FormModal, KeyValues, ListCard, StatusBadge, useDo } from '../../components/payroll/kit';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { clean, pageOf, paths, reviewerTotal, send, titleCase, today, useAction, useList, validateCycle, validateScale, validateTemplate } from '../../lib/performanceApi';
import { Page } from './parts';

const SECTION_TYPES = ['goals', 'competencies', 'values', 'overall'].map((v) => ({ value: v, label: titleCase(v) }));
const blankSection = () => ({ key: '', title: '', type: 'goals', weight: '', mandatory: false });

function TemplateBuilder({ open, onClose, scales, onSaved }) {
  const toast = useToast();
  const [v, setV] = useState({ name: '', scale_code: '', sections: [blankSection()], reviewer_weights: { manager: 60, self: 20, peer: 20, skip: 0 } });
  const { busy, error, run, clear } = useAction();
  const total = reviewerTotal(v.reviewer_weights);
  const sectionTotal = v.sections.reduce((a, s) => a + (Number(s.weight) || 0), 0);
  const setSection = (i, patch) => setV((x) => ({ ...x, sections: x.sections.map((s, n) => (n === i ? { ...s, ...patch } : s)) }));
  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(async () => {
      const body = validateTemplate(v);
      await send('POST', paths.templates, body);
    });
    if (ok) {
      toast('Template created');
      onSaved();
      onClose();
    }
  };
  return (
    <Modal open={open} onClose={() => { clear(); onClose(); }} title="Create a review template">
      <form onSubmit={submit}>
        <FormError error={error} />
        <Input label="Template name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        <Select label="Rating scale" required value={v.scale_code} options={[{ value: '', label: 'Choose a scale' }, ...scales.map((s) => ({ value: s.code, label: `${s.name} (${s.min}-${s.max})` }))]} onChange={(e) => setV({ ...v, scale_code: e.target.value })} />
        <h3 className="mb-2 mt-0 text-sm">Sections and weights</h3>
        {v.sections.map((s, i) => (
          <fieldset key={i} className="mb-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <legend className="px-1 text-xs font-medium">Section {i + 1}</legend>
            <div className="grid gap-x-3 sm:grid-cols-2">
              <Input label={`Section ${i + 1} key`} value={s.key} hint="Lowercase, e.g. goals" onChange={(e) => setSection(i, { key: e.target.value })} />
              <Input label={`Section ${i + 1} title`} value={s.title} onChange={(e) => setSection(i, { title: e.target.value })} required />
              <Select label={`Section ${i + 1} type`} value={s.type} options={SECTION_TYPES} onChange={(e) => setSection(i, { type: e.target.value })} />
              <Input label={`Section ${i + 1} weight`} type="number" step="0.01" min="0.01" max="100" value={s.weight} onChange={(e) => setSection(i, { weight: e.target.value })} required />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Checkbox label="Mandatory" checked={s.mandatory} onChange={(e) => setSection(i, { mandatory: e.target.checked })} />
              {v.sections.length > 1 && <Button variant="secondary" onClick={() => setV((x) => ({ ...x, sections: x.sections.filter((_, n) => n !== i) }))}>Remove section {i + 1}</Button>}
            </div>
          </fieldset>
        ))}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={v.sections.length >= 12} onClick={() => setV((x) => ({ ...x, sections: [...x.sections, blankSection()] }))}>Add section</Button>
          <span className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">Section weights total {sectionTotal}. They are renormalized when scoring.</span>
        </div>
        <h3 className="mb-2 mt-0 text-sm">Reviewer weights (must total 100)</h3>
        <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-4">
          {['manager', 'self', 'peer', 'skip'].map((k) => (
            <Input key={k} label={`${titleCase(k)} weight`} type="number" min="0" max="100" value={v.reviewer_weights[k]} onChange={(e) => setV({ ...v, reviewer_weights: { ...v.reviewer_weights, [k]: e.target.value } })} />
          ))}
        </div>
        <p className={`mt-0 text-xs ${total === 100 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`} aria-live="polite">Reviewer weights total {total}{total === 100 ? '' : ' - must be exactly 100'}.</p>
        <div className="mt-4 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Create template</Button>
        </div>
      </form>
    </Modal>
  );
}

export function ConfigurationPage() {
  const [tab, setTab] = useState('scales');
  const [modal, setModal] = useState(null);
  const scales = useList(paths.scales);
  const competencies = useList(paths.competencies);
  const templates = useList(paths.templates);
  return (
    <Page permission="performance.cycles.manage" title="Review configuration" description="Rating scales, competencies and review templates. Published cycles keep a snapshot, so later edits never rewrite finalized reviews.">
      <Tabs
        items={[{ value: 'scales', label: 'Rating scales' }, { value: 'competencies', label: 'Competencies' }, { value: 'templates', label: 'Templates' }]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-5">
        {tab === 'scales' && (
          <ListCard
            title="Rating scales"
            list={scales}
            action={<Button onClick={() => setModal('scale')}>Add rating scale</Button>}
            columns={[
              { key: 'code', label: 'Code' },
              { key: 'name', label: 'Name' },
              { key: 'range', label: 'Range', render: (s) => `${s.min} - ${s.max}` },
              { key: 'labels', label: 'Labels', priority: 'md', render: (s) => (s.labels ?? []).map((l) => `${l.value} ${l.label}`).join(', ') },
            ]}
            mobile={{ title: 'name', subtitle: 'code', facts: [{ label: 'Range', value: (s) => `${s.min} - ${s.max}` }] }}
            empty={{ title: 'No rating scales', description: 'Add a scale before creating a review template.' }}
          />
        )}
        {tab === 'competencies' && (
          <ListCard
            title="Competencies and values"
            list={competencies}
            action={<Button onClick={() => setModal('competency')}>Add competency</Button>}
            columns={[
              { key: 'code', label: 'Code' },
              { key: 'name', label: 'Name' },
              { key: 'category', label: 'Category', priority: 'md', render: (c) => titleCase(c.category) },
              { key: 'description', label: 'Description', priority: 'lg' },
            ]}
            mobile={{ title: 'name', subtitle: 'code', facts: [{ label: 'Category', value: (c) => titleCase(c.category) }] }}
            empty={{ title: 'No competencies', description: 'Add the competencies reviewers will rate.' }}
          />
        )}
        {tab === 'templates' && (
          <ListCard
            title="Review templates"
            list={templates}
            action={<Button onClick={() => setModal('template')}>Create template</Button>}
            columns={[
              { key: 'name', label: 'Template' },
              { key: 'scale_code', label: 'Scale', priority: 'md' },
              { key: 'sections', label: 'Sections', render: (t) => (t.sections ?? []).map((s) => `${s.title} (${s.weight})`).join(', ') },
              { key: 'weights', label: 'Reviewer weights', priority: 'md', render: (t) => Object.entries(t.reviewer_weights ?? {}).map(([k, w]) => `${titleCase(k)} ${w}`).join(' / ') },
            ]}
            mobile={{ title: 'name', subtitle: 'scale_code', facts: [{ label: 'Sections', value: (t) => (t.sections ?? []).length }] }}
            empty={{ title: 'No templates', description: 'Create a template from a scale and weighted sections.' }}
          />
        )}
      </div>
      <FormModal
        open={modal === 'scale'}
        onClose={() => setModal(null)}
        title="Add a rating scale"
        initial={{ code: '', name: '', min: 1, max: 5, labels: '1=Needs improvement\n3=Meets expectations\n5=Outstanding' }}
        fields={[
          { name: 'code', label: 'Code', hint: 'Capital letters and underscores, e.g. FIVE_POINT' },
          { name: 'name', label: 'Name' },
          { name: 'min', label: 'Minimum', type: 'number' },
          { name: 'max', label: 'Maximum', type: 'number' },
          { name: 'labels', label: 'Labels', textarea: true, hint: 'One per line as value=label. Every value must be within the range.' },
        ]}
        onSubmit={async (values) => { await send('POST', paths.scales, validateScale(values)); scales.reload(); }}
        success="Rating scale created"
      />
      <FormModal
        open={modal === 'competency'}
        onClose={() => setModal(null)}
        title="Add a competency"
        initial={{ code: '', name: '', description: '', category: 'competency' }}
        fields={[
          { name: 'code', label: 'Code', hint: 'Capital letters and underscores, e.g. TEAMWORK' },
          { name: 'name', label: 'Name' },
          { name: 'category', label: 'Category', options: [{ value: 'competency', label: 'Competency' }, { value: 'value', label: 'Company value' }] },
          { name: 'description', label: 'Description', textarea: true, required: false },
        ]}
        onSubmit={async (values) => {
          if (!/^[A-Z][A-Z0-9_]{0,39}$/.test(values.code)) throw Object.assign(new Error('Use capital letters, digits and underscores, starting with a letter.'), { errors: {} });
          await send('POST', paths.competencies, clean(values));
          competencies.reload();
        }}
        success="Competency created"
      />
      <TemplateBuilder key={String(modal === 'template')} open={modal === 'template'} onClose={() => setModal(null)} scales={scales.rows} onSaved={templates.reload} />
    </Page>
  );
}

const KINDS = ['annual', 'half_year', 'quarterly', 'custom'].map((v) => ({ value: v, label: titleCase(v) }));

function EligibilityPreview({ data }) {
  return (
    <>
      <KeyValues data={{ as_of: data.as_of, eligible_people: data.count, already_in_cycle: data.already_reviewed }} />
      <p className="text-xs text-slate-600 dark:text-slate-300">Launching adds a review for each eligible person who is not already in the cycle. It is safe to run again later: only newly eligible people are added.</p>
    </>
  );
}

export function CyclesPage() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const list = useList(`${paths.cycles}?page=${page}`);
  const templates = useList(paths.templates);
  const actions = useDo();
  const [create, setCreate] = useState(false);
  const [publishing, setPublishing] = useState(null);
  const [previewing, setPreviewing] = useState(null);
  const [launching, setLaunching] = useState(null);
  const manage = can('performance.cycles.manage');
  return (
    <Page permission="performance.cycles.manage" title="Review cycles" description="Create, publish, preview who is eligible, and launch review cycles." action={manage && <Button onClick={() => setCreate(true)}>Create cycle</Button>}>
      <ListCard
        title="Cycles"
        list={list}
        columns={[
          { key: 'name', label: 'Cycle' },
          { key: 'kind', label: 'Type', priority: 'md', render: (c) => titleCase(c.kind) },
          { key: 'start_date', label: 'Dates', priority: 'md', render: (c) => `${c.start_date} to ${c.end_date}` },
          { key: 'reviews', label: 'Reviews', render: (c) => c.reviews ?? 0 },
          { key: 'status', label: 'Status', render: (c) => <StatusBadge value={c.status} /> },
          { key: 'actions', label: 'Actions', render: (c) => <CycleActions c={c} busy={Boolean(actions.busy)} onPublish={setPublishing} onPreview={setPreviewing} onLaunch={setLaunching} /> },
        ]}
        card={(c) => (
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2"><strong>{c.name}</strong><StatusBadge value={c.status} /></div>
            <p className="my-1 text-xs text-slate-500 dark:text-slate-400">{c.start_date} to {c.end_date} - {c.reviews ?? 0} reviews</p>
            <CycleActions c={c} busy={Boolean(actions.busy)} onPublish={setPublishing} onPreview={setPreviewing} onLaunch={setLaunching} />
          </div>
        )}
        mobile={{ title: 'name', subtitle: (c) => `${c.start_date} to ${c.end_date}`, badge: (c) => <StatusBadge value={c.status} /> }}
        empty={{ title: 'No cycles', description: 'Create a review cycle from a template.' }}
      />
      <Pagination data={list.data ? pageOf(list.data) : null} onChange={setPage} />
      <FormModal
        open={create}
        onClose={() => setCreate(false)}
        title="Create a review cycle"
        intro="The cycle starts as a draft. Nobody is notified until you publish and launch it."
        initial={{ kind: 'annual', start_date: today(), end_date: `${today().slice(0, 4)}-12-31`, min_peer_responses: 2, peer_anonymous: true, exclude_probation: true }}
        fields={[
          { name: 'name', label: 'Cycle name' },
          { name: 'kind', label: 'Cycle type', options: KINDS },
          { name: 'template_uuid', label: 'Review template', options: [{ value: '', label: 'Choose a template' }, ...templates.rows.map((t) => ({ value: t.uuid, label: t.name }))] },
          { name: 'start_date', label: 'Start date', type: 'date' },
          { name: 'end_date', label: 'End date', type: 'date' },
          { name: 'self_due', label: 'Self review due', type: 'date', required: false },
          { name: 'manager_due', label: 'Manager review due', type: 'date', required: false },
          { name: 'peer_due', label: 'Peer review due', type: 'date', required: false },
          { name: 'calibration_due', label: 'Calibration due', type: 'date', required: false },
          { name: 'min_tenure_days', label: 'Minimum tenure (days)', type: 'number', required: false, hint: 'Leave empty to include everyone, effective-dated at the reference date.' },
          { name: 'exclude_probation', label: 'Exclude people on probation', type: 'checkbox' },
          { name: 'min_peer_responses', label: 'Minimum peer responses before feedback is shown', type: 'number' },
          { name: 'peer_anonymous', label: 'Keep peer reviewers anonymous', type: 'checkbox' },
          { name: 'share_peer_feedback', label: 'Share peer feedback with the employee after finalization', type: 'checkbox' },
        ]}
        onSubmit={async (values) => { await send('POST', paths.cycles, validateCycle(values)); list.reload(); }}
        success="Review cycle created as a draft"
      />
      <ConfirmDialog
        open={Boolean(publishing)}
        onClose={() => setPublishing(null)}
        title={`Publish ${publishing?.name ?? 'cycle'}?`}
        intro="Publishing locks the template for this cycle. You can still preview eligibility and decide when to launch."
        confirmLabel="Publish cycle"
        onConfirm={async () => { await actions.run('publish', () => api(paths.cycle(publishing.uuid, 'publish'), { method: 'POST' }), 'Cycle published'); list.reload(); }}
      />
      <ConfirmPreview
        open={Boolean(previewing)}
        onClose={() => setPreviewing(null)}
        title={`Who is eligible for ${previewing?.name ?? 'this cycle'}`}
        load={() => api(paths.cycle(previewing.uuid, 'eligibility'))}
        confirmLabel="Close preview"
        onConfirm={async () => {}}
      >
        {(data) => <EligibilityPreview data={data} />}
      </ConfirmPreview>
      <ConfirmPreview
        open={Boolean(launching)}
        onClose={() => setLaunching(null)}
        title={`Launch ${launching?.name ?? 'cycle'}`}
        notice="Launching creates reviews and assigns self and manager reviews. People are notified."
        load={() => api(paths.cycle(launching.uuid, 'eligibility'))}
        blocked={(d) => (d.count === 0 ? 'No employees are eligible with the current rules, so there is nothing to launch.' : null)}
        ack={(d) => `I have checked that ${d.count} eligible people is correct`}
        confirmLabel="Launch cycle"
        onConfirm={async () => { await actions.run('launch', () => api(paths.cycle(launching.uuid, 'launch'), { method: 'POST' }), 'Cycle launched'); list.reload(); }}
      >
        {(data) => <EligibilityPreview data={data} />}
      </ConfirmPreview>
    </Page>
  );
}

function CycleActions({ c, busy, onPublish, onPreview, onLaunch }) {
  const { can } = useAuth();
  if (!can('performance.cycles.manage')) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {['draft', 'published'].includes(c.status) && <Button variant="secondary" disabled={busy} onClick={() => onPreview(c)}>Preview eligibility</Button>}
      {c.status === 'draft' && <Button variant="secondary" disabled={busy} onClick={() => onPublish(c)}>Publish</Button>}
      {c.status === 'published' && <Button disabled={busy} onClick={() => onLaunch(c)}>Launch</Button>}
    </div>
  );
}

