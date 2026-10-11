import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, ErrorState, Skeleton } from '../../components/ui';
import { Amount, Banner, ListCard, Page, PurposeModal, Section, StatusBadge, Tiles, useDo } from '../../components/payroll/kit';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import { api } from '../../lib/api';
import { paths, query, send, titleCase, unwrap } from '../../lib/payrollApi';

function Explainer({ data, cur }) {
  const a = data.answers ?? {};
  const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  return (
    <Card title="Explanation" className="mb-5">
      <Section>
        {data.reconciles === false && <Banner tone="error">The components do not add up to the stored net pay.</Banner>}
        <p className="mt-0 text-xs">{data.equation}</p>
        {[
          ['Why this gross', a.why_gross],
          ['Why this net', a.why_net],
          ['Deductions', a.deductions],
          ['Attendance and leave inputs', a.attendance_leave_inputs],
        ].map(([label, v]) =>
          asList(v).length ? (
            <section key={label}>
              <h3 className="mb-1 mt-3 text-sm">{label}</h3>
              <ul className="m-0 list-disc pl-5 text-xs">
                {asList(v).map((x, i) => (
                  <li key={i}>{typeof x === 'string' ? x : (x.text ?? x.message ?? Object.values(x).filter((y) => typeof y !== 'object').join(' · '))}</li>
                ))}
              </ul>
            </section>
          ) : null,
        )}
        <p className="mb-0 mt-3 text-xs text-slate-500">
          Reproducible: {data.reproducible ? 'yes' : 'no'}. Currency {cur}.
        </p>
      </Section>
    </Card>
  );
}

function Difference({ data }) {
  if (!data.has_previous) return <Banner tone="info">There is no previous period to compare with.</Banner>;
  return (
    <Card title="Difference from previous period" className="mb-5">
      <Section>
        <Tiles
          items={[
            { label: 'Previous net', value: <Amount value={data.previous_net} currency={data.currency} /> },
            { label: 'Current net', value: <Amount value={data.current_net} currency={data.currency} /> },
            { label: 'Difference', value: <Amount value={data.difference} currency={data.currency} /> },
          ]}
        />
        <ListCard
          title="Drivers"
          list={{ loading: false, error: null, rows: data.drivers ?? [] }}
          rowKey={(r) => r.driver}
          columns={[
            { key: 'driver', label: 'Driver' },
            { key: 'effect', label: 'Effect on net', render: (r) => <Amount value={r.effect} currency={data.currency} /> },
          ]}
          mobile={{ title: 'driver', facts: [{ label: 'Effect', value: (r) => <Amount value={r.effect} currency={data.currency} /> }] }}
          empty={{ title: 'No drivers', description: 'Nothing changed between the two periods.' }}
        />
        <ListCard
          title="Components"
          list={{ loading: false, error: null, rows: data.components ?? [] }}
          rowKey={(r) => r.code}
          columns={[
            { key: 'name', label: 'Component', render: (r) => r.name ?? r.code },
            { key: 'previous', label: 'Previous', render: (r) => <Amount value={r.previous} currency={data.currency} /> },
            { key: 'current', label: 'Current', render: (r) => <Amount value={r.current} currency={data.currency} /> },
            { key: 'driver', label: 'Driver', priority: 'md' },
          ]}
          mobile={{ title: (r) => r.name ?? r.code, facts: [{ label: 'Previous', value: (r) => <Amount value={r.previous} currency={data.currency} /> }, { label: 'Current', value: (r) => <Amount value={r.current} currency={data.currency} /> }] }}
          empty={{ title: 'No component changes' }}
        />
      </Section>
    </Card>
  );
}

