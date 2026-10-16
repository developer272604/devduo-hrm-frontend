import { useState } from 'react';
import { Badge, Button, Card, EmptyState, ErrorState, FormError, Input, Modal, PageHeader, Skeleton, Tabs, Textarea } from '../../components/ui';
import { send, useAction, useList } from '../../lib/timeOfficeApi';
import { useAuth } from '../../lib/auth';

const T = '/v1/learning/talent';
const label = (s) => String(s).replace(/_/g, ' ');
const tone = { interested: 'neutral', shortlisted: 'purple', awaiting_manager: 'amber', placed: 'green', completed: 'green', declined: 'neutral', withdrawn: 'neutral', release_denied: 'amber', ended_early: 'amber', open: 'green', draft: 'neutral', filled: 'purple', closed: 'neutral', cancelled: 'neutral' };

export const scorePct = (m) => `${Math.round((m?.score ?? 0) * 100)}%`;

function ReasonDialog({ title, required = true, onClose, onSubmit, children }) {
  const [reason, setReason] = useState('');
  const act = useAction();
  return (
    <Modal open onClose={() => onClose(false)} title={title}>
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act.run(() => onSubmit(reason))) onClose(true);
        }}
      >
        <FormError error={act.error} />
        {children}
        <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required={required} />
        <Button type="submit" loading={act.busy}>
          Save
        </Button>
      </form>
    </Modal>
  );
}

function MatchSummary({ match }) {
  if (!match) return null;
  return (
    <div className="space-y-1 text-xs">
      <p className="m-0 flex flex-wrap items-center gap-2">
        <Badge tone={match.eligible ? 'green' : 'amber'}>{match.eligible ? 'meets required skills' : 'skill gap'}</Badge>
        <span>Match {scorePct(match)}</span>
      </p>
      {match.met.length > 0 && <p className="m-0 text-slate-600 dark:text-slate-300">You have: {match.met.map((m) => `${m.skill} (${m.has})`).join(', ')}</p>}
      {match.gaps.map((g) => (
        <p key={g.skill_uuid} className="m-0 text-amber-800 dark:text-amber-200">
          Gap: {g.skill} needs {g.required}, you have {g.has}
          {g.mandatory ? ' (required)' : ' (nice to have)'}
          {g.courses?.length ? `. Courses that can help: ${g.courses.map((c) => c.title).join(', ')}` : ''}
        </p>
      ))}
    </div>
  );
}

function ProfileCard({ profile, onSaved }) {
  const [discoverable, setDiscoverable] = useState(profile.discoverable);
  const [hours, setHours] = useState(String(profile.spare_hours_per_week));
  const act = useAction();
  return (
    <Card title="My availability" className="mb-4">
      <div className="space-y-3 p-5 text-xs">
        <FormError error={act.error} />
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-brand-500" checked={discoverable} onChange={(e) => setDiscoverable(e.target.checked)} />
          Let colleagues who post opportunities find me
        </label>
        <Input label="Spare hours per week I can give" type="number" min="0" max="60" value={hours} onChange={(e) => setHours(e.target.value)} />
        <p className="m-0 text-slate-500">
          {profile.committed_hours} hours already committed, {profile.free_hours} free. {profile.privacy}
        </p>
        <Button
          loading={act.busy}
          onClick={async () => {
            if (await act.run(() => send('PUT', `${T}/my/profile`, { discoverable, spare_hours_per_week: Number(hours) }))) onSaved();
          }}
        >
          Save availability
        </Button>
      </div>
    </Card>
  );
}

function ApplyDialog({ item, onClose }) {
  const [note, setNote] = useState('');
  const act = useAction();
  return (
    <Modal open onClose={() => onClose(false)} title={`Express interest: ${item.title}`}>
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act.run(() => send('POST', `${T}/opportunities/${item.uuid}/apply`, { note }))) onClose(true);
        }}
      >
        <FormError error={act.error} />
        <p className="m-0 text-xs text-slate-600 dark:text-slate-300">The poster reviews your interest, and your manager must release you before you are placed.</p>
        <Textarea label="Why are you interested? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" loading={act.busy}>
          Send interest
        </Button>
      </form>
    </Modal>
  );
}

