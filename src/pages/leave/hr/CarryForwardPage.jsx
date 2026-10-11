import { useState } from 'react';
import { Button, Card, Checkbox, FormError, Input, useToast } from '../../../components/ui';
import ResponsiveList from '../../../components/ResponsiveList';
import { Banner, Screen, StatusBadge, guarded } from '../../../components/timeoffice/parts';
import { ConfirmPreview, ListCard, Section, Tiles } from '../../../components/leave/hr/kit';
import { useAuth } from '../../../lib/auth';
import { dateOnly, paths, send, titleCase, today, unwrap, units, useAction, useList } from '../../../lib/leaveHrApi';

const emp = (e) => e?.name ?? e?.employee_number ?? (typeof e === 'string' ? e : '—');
const code = (t) => t?.code ?? (typeof t === 'string' ? t : '—');

function CarryItems({ items }) {
  return (
    <div className="max-h-64 overflow-y-auto">
      <ResponsiveList
        label="Carry-forward items"
        rows={items}
        rowKey={(i) => `${emp(i.employee)}-${code(i.leave_type)}`}
        columns={[
          { key: 'employee', label: 'Employee', render: (i) => emp(i.employee) },
          { key: 'leave_type', label: 'Type', render: (i) => code(i.leave_type) },
          { key: 'mode', label: 'Mode', priority: 'md', render: (i) => titleCase(i.mode) },
          { key: 'eligible_units', label: 'Eligible', render: (i) => units(i.eligible_units) },
          { key: 'carried_units', label: 'Carried', render: (i) => units(i.carried_units) },
          { key: 'forfeited_units', label: 'Forfeited', render: (i) => units(i.forfeited_units) },
          { key: 'valid_until', label: 'Valid until', priority: 'lg', render: (i) => dateOnly(i.valid_until) },
          { key: 'status', label: 'Result', render: (i) => <StatusBadge status={i.status}>{i.status === 'skipped' && i.calculation?.reason ? `Skipped: ${titleCase(i.calculation.reason)}` : undefined}</StatusBadge> },
        ]}
        mobile={{ title: (i) => emp(i.employee), subtitle: (i) => code(i.leave_type), badge: (i) => <StatusBadge status={i.status} />, facts: [{ label: 'Carried', value: (i) => units(i.carried_units) }, { label: 'Forfeited', value: (i) => units(i.forfeited_units) }] }}
        empty={{ title: 'Nothing to carry forward', description: 'No account is eligible on this date.' }}
      />
    </div>
  );
}

function CarryForwardPanel({ canRun }) {
  const toast = useToast();
  const [asOf, setAsOf] = useState(today());
  const [open, setOpen] = useState(null);
  return (
    <Card title="Carry-forward" className="mb-5">
      <Section>
        <p className="mt-0 text-xs text-slate-500 dark:text-slate-400">Moves unused balance into the next period under each policy's carry-forward rule. Accounts with open reservations are skipped and retried on the next run.</p>
        <Input label="As of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        <Button disabled={!canRun || !asOf} onClick={() => setOpen({ as_of: asOf })}>Preview carry-forward</Button>
        {!canRun && <small className="ml-3 text-slate-500">You can view but not run carry-forward.</small>}
      </Section>
      <ConfirmPreview
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title="Confirm carry-forward"
        intro="Carried units become ledger lots with their own validity. Forfeited units expire. This cannot be run twice for the same date."
        load={async () => unwrap(await send('POST', paths.carryForwardPreview, open))}
        blocked={(d) => ((d.items ?? []).length === 0 ? 'No account is eligible for carry-forward.' : null)}
        confirmLabel="Run carry-forward"
        onConfirm={async () => {
          const r = unwrap(await send('POST', paths.carryForwardRun, open));
          toast(`Carry-forward complete${r?.run_key ? ` (run ${r.run_key})` : ''}`);
        }}
      >
        {(d) => {
          const items = d.items ?? [];
          return (
            <>
              <Tiles items={[{ label: 'Accounts', value: items.length }, { label: 'Skipped', value: items.filter((i) => i.status === 'skipped').length }, { label: 'Run key', value: d.run_key }]} />
              <CarryItems items={items} />
            </>
          );
        }}
      </ConfirmPreview>
    </Card>
  );
}

function ExpiryPanel({ canRun }) {
  const toast = useToast();
  const [asOf, setAsOf] = useState(today());
  const [dry, setDry] = useState(true);
  const [result, setResult] = useState(null);
  const { busy, error, run } = useAction();
  return (
    <Card title="Expire lapsed balance" className="mb-5">
      <Section>
        <p className="mt-0 text-xs text-slate-500 dark:text-slate-400">Expires lots past their valid date and sends upcoming-expiry alerts. Run as a dry run first to see the effect.</p>
        <FormError error={error} />
        <Input label="As of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        <div className="mb-4"><Checkbox label="Dry run (change nothing)" checked={dry} onChange={(e) => setDry(e.target.checked)} /></div>
        <Button
          disabled={!canRun}
          loading={busy}
          onClick={async () => {
            const r = await run(async () => unwrap(await send('POST', paths.expiriesProcess, { as_of: asOf, dry_run: dry })));
            if (r) {
              setResult({ ...r, dry });
              toast(dry ? 'Dry run complete. Nothing was changed.' : 'Expiry processed');
            }
          }}
        >
          {dry ? 'Run dry run' : 'Process expiry'}
        </Button>
        {result && (
          <div className="mt-4" data-testid="expiry-result">
            <Banner tone={result.dry ? 'info' : 'success'} title={result.dry ? 'Dry run result (nothing changed)' : 'Expiry processed'}>
              {units(result.expired)} lots expired covering {units(result.units)} units.
            </Banner>
          </div>
        )}
      </Section>
    </Card>
  );
}

function CarryForwardPageInner() {
  const { can } = useAuth();
  const canRun = can('leave.accrual.run|leave.manage');
  const exp = useList(paths.expiries);
  return (
    <Screen title="Carry-forward and expiry" description="Close out a period: carry balance forward, expire what has lapsed." permission="leave.accrual.run|leave.manage">
      <div className="grid gap-5 lg:grid-cols-2">
        <CarryForwardPanel canRun={canRun} />
        <ExpiryPanel canRun={canRun} />
      </div>
      <ListCard
        title="Upcoming expiries"
        list={exp}
        columns={[
          { key: 'employee', label: 'Employee', render: (e) => emp(e.employee) },
          { key: 'leave_type', label: 'Type', render: (e) => code(e.leave_type) },
          { key: 'units', label: 'Units', render: (e) => units(e.units) },
          { key: 'expires_on', label: 'Expires', render: (e) => dateOnly(e.expires_on) },
        ]}
        rowKey={(e) => e.entry_id ?? e.id ?? `${emp(e.employee)}-${e.expires_on}-${e.units}`}
        mobile={{ title: (e) => emp(e.employee), subtitle: (e) => `${code(e.leave_type)} · ${units(e.units)}`, facts: [{ label: 'Expires', value: (e) => dateOnly(e.expires_on) }] }}
        empty={{ title: 'Nothing expiring soon', description: 'Lots with an expiry date appear here.' }}
      />
    </Screen>
  );
}

export default guarded(CarryForwardPageInner, { title: 'Carry-forward and expiry', permission: 'leave.accrual.run|leave.manage' });