export default function EmployeeResultPage() {
  const { uuid, employeeUuid } = useParams();
  const { can } = useAuth();
  const res = useResource(paths.runResult(uuid, employeeUuid));
  const [ask, setAsk] = useState(null);
  const [explain, setExplain] = useState(null);
  const [diff, setDiff] = useState(null);
  const [proof, setProof] = useState(null);
  const { busy, run } = useDo();
  const d = res.data ? unwrap(res.data) : null;
  const cur = d?.current?.currency;
  const comps = d?.current?.components ?? [];
  const t = d?.current?.totals ?? d?.current ?? {};
  return (
    <Page permission="payroll.results.view" title="Employee result" description={d?.employee?.name ?? d?.current?.employee_name}>
      <p className="mt-0">
        <Link to={`/payroll/runs/${uuid}`} className="text-xs font-semibold text-brand-700 dark:text-brand-300">
          Back to run
        </Link>
      </p>
      {res.loading ? (
        <Skeleton rows={3} />
      ) : res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : (
        <>
          <Tiles
            items={[
              { label: 'Gross', value: <Amount value={t.gross} currency={cur} /> },
              { label: 'Deductions', value: <Amount value={t.total_deductions} currency={cur} /> },
              { label: 'Taxes', value: <Amount value={t.total_taxes} currency={cur} /> },
              { label: 'Net pay', value: <Amount value={t.net} currency={cur} /> },
            ]}
          />
          <div className="mb-4 flex flex-wrap gap-2">
            {can('payroll.explain') && (
              <>
                <Button variant="secondary" onClick={() => setAsk('explain')}>
                  Explain this result
                </Button>
                <Button variant="secondary" onClick={() => setAsk('difference')}>
                  Compare with previous period
                </Button>
              </>
            )}
            <Button
              variant="secondary"
              loading={busy === 'verify'}
              onClick={async () => setProof(unwrap(await run('verify', () => send('POST', paths.runResult(uuid, employeeUuid, 'verify'), {}))))}
            >
              Verify calculation
            </Button>
          </div>
          {proof && proof !== true && (
            <Banner tone={proof.reproducible && proof.intact ? 'success' : 'error'} title="Verification">
              {proof.reproducible && proof.intact ? 'The calculation reproduces exactly and the stored result is intact.' : 'The recalculation does not match the stored result. Do not lock this run.'}
            </Banner>
          )}
          {explain && <Explainer data={explain} cur={cur} />}
          {diff && <Difference data={diff} />}
          <ListCard
            title={`Components (version ${d?.current?.version ?? 1})`}
            list={{ loading: false, error: null, rows: comps }}
            rowKey={(r) => r.uuid ?? r.id ?? `${r.code}-${r.kind}-${r.amount}`}
            columns={[
              { key: 'name', label: 'Component', render: (r) => r.name ?? r.code },
              { key: 'kind', label: 'Type', render: (r) => titleCase(r.kind) },
              { key: 'amount', label: 'Amount', render: (r) => <Amount value={r.amount} currency={cur} /> },
              { key: 'formula', label: 'Formula', priority: 'lg', render: (r) => r.formula ?? '—' },
              { key: 'origin', label: 'Origin', priority: 'md', render: (r) => (r.origin ? titleCase(r.origin) : '—') },
            ]}
            mobile={{ title: (r) => r.name ?? r.code, badge: (r) => <StatusBadge value={r.kind} />, facts: [{ label: 'Amount', value: (r) => <Amount value={r.amount} currency={cur} /> }, { label: 'Origin', value: (r) => r.origin }] }}
            empty={{ title: 'No components', description: 'This employee has no calculated lines.' }}
          />
        </>
      )}
      <PurposeModal
        open={Boolean(ask)}
        onClose={() => setAsk(null)}
        submitLabel="Show"
        onSubmit={async (purpose) => {
          if (ask === 'explain') setExplain(unwrap(await api(`${paths.explain(employeeUuid)}?${query({ run: uuid, ...purpose })}`)));
          else setDiff(unwrap(await api(`${paths.differenceEmployee(employeeUuid)}?${query(purpose)}`)));
        }}
      />
    </Page>
  );
}
