import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, ErrorState, Skeleton } from '../../components/ui';
import { Amount, Banner, FormModal, KeyValues, ListCard, Page, Pill, Section, StatusBadge, Tiles, useDo } from '../../components/payroll/kit';
import { api, download } from '../../lib/api';
import { useResource } from '../../lib/hooks';
import { API_BASE, paths, query, send, titleCase, unwrap, useList, newKey } from '../../lib/payrollApi';

const periodLabel = (p) => (p && typeof p === 'object' ? (p.label ?? `${p.start} to ${p.end}`) : (p ?? '—'));

export function MyPayslipsPage() {
  const list = useList(paths.mePayslips);
  const nav = useNavigate();
  return (
    <Page permission="payroll.payslips.view_own" title="My payslips" description="Published payslips for your pay periods.">
      <ListCard
        title="Payslips"
        list={list}
        onRowClick={(r) => nav(`/payroll/my/payslips/${r.uuid}`)}
        columns={[
          { key: 'period', label: 'Period', render: (r) => periodLabel(r.period) },
          { key: 'net', label: 'Net pay', render: (r) => <Amount value={r.net} currency={r.currency} /> },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          { key: 'published_at', label: 'Published', priority: 'md', render: (r) => r.published_at?.slice(0, 10) ?? '—' },
          { key: 'version', label: 'Version', priority: 'lg' },
        ]}
        mobile={{ title: (r) => periodLabel(r.period), badge: (r) => <StatusBadge value={r.status} />, facts: [{ label: 'Net pay', value: (r) => <Amount value={r.net} currency={r.currency} /> }, { label: 'Published', value: (r) => r.published_at?.slice(0, 10) }] }}
        empty={{ title: 'No payslips yet', description: 'Your payslips appear here once payroll publishes them.' }}
      />
    </Page>
  );
}

const GROUPS = [
  ['earnings', 'Earnings'],
  ['reimbursements', 'Reimbursements'],
  ['deductions', 'Deductions'],
  ['taxes', 'Taxes'],
  ['employee_contributions', 'Employee contributions'],
  ['employer_contributions', 'Employer contributions'],
];

