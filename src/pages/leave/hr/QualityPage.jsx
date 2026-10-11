import { Link } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import { Card } from '../../../components/ui';
import { Banner, Screen, guarded } from '../../../components/timeoffice/parts';
import { ListCard, Section } from '../../../components/leave/hr/kit';
import { useAuth } from '../../../lib/auth';
import { HR, paths, useList } from '../../../lib/leaveHrApi';

const RULES = [
  ['leave_ledger_mismatch', 'A balance differs from the sum of its ledger entries'],
  ['leave_negative_beyond_limit', 'A balance is below its negative limit'],
  ['leave_no_policy', 'An employee has no policy covering today'],
  ['leave_stale_pending_request', 'A request has been pending too long'],
  ['leave_expired_lot_open', 'A lot past its expiry is still open'],
  ['leave_separated_with_balance', 'A separated employee still holds balance'],
  ['leave_unlock_waiting', 'An unlock request is waiting for a second person'],
];

const A = ({ to, children }) => (
  <Link to={to} className="font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
    {children}
  </Link>
);

function Step({ done, loading, error, label, to, count }) {
  const Icon = done ? CheckCircle2 : Circle;
  return (
    <li className="flex items-start gap-2 py-1.5 text-xs">
      <Icon size={16} className={done ? 'text-emerald-600' : 'text-slate-400'} aria-hidden="true" />
      <span>
        <A to={to}>{label}</A>{' '}
        <span className="text-slate-500 dark:text-slate-400">
          {loading ? 'Checking…' : error ? 'Could not check' : done ? `Done (${count})` : 'Not set up yet'}
        </span>
      </span>
    </li>
  );
}

function QualityPageInner() {
  const { can } = useAuth();
  const types = useList(`${paths.types}?active_only=1`);
  const policies = useList(paths.policies);
  const cycles = useList(paths.cycles);
  const live = policies.rows.filter((p) => (p.versions ?? []).some((v) => ['active', 'scheduled'].includes(v.status))).length;
  return (
    <Screen title="Data quality and setup" description="Check the leave set-up is complete and find records that need attention." permission="leave.manage|leave.reports.view|leave.policy.manage">
      <Card title="Set-up checklist" className="mb-5">
        <Section>
          <ul className="m-0 list-none p-0" aria-label="Set-up checklist">
            <Step label="Create leave types" to={`${HR}/types`} done={types.rows.length > 0} loading={types.loading} error={types.error} count={types.rows.length} />
            <Step label="Define a cycle" to={`${HR}/cycles`} done={cycles.rows.length > 0} loading={cycles.loading} error={cycles.error} count={cycles.rows.length} />
            <Step label="Publish a policy" to={`${HR}/policies`} done={live > 0} loading={policies.loading} error={policies.error} count={live} />
          </ul>
        </Section>
      </Card>
      <ListCard
        title="Leave data-quality rules"
        list={{ loading: false, error: null }}
        rows={RULES.map(([key, description]) => ({ key, description }))}
        rowKey={(r) => r.key}
        columns={[{ key: 'key', label: 'Rule', render: (r) => <code>{r.key}</code> }, { key: 'description', label: 'Finds' }]}
        mobile={{ title: 'description', subtitle: 'key' }}
        empty={{ title: 'No rules', description: '' }}
        extra={
          <div className="px-6">
            <Banner tone="info" title="Findings live in People">
              These rules run read-only and appear in the People data-quality screens and Action Center.{' '}
              {can('people.quality.view') ? (
                <>
                  Open <A to="/people/quality">Data quality</A> or the <A to="/people/action-center">People actions</A> list.
                </>
              ) : (
                'Ask someone with data-quality access to review the findings.'
              )}
            </Banner>
          </div>
        }
      />
      <Card title="Related screens" className="mb-5">
        <Section>
          <ul className="m-0 list-disc pl-5 text-xs">
            <li><A to={`${HR}/accruals`}>Accrual runs</A>: failed accruals are listed with reasons and can be retried.</li>
            <li><A to={`${HR}/locks`}>Locks</A>: unlock requests waiting for approval.</li>
            <li><A to={`${HR}/reports`}>Reports</A>: expiring balances and negative balances.</li>
          </ul>
        </Section>
      </Card>
    </Screen>
  );
}

export default guarded(QualityPageInner, { title: 'Data quality and setup', permission: 'leave.manage|leave.reports.view|leave.policy.manage' });