function BrowseTab() {
  const list = useList(`${T}/opportunities`);
  const [applying, setApplying] = useState(null);
  const d = list.data;
  if (list.loading) return <Skeleton />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  return (
    <>
      <ProfileCard key={JSON.stringify(d.profile)} profile={d.profile} onSaved={list.reload} />
      <Card title="Open opportunities">
        {d.items.length ? (
          <ul className="m-0 list-none space-y-3 p-5">
            {d.items.map((o) => (
              <li key={o.uuid} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <strong className="text-sm">{o.title}</strong>
                  <Badge>{label(o.kind)}</Badge>
                  <span className="text-xs text-slate-500">
                    {o.hours_per_week} h/week · from {o.starts_on}
                    {o.ends_on ? ` to ${o.ends_on}` : ''} · {o.openings - o.placed} of {o.openings} open · posted by {o.posted_by}
                  </span>
                </div>
                {o.description && <p className="m-0 mb-2 text-xs text-slate-600 dark:text-slate-300">{o.description}</p>}
                <p className="m-0 mb-2 text-xs">Skills: {o.skills.map((s) => `${s.skill} (${s.required}${s.mandatory ? ', required' : ''})`).join(', ') || 'none listed'}</p>
                <MatchSummary match={o.match} />
                <div className="mt-3">
                  {o.my_application ? (
                    <Badge tone={tone[o.my_application.status]}>Your response: {label(o.my_application.status)}</Badge>
                  ) : (
                    <Button variant="secondary" onClick={() => setApplying(o)}>
                      I'm interested
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing open right now" description="New internal opportunities will appear here." />
        )}
        <p className="m-0 px-5 pb-5 text-xs text-slate-500">{d.limitations}</p>
      </Card>
      {applying && (
        <ApplyDialog
          item={applying}
          onClose={async (ok) => {
            setApplying(null);
            if (ok) await list.reload();
          }}
        />
      )}
    </>
  );
}

function MineTab() {
  const list = useList(`${T}/my/applications`);
  const act = useAction();
  if (list.loading) return <Skeleton />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  const items = list.data.items;
  return (
    <Card title="My responses">
      <FormError error={act.error} />
      {items.length ? (
        <ul className="m-0 list-none space-y-3 p-5">
          {items.map((a) => (
            <li key={a.uuid} className="rounded-lg border border-slate-200 p-4 text-xs dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-sm">{a.opportunity.title}</strong>
                <Badge tone={tone[a.status]}>{label(a.status)}</Badge>
                <span className="text-slate-500">{a.opportunity.hours_per_week} h/week</span>
              </div>
              {a.decision_reason && <p className="m-0 mt-1">Reason: {a.decision_reason}</p>}
              {a.attested_skills?.length > 0 && <p className="m-0 mt-1">Evidence recorded for {a.attested_skills.length} skill(s). Ask your manager to validate your skill level.</p>}
              {['interested', 'shortlisted', 'awaiting_manager'].includes(a.status) && (
                <Button
                  className="mt-2"
                  variant="secondary"
                  onClick={async () => {
                    if (await act.run(() => send('POST', `${T}/applications/${a.uuid}/withdraw`, {}))) await list.reload();
                  }}
                >
                  Withdraw
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No responses yet" description="Opportunities you show interest in will be tracked here." />
      )}
    </Card>
  );
}

function CreateDialog({ onClose }) {
  const skills = useList('/v1/learning/skills');
  const levels = useList('/v1/learning/skill-levels');
  const [f, setF] = useState({ title: '', description: '', kind: 'project', hours_per_week: '5', starts_on: '', ends_on: '', openings: '1', skills: [] });
  const act = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setSkill = (i, patch) => setF({ ...f, skills: f.skills.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const sel = 'mt-1 block min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900';
  return (
    <Modal open onClose={() => onClose(false)} title="New internal opportunity">
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = {
            title: f.title,
            description: f.description || null,
            kind: f.kind,
            hours_per_week: Number(f.hours_per_week),
            starts_on: f.starts_on,
            ends_on: f.ends_on || null,
            openings: Number(f.openings),
            skills: f.skills.filter((s) => s.skill_uuid).map((s) => ({ skill_uuid: s.skill_uuid, required_rank: Number(s.required_rank), mandatory: s.mandatory })),
          };
          if (await act.run(() => send('POST', `${T}/opportunities`, body))) onClose(true);
        }}
      >
        <FormError error={act.error} />
        <Input label="Title" value={f.title} onChange={set('title')} required />
        <Textarea label="What is the work?" value={f.description} onChange={set('description')} />
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-xs font-semibold">
            Type
            <select value={f.kind} onChange={set('kind')} className={sel}>
              {['project', 'gig', 'stretch', 'role_trial'].map((k) => (
                <option key={k} value={k}>
                  {label(k)}
                </option>
              ))}
            </select>
          </label>
          <Input label="Hours per week" type="number" min="1" max="60" value={f.hours_per_week} onChange={set('hours_per_week')} required />
          <Input label="People needed" type="number" min="1" value={f.openings} onChange={set('openings')} />
          <Input label="Starts on" type="date" value={f.starts_on} onChange={set('starts_on')} required />
          <Input label="Ends on (optional)" type="date" value={f.ends_on} onChange={set('ends_on')} />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold">Skills needed</legend>
          {f.skills.map((s, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-4">
              <select aria-label="Skill" value={s.skill_uuid} onChange={(e) => setSkill(i, { skill_uuid: e.target.value })} className={sel}>
                <option value="">Choose a skill</option>
                {skills.rows.map((k) => (
                  <option key={k.uuid} value={k.uuid}>
                    {k.name}
                  </option>
                ))}
              </select>
              <select aria-label="Level" value={s.required_rank} onChange={(e) => setSkill(i, { required_rank: e.target.value })} className={sel}>
                {(levels.rows.length ? levels.rows : [{ rank: 1, name: 'Level 1' }]).map((l) => (
                  <option key={l.rank} value={l.rank}>
                    {l.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" className="size-4 accent-brand-500" checked={s.mandatory} onChange={(e) => setSkill(i, { mandatory: e.target.checked })} />
                Required
              </label>
              <Button type="button" variant="secondary" onClick={() => setF({ ...f, skills: f.skills.filter((_, j) => j !== i) })}>
                Remove
              </Button>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={() => setF({ ...f, skills: [...f.skills, { skill_uuid: '', required_rank: '2', mandatory: true }] })}>
            Add skill
          </Button>
        </fieldset>
        <Button type="submit" loading={act.busy}>
          Save as draft
        </Button>
      </form>
    </Modal>
  );
}

function Candidates({ opp, onClose }) {
  const c = useList(`${T}/opportunities/${opp.uuid}/candidates`);
  const [dialog, setDialog] = useState(null);
  const act = useAction();
  const call = (path, body = {}) => async () => {
    if (await act.run(() => send('POST', `${T}/${path}`, body))) await c.reload();
  };
  return (
    <Modal open onClose={onClose} title={`Candidates: ${opp.title}`} drawer>
      {c.loading ? (
        <Skeleton rows={3} />
      ) : c.error ? (
        <ErrorState error={c.error} onRetry={c.reload} />
      ) : (
        <div className="space-y-4 p-5 text-xs">
          <FormError error={act.error} />
          <h3 className="m-0 text-xs font-semibold">Responses ({c.data.applicants.length})</h3>
          {c.data.applicants.map((a) => (
            <div key={a.uuid} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="m-0 flex flex-wrap items-center gap-2">
                <strong>{a.employee.name}</strong>
                <Badge tone={tone[a.status]}>{label(a.status)}</Badge>
                <span>Match {scorePct(a.match)}</span>
                <span className="text-slate-500">{a.free_hours} free h/week</span>
              </p>
              {a.note && <p className="m-0 mt-1">"{a.note}"</p>}
              {a.match.gaps.length > 0 && <p className="m-0 mt-1 text-amber-800 dark:text-amber-200">Gaps: {a.match.gaps.map((g) => g.skill).join(', ')}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {a.status === 'interested' && <Button variant="secondary" onClick={call(`applications/${a.uuid}/shortlist`)}>Shortlist</Button>}
                {a.status === 'shortlisted' && <Button variant="secondary" onClick={call(`applications/${a.uuid}/propose`)}>Ask manager to release</Button>}
                {['interested', 'shortlisted'].includes(a.status) && <Button variant="secondary" onClick={() => setDialog({ type: 'decline', a })}>Decline</Button>}
                {a.status === 'placed' && (
                  <>
                    <Button variant="secondary" onClick={call(`applications/${a.uuid}/complete`, { skills: opp.skills.map((s) => s.skill_uuid) })}>Mark complete and record skills used</Button>
                    <Button variant="secondary" onClick={() => setDialog({ type: 'end-early', a })}>End early</Button>
                  </>
                )}
              </div>
            </div>
          ))}
          <h3 className="m-0 text-xs font-semibold">Opted-in colleagues who fit ({c.data.discoverable.length})</h3>
          {c.data.discoverable.map((p) => (
            <p key={p.employee.uuid} className="m-0">
              {p.employee.name} · Match {scorePct(p.match)} · {p.free_hours} free h/week
            </p>
          ))}
          <p className="m-0 text-slate-500">{c.data.privacy}</p>
        </div>
      )}
      {dialog && (
        <ReasonDialog
          title={dialog.type === 'decline' ? 'Decline this response' : 'End this placement early'}
          onClose={async (ok) => {
            setDialog(null);
            if (ok) await c.reload();
          }}
          onSubmit={(reason) => send('POST', `${T}/applications/${dialog.a.uuid}/${dialog.type}`, { reason })}
        />
      )}
    </Modal>
  );
}

function PostedTab() {
  const list = useList(`${T}/posted`);
  const [creating, setCreating] = useState(false);
  const [cand, setCand] = useState(null);
  const [dialog, setDialog] = useState(null);
  const act = useAction();
  if (list.loading) return <Skeleton />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  const setStatus = (o, status) => async () => {
    if (await act.run(() => send('POST', `${T}/opportunities/${o.uuid}/status`, { status }))) await list.reload();
  };
  return (
    <Card title="Opportunities I posted" action={<Button onClick={() => setCreating(true)}>New opportunity</Button>}>
      <FormError error={act.error} />
      {list.data.items.length ? (
        <ul className="m-0 list-none space-y-3 p-5">
          {list.data.items.map((o) => (
            <li key={o.uuid} className="rounded-lg border border-slate-200 p-4 text-xs dark:border-slate-700">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <strong className="text-sm">{o.title}</strong>
                <Badge tone={tone[o.status]}>{o.status}</Badge>
                <span>
                  {o.placed} of {o.openings} placed · {o.applicants} active responses
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {o.status === 'draft' && <Button variant="secondary" onClick={setStatus(o, 'open')}>Publish</Button>}
                {o.status !== 'draft' && o.status !== 'cancelled' && <Button variant="secondary" onClick={() => setCand(o)}>Candidates</Button>}
                {o.status === 'open' && <Button variant="secondary" onClick={setStatus(o, 'closed')}>Close</Button>}
                {['draft', 'open', 'closed', 'filled'].includes(o.status) && <Button variant="secondary" onClick={() => setDialog(o)}>Cancel</Button>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nothing posted" description="Post work that needs people from other teams." />
      )}
      {creating && (
        <CreateDialog
          onClose={async (ok) => {
            setCreating(false);
            if (ok) await list.reload();
          }}
        />
      )}
      {cand && <Candidates opp={cand} onClose={() => { setCand(null); list.reload(); }} />}
      {dialog && (
        <ReasonDialog
          title="Cancel this opportunity"
          onClose={async (ok) => {
            setDialog(null);
            if (ok) await list.reload();
          }}
          onSubmit={(reason) => send('POST', `${T}/opportunities/${dialog.uuid}/status`, { status: 'cancelled', reason })}
        />
      )}
    </Card>
  );
}

function ApprovalsTab() {
  const list = useList(`${T}/approvals`);
  const [refuse, setRefuse] = useState(null);
  const act = useAction();
  if (list.loading) return <Skeleton />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  return (
    <Card title="Release requests">
      <FormError error={act.error} />
      {list.data.items.length ? (
        <ul className="m-0 list-none space-y-3 p-5">
          {list.data.items.map((a) => (
            <li key={a.uuid} className="rounded-lg border border-slate-200 p-4 text-xs dark:border-slate-700">
              <p className="m-0 mb-1">
                <strong className="text-sm">{a.employee.name}</strong> for "{a.opportunity.title}": {a.opportunity.hours_per_week} h/week from {a.opportunity.starts_on}
                {a.opportunity.ends_on ? ` to ${a.opportunity.ends_on}` : ''}. Match {scorePct(a.match)} · {a.free_hours} free h/week.
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  loading={act.busy}
                  onClick={async () => {
                    if (await act.run(() => send('POST', `${T}/applications/${a.uuid}/release`, { approve: true }))) await list.reload();
                  }}
                >
                  Release
                </Button>
                <Button variant="secondary" onClick={() => setRefuse(a)}>
                  Not now
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No requests waiting" description="When someone on your team is proposed for an opportunity, you decide here." />
      )}
      {refuse && (
        <ReasonDialog
          title="Refuse this release"
          onClose={async (ok) => {
            setRefuse(null);
            if (ok) await list.reload();
          }}
          onSubmit={(reason) => send('POST', `${T}/applications/${refuse.uuid}/release`, { approve: false, reason })}
        />
      )}
    </Card>
  );
}

export function TalentPage() {
  const { can } = useAuth();
  const tabs = [];
  if (can('talent.self')) tabs.push({ value: 'browse', label: 'Open opportunities' }, { value: 'mine', label: 'My responses' });
  if (can('talent.post|talent.manage')) tabs.push({ value: 'posted', label: 'Posted by me' });
  if (can('talent.approve|talent.manage')) tabs.push({ value: 'approvals', label: 'Release requests' });
  const [tab, setTab] = useState(tabs[0]?.value);
  return (
    <>
      <PageHeader eyebrow="LEARNING · INTERNAL MOBILITY" title="Internal opportunities" description="Find work inside the company that fits your skills. You choose whether to be found, and your manager releases your time." />
      {tabs.length ? <Tabs items={tabs} value={tab} onChange={setTab} /> : <EmptyState title="No access" description="You do not have access to internal opportunities." />}
      <div className="mt-5">
        {tab === 'browse' && <BrowseTab />}
        {tab === 'mine' && <MineTab />}
        {tab === 'posted' && <PostedTab />}
        {tab === 'approvals' && <ApprovalsTab />}
      </div>
    </>
  );
}
