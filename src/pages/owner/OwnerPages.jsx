import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, Clock, CheckCircle2, Hourglass, PauseCircle, Users } from 'lucide-react';
import { api, query } from '../../lib/api';
import { useResource, useDebounced } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, DataTable, ErrorState, FilterBar, Input, Modal, PageHeader, Pagination, Resource, Search, StatCard, Tabs, Textarea, useToast } from '../../components/ui';

const date = (v) => (v ? new Date(v).toLocaleString() : '—');
const label = (c) => (c.awaiting_approval ? 'awaiting approval' : c.status);
const tone = (c) => (c.awaiting_approval ? 'amber' : { active: 'green', trial: 'purple', suspended: 'amber', rejected: 'red', deactivated: 'red' }[c.status]);

function OwnerOnly({ children }) {
  const { session } = useAuth();
  if (!session.account?.is_owner) return <ErrorState error={{ status: 403, message: 'This area is only for the HRMS owner.' }} />;
  return children;
}

/** Which actions make sense for a company in its current state. */
const actionsFor = (c) =>
  c.awaiting_approval
    ? ['approve', 'reject']
    : { trial: ['suspend', 'deactivate'], active: ['suspend', 'deactivate'], suspended: ['activate', 'reject'], rejected: ['activate'], deactivated: ['activate'] }[c.status] || [];
const verbs = { approve: 'Approve', reject: 'Reject', suspend: 'Suspend', activate: 'Activate', deactivate: 'Deactivate' };

function ActionDialog({ company, action, onClose, onDone }) {
  const [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    toast = useToast();
  return (
    <Modal open onClose={onClose} title={`${verbs[action]} ${company.name}?`}>
      <Textarea label="Note (optional, shown to the company)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      {error && <p className="mb-3 text-xs text-rose-700 dark:text-rose-300">{error.message}</p>}
      <div className="mt-4 flex justify-end gap-2.5">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={['reject', 'deactivate', 'suspend'].includes(action) ? 'danger' : 'primary'}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api(`/owner/companies/${company.id}/${action}`, { method: 'POST', body: { note: note || null } });
              toast(`${company.name}: ${verbs[action].toLowerCase()} done.`);
              onDone();
            } catch (e) {
              setError(e);
              setBusy(false);
            }
          }}
        >
          {verbs[action]}
        </Button>
      </div>
    </Modal>
  );
}

const tabs = [
  ['', 'All'],
  ['awaiting_approval', 'Awaiting approval'],
  ['trial', 'On trial'],
  ['active', 'Active'],
  ['suspended', 'Suspended'],
  ['rejected', 'Rejected'],
  ['deactivated', 'Deactivated'],
].map(([value, label]) => ({ value, label }));