/** Snapshot renderer shared by the employee and the payroll team view. */
export function PayslipSnapshot({ snapshot }) {
  if (!snapshot) return null;
  const cur = snapshot.currency;
  return (
    <>
      <Tiles
        items={[
          { label: 'Gross', value: <Amount value={snapshot.totals?.gross} currency={cur} /> },
          { label: 'Deductions', value: <Amount value={snapshot.totals?.deductions} currency={cur} /> },
          { label: 'Taxes', value: <Amount value={snapshot.totals?.taxes} currency={cur} /> },
          { label: 'Net pay', value: <Amount value={snapshot.totals?.net} currency={cur} /> },
        ]}
      />
      <KeyValues data={{ payable_days: snapshot.payable_days, working_days: snapshot.working_days, country: snapshot.country, result_version: snapshot.result_version }} />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {GROUPS.map(([key, label]) => {
          const lines = snapshot.lines?.[key] ?? [];
          if (!lines.length) return null;
          return (
            <section key={key} aria-label={label}>
              <h3 className="mb-1 mt-0 text-sm">{label}</h3>
              <ul className="m-0 list-none divide-y divide-slate-100 p-0 text-xs dark:divide-slate-800">
                {lines.map((l, i) => (
                  <li key={`${l.code}-${i}`} className="flex justify-between gap-3 py-1.5">
                    <span>{l.name ?? l.code}</span>
                    <Amount value={l.amount} currency={cur} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {snapshot.ytd && (
        <p className="mb-0 mt-4 text-xs text-slate-500 dark:text-slate-400">
          Year to date ({snapshot.ytd.periods} periods): gross <Amount value={snapshot.ytd.gross} currency={cur} />, net <Amount value={snapshot.ytd.net} currency={cur} />
        </p>
      )}
      {snapshot.bank && (
        <p className="mb-0 mt-2 text-xs text-slate-500 dark:text-slate-400">
          Paid to {snapshot.bank.bank_name} {snapshot.bank.account}
        </p>
      )}
    </>
  );
}

export function MyPayslipDetailPage() {
  const { uuid } = useParams();
  const res = useResource(paths.mePayslip(uuid));
  const { busy, run } = useDo();
  const d = res.data ? unwrap(res.data) : null;
  async function downloadIt() {
    await run('dl', async () => {
      const link = unwrap(await send('POST', paths.mePayslip(uuid, 'download-link')));
      const base = API_BASE();
      // The link is a short-lived signed URL relative to the host; the download helper adds the API base itself.
      const rel = link.url.startsWith(base) ? link.url.slice(base.length) : link.url;
      await download(rel, `payslip-${uuid}.html`);
    }, 'Download started');
  }
  return (
    <Page permission="payroll.payslips.view_own" title="Payslip" description={d ? periodLabel(d.period) : undefined}>
      <p className="mt-0">
        <Link to="/payroll/my/payslips" className="text-xs font-semibold text-brand-700 dark:text-brand-300">
          Back to my payslips
        </Link>
      </p>
      {res.loading ? (
        <Skeleton rows={3} />
      ) : res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : (
        <Card
          title={`${periodLabel(d.period)} · version ${d.version ?? 1}`}
          action={
            <div className="flex items-center gap-2">
              <a
                className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-brand-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-brand-950"
                href={`${API_BASE()}${paths.mePayslip(uuid, 'print')}`}
                target="_blank"
                rel="noreferrer"
              >
                Print view
              </a>
              <Button variant="secondary" loading={busy === 'dl'} onClick={downloadIt}>
                Download
              </Button>
            </div>
          }
        >
          <Section>
            {d.status === 'superseded' && <Banner tone="warn">A newer version of this payslip exists. This one is kept for your records.</Banner>}
            <PayslipSnapshot snapshot={d.snapshot ? { currency: d.currency, ...d.snapshot } : null} />
          </Section>
        </Card>
      )}
    </Page>
  );
}

export function MyCompensationPage() {
  const res = useResource(paths.meCompensation);
  const d = res.data ? unwrap(res.data) : null;
  const c = d?.compensation;
  return (
    <Page permission="payroll.compensation.view_own" title="My compensation" description="Your current pay structure. Viewing is logged.">
      {res.loading ? (
        <Skeleton rows={3} />
      ) : res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : !d.available || !c ? (
        <Card>
          <Section>
            <p className="m-0 text-sm">Your compensation is not available to view yet. Contact payroll if you expected to see it here.</p>
          </Section>
        </Card>
      ) : (
        <Card title={`Effective from ${c.effective_from ?? '—'}`}>
          <Section>
            <Tiles
              items={[
                { label: 'Base pay', value: <Amount value={c.base_pay} currency={c.currency} />, detail: c.pay_frequency && titleCase(c.pay_frequency) },
                { label: 'Gross reference', value: <Amount value={c.gross_reference} currency={c.currency} /> },
                { label: 'Annual', value: <Amount value={c.annual_compensation} currency={c.currency} /> },
              ]}
            />
            <ul className="m-0 list-none divide-y divide-slate-100 p-0 text-xs dark:divide-slate-800" aria-label="Components">
              {(c.components ?? []).map((x) => (
                <li key={x.code} className="flex justify-between gap-3 py-1.5">
                  <span>
                    {x.name ?? x.code} <Pill>{titleCase(x.kind)}</Pill>
                  </span>
                  <Amount value={x.amount} currency={c.currency} />
                </li>
              ))}
            </ul>
          </Section>
        </Card>
      )}
    </Page>
  );
}

export function MyBenefitsPage() {
  const available = useList(paths.benefitPlansAvailable);
  const enrollments = useList(paths.meBenefits);
  const [plan, setPlan] = useState(null);
  const [ending, setEnding] = useState(null);
  return <Page permission="payroll.benefits.view_own|payroll.benefits.enroll_own" title="My benefits" description="Review eligible plans and track your enrollment requests.">
    <ListCard title="Available plans" list={available} columns={[
      { key: 'name', label: 'Plan' }, { key: 'category', label: 'Category', render: (r) => titleCase(r.category) }, { key: 'currency', label: 'Currency' },
      { key: 'windows', label: 'Enrollment', render: (r) => r.windows?.map((w) => `${w.name} (${w.closes_on})`).join(', ') || 'Closed' },
      { key: 'act', label: '', render: (r) => <Button disabled={!r.windows?.length} onClick={() => setPlan(r)}>Enroll</Button> },
    ]} empty={{ title: 'No plans available', description: 'Eligible plans appear during their enrollment window.' }} />
    <ListCard title="My enrollment requests" list={enrollments} columns={[
      { key: 'plan', label: 'Plan' }, { key: 'category', label: 'Category', render: (r) => titleCase(r.category) }, { key: 'effective_from', label: 'Effective' }, { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
      { key: 'ending', label: '', render: (r) => r.status === 'active' ? <Button variant="secondary" onClick={() => setEnding(r)}>Request end</Button> : null },
    ]} empty={{ title: 'No enrollments', description: 'Your submitted and active benefits will appear here.' }} />
    <FormModal open={Boolean(plan)} onClose={() => setPlan(null)} title={`Enroll in ${plan?.name ?? 'benefit'}`} intro="Your contribution follows the plan rules. Your request is sent for independent review." initial={{ window_uuid: plan?.windows?.[0]?.uuid ?? '' }} fields={[
      { name: 'window_uuid', label: 'Enrollment window', options: plan?.windows?.map((w) => ({ value: w.uuid, label: `${w.name} · effective ${w.effective_on}` })) ?? [] },
    ]} onSubmit={async (v) => {
      await api(paths.enrollBenefit(plan.uuid), { method: 'POST', body: v });
      enrollments.reload();
    }} success="Enrollment submitted for review" />
    <FormModal open={Boolean(ending)} onClose={() => setEnding(null)} title={`End ${ending?.plan ?? 'benefit'} coverage`} intro="A benefits manager must review your request. Coverage stays active until approved." fields={[
      { name: 'effective_to', label: 'Coverage end date', type: 'date' },
    ]} onSubmit={async (v) => {
      await api(paths.meBenefitTermination(ending.uuid), { method: 'POST', body: v });
      enrollments.reload();
    }} success="Termination request submitted for review" />
  </Page>;
}

export function MyLoansPage() {
  const res = useResource(paths.meLoans);
  const d = res.data ? unwrap(res.data) : null;
  return (
    <Page permission="payroll.loans.view_own" title="Loans and advances" description="Balances and recovery schedules.">
      {res.loading ? (
        <Skeleton rows={3} />
      ) : res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : (
        <>
          <ListCard
            title="Loans"
            list={{ loading: false, error: null, rows: d.loans ?? [] }}
            columns={[
              { key: 'purpose', label: 'Loan', render: (r) => r.purpose ?? r.uuid?.slice(0, 8) },
              { key: 'outstanding', label: 'Outstanding', render: (r) => <Amount value={r.outstanding} currency={r.currency} /> },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
              { key: 'installments', label: 'Installments left', priority: 'md', render: (r) => (r.schedule ?? []).filter((s) => s.status !== 'recovered' && s.status !== 'paid').length },
            ]}
            mobile={{ title: (r) => r.purpose ?? 'Loan', badge: (r) => <StatusBadge value={r.status} />, facts: [{ label: 'Outstanding', value: (r) => <Amount value={r.outstanding} currency={r.currency} /> }] }}
            empty={{ title: 'No loans', description: 'You have no loans on record.' }}
          />
          <ListCard
            title="Advances"
            list={{ loading: false, error: null, rows: d.advances ?? [] }}
            columns={[
              { key: 'reason', label: 'Advance', render: (r) => r.reason ?? r.uuid?.slice(0, 8) },
              { key: 'outstanding', label: 'Outstanding', render: (r) => <Amount value={r.outstanding} currency={r.currency} /> },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
            ]}
            mobile={{ title: (r) => r.reason ?? 'Advance', badge: (r) => <StatusBadge value={r.status} />, facts: [{ label: 'Outstanding', value: (r) => <Amount value={r.outstanding} currency={r.currency} /> }] }}
            empty={{ title: 'No advances', description: 'You have no salary advances on record.' }}
          />
        </>
      )}
    </Page>
  );
}

export function MyTaxPage() {
  const windows = useList(paths.meTaxWindows);
  const declarations = useList(paths.meTaxDeclarations);
  const [win, setWin] = useState(null);
  const [schema, setSchema] = useState(null);
  const [schemaError, setSchemaError] = useState(null);
  useEffect(() => {
    if (!win) return undefined;
    let live = true;
    setSchema(null);
    setSchemaError(null);
    api(`${paths.meTaxSchema}?${query({ pack_uuid: win.pack_uuid })}`)
      .then((r) => live && setSchema(unwrap(r)))
      .catch((e) => live && setSchemaError(e));
    return () => {
      live = false;
    };
  }, [win]);
  const fields = schema?.fields?.length ? schema.fields : [{ key: 'declared_amount', label: 'Declared amount', type: 'decimal', required: true }];
  const regimes = schema?.regimes ?? [];
  return (
    <Page permission="payroll.tax_declaration.submit" title="Tax declaration" description="Submit your declaration while the window is open. Sensitive values are masked after submission.">
      <ListCard
        title="Declaration windows"
        list={windows}
        columns={[
          { key: 'name', label: 'Pack' },
          { key: 'tax_year', label: 'Tax year' },
          { key: 'window', label: 'Window', render: (r) => `${r.opens_on} to ${r.closes_on}` },
          { key: 'open', label: 'Status', render: (r) => <StatusBadge value={r.open ? 'open' : 'closed'} /> },
          { key: 'act', label: '', render: (r) => (r.open ? <Button variant="secondary" onClick={() => setWin(r)}>Declare</Button> : null) },
        ]}
        card={(r) => (
          <div className="flex items-start justify-between gap-2">
            <div>
              <strong className="text-sm">{r.name}</strong>
              <p className="m-0 text-xs text-slate-500">
                {r.tax_year} · {r.opens_on} to {r.closes_on}
              </p>
            </div>
            {r.open ? <Button variant="secondary" onClick={() => setWin(r)}>Declare</Button> : <StatusBadge value="closed" />}
          </div>
        )}
        empty={{ title: 'No open windows', description: 'Declaration windows appear here when payroll opens them.' }}
      />
      <ListCard
        title="My declarations"
        list={declarations}
        columns={[
          { key: 'tax_year', label: 'Tax year' },
          { key: 'regime', label: 'Regime', render: (r) => r.regime ?? '—' },
          { key: 'version', label: 'Version' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
        ]}
        mobile={{ title: (r) => `Tax year ${r.tax_year}`, badge: (r) => <StatusBadge value={r.status} />, facts: [{ label: 'Version', value: 'version' }] }}
        empty={{ title: 'Nothing submitted', description: 'Your submitted declarations appear here.' }}
      />
      <FormModal
        open={Boolean(win)}
        onClose={() => setWin(null)}
        title={`Declaration for ${win?.tax_year ?? ''}`}
        intro="Each submission creates a new version. Review the values before submitting."
        initial={{ regime: regimes[0]?.value ?? regimes[0] ?? '' }}
        submitLabel="Submit declaration"
        fields={[
          ...(regimes.length ? [{ name: 'regime', label: 'Regime', options: regimes.map((r) => (typeof r === 'object' ? { value: r.value ?? r.code, label: r.label ?? r.name } : r)) }] : []),
          ...fields.map((f) => ({ name: `data.${f.key}`, label: f.label ?? f.key, required: f.required, options: f.options?.length ? f.options.map((o) => (typeof o === 'object' ? { value: o.value, label: o.label } : o)) : undefined })),
        ]}
        onSubmit={async (v) => {
          const data = {};
          fields.forEach((f) => {
            if (v[`data.${f.key}`] !== undefined && v[`data.${f.key}`] !== '') data[f.key] = String(v[`data.${f.key}`]);
          });
          await api(paths.meTaxDeclarations, { method: 'POST', body: { pack_uuid: win.pack_uuid, tax_year: win.tax_year, ...(v.regime ? { regime: v.regime } : {}), data }, headers: { 'Idempotency-Key': newKey() } });
          declarations.reload();
        }}
        success="Declaration submitted"
      >
        {schemaError && <ErrorState error={schemaError} />}
      </FormModal>
    </Page>
  );
}
