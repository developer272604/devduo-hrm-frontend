import { useState } from 'react';
import { Button, useToast } from '../../components/ui';
import { Banner, ConfirmDialog, FormModal, ListCard, Page, StatusBadge, useDo } from '../../components/payroll/kit';
import { useAuth } from '../../lib/auth';
import { paths, send, titleCase, today, useList } from '../../lib/payrollApi';

const SETUP = 'payroll.configure|payroll.compensation.manage|payroll.view';
const KINDS = ['earning', 'deduction', 'tax', 'employee_contribution', 'employer_contribution', 'benefit', 'reimbursement', 'informational'].map((k) => ({ value: k, label: titleCase(k) }));

function FormulaCheck({ formula }) {
  const [result, setResult] = useState(null);
  const { busy, run } = useDo();
  return (
    <div className="mb-5">
      <Button
        variant="secondary"
        loading={busy === 'check'}
        disabled={!formula}
        onClick={async () => setResult(await run('check', () => send('POST', paths.formulaCheck, { formula })))}
      >
        Check formula
      </Button>
      {result && result !== true && (
        <div className="mt-2" role="status">
          {result.valid ? (
            <Banner tone="success">Formula is valid. References: {(result.references ?? []).join(', ') || 'none'}.</Banner>
          ) : (
            <Banner tone="error" title="Formula problems">
              <ul className="m-0 list-disc pl-4">
                {(result.problems ?? []).map((p, i) => (
                  <li key={i}>{typeof p === 'string' ? p : p.message}</li>
                ))}
              </ul>
            </Banner>
          )}
        </div>
      )}
    </div>
  );
}

export function ComponentsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useList(`${paths.components}?per_page=100`);
  const [create, setCreate] = useState(false);
  const [publish, setPublish] = useState(null);
  const cfg = can('payroll.configure');
  return (
    <Page permission={SETUP} title="Salary components" description="Earnings, deductions and statutory items. Published versions never change." action={cfg && <Button onClick={() => setCreate(true)}>New component</Button>}>
      <ListCard
        title="Components"
        list={list}
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          { key: 'kind', label: 'Type', render: (r) => titleCase(r.kind) },
          { key: 'version', label: 'Version', priority: 'md' },
          { key: 'formula', label: 'Formula', priority: 'lg', render: (r) => r.formula ?? 'Fixed amount' },
          { key: 'published', label: 'Status', render: (r) => <StatusBadge value={r.published ? 'published' : 'draft'} /> },
          { key: 'act', label: '', render: (r) => cfg && !r.published && <Button variant="secondary" onClick={() => setPublish(r)}>Publish</Button> },
        ]}
        card={(r) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <strong className="text-sm">
                {r.name} · v{r.version}
              </strong>
              <StatusBadge value={r.published ? 'published' : 'draft'} />
            </div>
            <p className="m-0 text-xs text-slate-500">
              {r.code} · {titleCase(r.kind)} · {r.formula ?? 'Fixed amount'}
            </p>
            {cfg && !r.published && (
              <div className="mt-2">
                <Button variant="secondary" onClick={() => setPublish(r)}>Publish</Button>
              </div>
            )}
          </div>
        )}
        empty={{ title: 'No components', description: 'Create components to build salary structures.' }}
      />
      <FormModal
        open={create}
        onClose={() => setCreate(false)}
        title="New salary component"
        initial={{ kind: 'earning', currency: 'USD', effective_from: today(), formula: '' }}
        fields={[
          { name: 'name', label: 'Name' },
          { name: 'code', label: 'Code' },
          { name: 'kind', label: 'Type', options: KINDS },
          { name: 'currency', label: 'Currency' },
          { name: 'effective_from', label: 'Effective from', type: 'date' },
          { name: 'formula', label: 'Formula (optional)', required: false, hint: 'Example: BASE * 0.4. Variables such as BASE, GROSS and PAYABLE_DAYS are allowed.' },
          { name: 'gl_code', label: 'GL code', required: false },
        ]}
        extra={(v) => <FormulaCheck formula={v.formula} />}
        onSubmit={async (v) => {
          await send('POST', paths.components, Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '')));
          list.reload();
        }}
        success="Component created"
      />
      <ConfirmDialog
        open={Boolean(publish)}
        onClose={() => setPublish(null)}
        title={`Publish ${publish?.name ?? ''} v${publish?.version ?? ''}?`}
        intro="Publishing makes this version immutable. To change it later you create a new version."
        confirmLabel="Publish"
        onConfirm={async () => {
          await send('POST', paths.component(publish.uuid, 'publish'), {});
          toast('Component published');
          list.reload();
        }}
      />
    </Page>
  );
}

export function StructuresPage() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useList(paths.structures);
  const [create, setCreate] = useState(false);
  const [activate, setActivate] = useState(null);
  const cfg = can('payroll.configure');
  return (
    <Page permission={SETUP} title="Salary structures" description="Bundles of components assigned to employees." action={cfg && <Button onClick={() => setCreate(true)}>New structure</Button>}>
      <ListCard
        title="Structures"
        list={list}
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          { key: 'version', label: 'Version' },
          { key: 'effective_from', label: 'From', priority: 'md' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          { key: 'act', label: '', render: (r) => cfg && r.status === 'draft' && <Button variant="secondary" onClick={() => setActivate(r)}>Activate</Button> },
        ]}
        mobile={{ title: 'name', subtitle: 'code', badge: (r) => <StatusBadge value={r.status} />, facts: [{ label: 'Version', value: 'version' }, { label: 'From', value: 'effective_from' }] }}
        empty={{ title: 'No structures', description: 'Create a structure from published components.' }}
      />
      <FormModal
        open={create}
        onClose={() => setCreate(false)}
        title="New salary structure"
        initial={{ effective_from: today() }}
        fields={[
          { name: 'code', label: 'Code' },
          { name: 'name', label: 'Name' },
          { name: 'effective_from', label: 'Effective from', type: 'date' },
          { name: 'base_component', label: 'Base component code', hint: 'Used as BASE in formulas.' },
          { name: 'codes', label: 'Component codes', textarea: true, hint: 'One per line or comma separated, in calculation order.' },
        ]}
        onSubmit={async (v) => {
          const codes = v.codes.split(/[\s,]+/).filter(Boolean);
          await send('POST', paths.structures, {
            code: v.code,
            name: v.name,
            effective_from: v.effective_from,
            rules: { base_component: v.base_component },
            components: codes.map((c, i) => ({ component_code: c, sequence: i + 1 })),
          });
          list.reload();
        }}
        success="Structure created as draft"
      />
      <ConfirmDialog
        open={Boolean(activate)}
        onClose={() => setActivate(null)}
        title={`Activate ${activate?.name ?? ''}?`}
        intro="Activating closes the previous version the day before its start date."
        confirmLabel="Activate"
        onConfirm={async () => {
          await send('POST', paths.structure(activate.uuid, 'activate'), {});
          toast('Structure activated');
          list.reload();
        }}
      />
    </Page>
  );
}