export function OwnerPanelPage() {
  const [status, setStatus] = useState(''),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [dialog, setDialog] = useState(null);
  const q = useDebounced(search);
  const overview = useResource('/owner/overview');
  const list = useResource(`/owner/companies?${query({ status, search: q, page })}`);
  const done = () => {
    setDialog(null);
    overview.reload();
    list.reload();
  };
  return (
    <OwnerOnly>
      <PageHeader eyebrow="HRMS OWNER" title="Owner panel" description="Every company on the platform: trials, approvals, subscriptions and access." />
      <Resource resource={overview}>
        {(o) => (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 min-[769px]:grid-cols-3 min-[1100px]:grid-cols-6">
              <StatCard label="Companies" value={o.counts.total} detail={`${o.new_last_7_days} new this week`} icon={Building2} />
              <StatCard label="On trial" value={o.counts.trial} detail={`${o.system.trial_hours}-hour free trial`} icon={Clock} />
              <StatCard label="Awaiting approval" value={o.counts.awaiting_approval} detail="Trial ended" icon={Hourglass} />
              <StatCard label="Active" value={o.counts.active} detail="Approved" icon={CheckCircle2} />
              <StatCard label="Suspended / rejected" value={o.counts.suspended + o.counts.rejected + o.counts.deactivated} detail="No access" icon={PauseCircle} />
              <StatCard label="Users" value={o.users} detail="Across all companies" icon={Users} />
            </div>
          </>
        )}
      </Resource>
      <Card title="Companies">
        <Tabs
          items={tabs}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
        <FilterBar>
          <Search value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search company or workspace…" />
        </FilterBar>
        <Resource resource={list}>
          {(d) => (
            <>
              <DataTable
                rows={d.data}
                empty={{ title: 'No companies match', description: 'Registered companies appear here.' }}
                columns={[
                  { key: 'name', label: 'Company', render: (c) => <Link className="font-semibold text-brand-700 dark:text-brand-300" to={`/owner/companies/${c.id}`}>{c.name}<small className="block font-normal text-slate-500">{c.slug} · {c.admin_email}</small></Link> },
                  { key: 'status', label: 'Status', render: (c) => <Badge tone={tone(c)}>{label(c)}</Badge> },
                  { key: 'plan', label: 'Plan' },
                  { key: 'trial_ends_at', label: 'Trial ends', render: (c) => date(c.trial_ends_at) },
                  { key: 'users_count', label: 'Users' },
                  { key: 'created_at', label: 'Registered', render: (c) => date(c.created_at) },
                  { key: 'actions', label: 'Actions', render: (c) => (
                    <div className="flex flex-wrap gap-2">
                      {actionsFor(c).map((a) => (
                        <Button key={a} variant={a === 'approve' ? 'primary' : 'secondary'} className="min-h-8 px-3 py-1.5" onClick={() => setDialog({ company: c, action: a })}>
                          {verbs[a]}
                        </Button>
                      ))}
                    </div>
                  ) },
                ]}
              />
              <Pagination data={d} onChange={setPage} />
            </>
          )}
        </Resource>
      </Card>
      <Resource resource={overview}>
        {(o) => (
          <div className="mt-6 grid gap-6 min-[1100px]:grid-cols-2">
            <Card title="Recent activity across the platform">
              <DataTable
                rows={o.activity}
                empty={{ title: 'No activity yet' }}
                columns={[
                  { key: 'created_at', label: 'When', render: (r) => date(r.created_at) },
                  { key: 'company', label: 'Company' },
                  { key: 'actor', label: 'Who' },
                  { key: 'action', label: 'Action', render: (r) => `${r.module} · ${r.action}` },
                ]}
              />
            </Card>
            <Card title="System information">
              <dl className="grid grid-cols-2 gap-3 px-6 pb-6 text-xs [&_dt]:text-slate-500 [&_dd]:m-0 [&_dd]:font-medium">
                {[['Environment', o.system.environment], ['Laravel', o.system.laravel], ['PHP', o.system.php], ['Database', o.system.database], ['Server time', date(o.system.time)], ['Free trial length', `${o.system.trial_hours} hours`]].map(([k, v]) => (
                  <div key={k} className="contents"><dt>{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            </Card>
          </div>
        )}
      </Resource>
      {dialog && <ActionDialog {...dialog} onClose={() => setDialog(null)} onDone={done} />}
    </OwnerOnly>
  );
}

export function OwnerCompanyPage() {
  const { id } = useParams(),
    navigate = useNavigate(),
    toast = useToast();
  const res = useResource(`/owner/companies/${id}`);
  const [dialog, setDialog] = useState(null),
    [hours, setHours] = useState(24),
    [sub, setSub] = useState(null),
    [busy, setBusy] = useState(false);
  const run = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      res.reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <OwnerOnly>
      <Resource resource={res}>
        {(c) => {
          const s = sub ?? { plan: c.plan, subscription_ends_at: c.subscription_ends_at ? c.subscription_ends_at.slice(0, 10) : '', modules: c.modules };
          const toggle = (m) => setSub({ ...s, modules: s.modules.includes(m) ? s.modules.filter((x) => x !== m) : [...s.modules, m] });
          return (
            <>
              <PageHeader
                eyebrow="OWNER PANEL"
                title={c.name}
                description={`${c.slug} · registered ${date(c.created_at)}`}
                action={<Badge tone={tone(c)}>{label(c)}</Badge>}
              />
              <div className="mb-6 grid gap-6 min-[1100px]:grid-cols-2">
                <Card title="Account status">
                  <div className="space-y-3 px-6 pb-6 text-xs">
                    <p>Trial: {date(c.trial_started_at)} → {date(c.trial_ends_at)}</p>
                    <p>Approved: {date(c.approved_at)}</p>
                    {c.status_note && <p>Note: {c.status_note}</p>}
                    <div className="flex flex-wrap gap-2">
                      {actionsFor(c).map((a) => (
                        <Button key={a} variant={a === 'approve' ? 'primary' : 'secondary'} onClick={() => setDialog(a)}>
                          {verbs[a]}
                        </Button>
                      ))}
                    </div>
                    <div className="flex items-end gap-2 pt-2">
                      <Input label="Extend / restart trial (hours)" type="number" min={1} max={720} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
                      <Button className="mb-5" variant="secondary" loading={busy} onClick={() => run(() => api(`/owner/companies/${c.id}/extend-trial`, { method: 'POST', body: { hours } }), 'Trial extended.')}>
                        Extend trial
                      </Button>
                    </div>
                  </div>
                </Card>
                <Card title="Subscription and access">
                  <div className="px-6 pb-6">
                    <Input label="Plan" value={s.plan} onChange={(e) => setSub({ ...s, plan: e.target.value })} />
                    <Input label="Subscription ends" type="date" value={s.subscription_ends_at} onChange={(e) => setSub({ ...s, subscription_ends_at: e.target.value })} />
                    <span className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">Modules this company can use</span>
                    <div className="mb-5 flex flex-wrap gap-2">
                      {c.available_modules.map((m) => (
                        <button key={m} type="button" aria-pressed={s.modules.includes(m)} onClick={() => toggle(m)} className={`rounded-md border px-2.5 py-1 text-xs ${s.modules.includes(m) ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                    <Button loading={busy} onClick={() => run(() => api(`/owner/companies/${c.id}/subscription`, { method: 'PUT', body: { plan: s.plan, subscription_ends_at: s.subscription_ends_at || null, modules: s.modules } }).then(() => setSub(null)), 'Subscription saved.')}>
                      Save subscription
                    </Button>
                  </div>
                </Card>
              </div>
              <Card title={`Users (${c.users.length})`}>
                <DataTable
                  rows={c.users}
                  empty={{ title: 'No users' }}
                  columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'email', label: 'Email' },
                    { key: 'role', label: 'Role', render: (u) => (
                      <select
                        aria-label={`Role for ${u.email}`}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                        value={u.roles[0]?.id ?? ''}
                        onChange={(e) => run(() => api(`/owner/users/${u.id}/role`, { method: 'PUT', body: { role_id: Number(e.target.value) } }), 'Role updated.')}
                      >
                        {!u.roles[0] && <option value="">No role</option>}
                        {c.roles.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    ) },
                    { key: 'active', label: 'Status', render: (u) => <Badge tone={u.active ? 'green' : 'red'}>{u.active ? 'active' : 'inactive'}</Badge> },
                    { key: 'actions', label: '', render: (u) => (
                      <Button variant="secondary" className="min-h-8 px-3 py-1.5" onClick={() => run(() => api(`/owner/users/${u.id}/active`, { method: 'PUT', body: { active: !u.active } }), u.active ? 'User deactivated.' : 'User activated.')}>
                        {u.active ? 'Deactivate' : 'Activate'}
                      </Button>
                    ) },
                  ]}
                />
              </Card>
              <div className="mt-6">
                <Button variant="secondary" onClick={() => navigate('/owner')}>Back to all companies</Button>
              </div>
              {dialog && <ActionDialog company={c} action={dialog} onClose={() => setDialog(null)} onDone={() => { setDialog(null); res.reload(); }} />}
            </>
          );
        }}
      </Resource>
    </OwnerOnly>
  );
}
