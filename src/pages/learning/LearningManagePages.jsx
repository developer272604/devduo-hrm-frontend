import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card, DataTable, ErrorState, Input, Modal, MultiSelect, PageHeader, Select, Skeleton } from '../../components/ui';
import Access from '../../components/Access';
import { FormModal, StatusBadge, useDo } from '../../components/payroll/kit';
import { API_BASE, learningPaths as paths, send, useList } from '../../lib/learningApi';
import { useAuth } from '../../lib/auth';

const Body = ({ children }) => <div className="px-6 pb-6">{children}</div>;
const dash = (v) => (v === null || v === undefined || v === '' ? '—' : v);
const opts = (rows, value = 'uuid', label = 'name') => rows.map((r) => ({ value: r[value], label: r[label] ?? r.title }));
const linkClass = 'inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-brand-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-brand-950';

function Page({ permission, title, description, action, children }) {
  return (
    <Access permission={permission} module="learning">
      <PageHeader title={title} description={description} action={action} />
      {children}
    </Access>
  );
}

function Loaded({ list, children }) {
  if (list.loading) return <Skeleton />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  return children;
}

/* ---------- Team enrolments: assign, approve/reject, attendance, completion ---------- */

function AssignModal({ open, onClose, onDone }) {
  const lookups = useList(open ? paths.lookups : null);
  const courses = useList(open ? `${paths.courses}?per_page=100` : null);
  const [course, setCourse] = useState('');
  const [people, setPeople] = useState([]);
  const [group, setGroup] = useState('');
  const [due, setDue] = useState('');
  const actions = useDo();
  const l = lookups.data ?? {};
  const published = courses.rows.filter((c) => c.status === 'published');
  async function submit(e) {
    e.preventDefault();
    const body = { course_uuid: course, ...(people.length ? { employee_uuids: people } : {}), ...(group ? { group_id: Number(group) } : {}), ...(due ? { due_on: due } : {}) };
    const r = await actions.run('assign', () => send('POST', paths.assignCourse, body), 'Course assigned');
    if (r) {
      onDone(r);
      onClose();
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Assign a course">
      <form onSubmit={submit}>
        <Select label="Course" required value={course} onChange={(e) => setCourse(e.target.value)} options={opts(published, 'uuid', 'title')} />
        <MultiSelect label="Employees" options={opts(l.employees ?? [])} value={people} onChange={setPeople} />
        <Select label="Or a group" value={group} onChange={(e) => setGroup(e.target.value)} options={[{ value: '', label: 'No group' }, ...opts(l.groups ?? [], 'id')]} />
        <Input label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={actions.busy === 'assign'}>Assign</Button>
        </div>
      </form>
    </Modal>
  );
}

export function TeamLearningPage() {
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const list = useList(`${paths.enrolments}${status ? `?status=${status}` : ''}`);
  const [dialog, setDialog] = useState(null);
  const [assign, setAssign] = useState(false);
  const actions = useDo();
  const decide = async (row, decision, note) => {
    const r = await actions.run(row.uuid, () => send('POST', paths.enrolment(row.uuid, 'decision'), { decision, ...(note ? { note } : {}) }), decision === 'approve' ? 'Enrolment approved' : 'Enrolment rejected');
    if (r) list.reload();
    return r;
  };
  const columns = [
    { key: 'employee', label: 'Employee', render: (r) => r.employee?.name ?? '—' },
    { key: 'course', label: 'Course', render: (r) => r.course?.title ?? '—' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
    { key: 'due_on', label: 'Due' },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div className="flex flex-wrap justify-end gap-2">
          {r.status === 'pending_approval' && can('learning.enrol.approve') && (
            <>
              <Button variant="secondary" disabled={Boolean(actions.busy)} onClick={() => decide(r, 'approve')}>Approve</Button>
              <Button variant="secondary" onClick={() => setDialog({ type: 'reject', row: r })}>Reject</Button>
            </>
          )}
          {['enrolled', 'in_progress'].includes(r.status) && can('learning.enrol.manage') && (
            <>
              {r.session && <Button variant="secondary" onClick={() => setDialog({ type: 'attendance', row: r })}>Attendance</Button>}
              <Button variant="secondary" onClick={() => setDialog({ type: 'complete', row: r })}>Mark complete</Button>
            </>
          )}
        </div>
      ),
    },
  ];
  return (
    <Page permission="learning.enrol.manage|learning.enrol.approve|learning.view" title="Team learning" description="Assign courses, decide enrolment requests and record attendance and completion for people in your scope." action={can('learning.enrol.manage') && <Button onClick={() => setAssign(true)}>Assign course</Button>}>
      <Card title="Enrolments" action={<Select label="" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: '', label: 'All statuses' }, ...['pending_approval', 'enrolled', 'in_progress', 'waitlisted', 'completed', 'failed', 'rejected'].map((s) => ({ value: s, label: s.replace('_', ' ') }))]} />}>
        <Loaded list={list}>
          <DataTable columns={columns} rows={list.rows.map((r) => ({ ...r, id: r.uuid }))} empty={{ title: 'No enrolments', description: 'Nothing matches the current filter.' }} />
        </Loaded>
      </Card>
      <AssignModal open={assign} onClose={() => setAssign(false)} onDone={() => list.reload()} />
      <FormModal open={dialog?.type === 'reject'} onClose={() => setDialog(null)} title="Reject enrolment" intro="Give the employee a reason." fields={[{ name: 'note', label: 'Reason', textarea: true, minLength: 5 }]} submitLabel="Reject" onSubmit={async (v) => { const r = await send('POST', paths.enrolment(dialog.row.uuid, 'decision'), { decision: 'reject', note: v.note }); list.reload(); return r; }} success="Enrolment rejected" />
      <FormModal open={dialog?.type === 'attendance'} onClose={() => setDialog(null)} title="Mark attendance" initial={{ present: true }} fields={[{ name: 'session_date', label: 'Session date', type: 'date' }, { name: 'present', label: 'Present', type: 'checkbox' }]} onSubmit={async (v) => { const r = await send('POST', paths.enrolment(dialog.row.uuid, 'attendance'), { session_date: v.session_date, present: Boolean(v.present) }); list.reload(); return r; }} success="Attendance saved" />
      <FormModal open={dialog?.type === 'complete'} onClose={() => setDialog(null)} title="Record completion" intro="Leave the score empty when the course has no score." fields={[{ name: 'score', label: 'Score (%)', type: 'number', required: false }, { name: 'passed', label: 'Passed', type: 'checkbox' }]} initial={{ passed: true }} onSubmit={async (v) => { const body = { passed: Boolean(v.passed), ...(v.score !== undefined && v.score !== '' ? { score: Number(v.score) } : {}) }; const r = await send('POST', paths.enrolment(dialog.row.uuid, 'complete'), body); list.reload(); return r; }} success="Completion recorded" />
    </Page>
  );
}

/* ---------- Compliance ---------- */

export function CompliancePage() {
  const { can } = useAuth();
  const manage = can('learning.assign.manage');
  const status = useList(paths.complianceStatus);
  const rules = useList(manage ? paths.rules : null);
  const overdue = useList(manage ? `${paths.assignments}?status=assigned` : null);
  const lookups = useList(manage ? paths.lookups : null);
  const courses = useList(manage ? `${paths.courses}?per_page=100` : null);
  const [create, setCreate] = useState(false);
  const [waive, setWaive] = useState(null);
  const actions = useDo();
  const s = status.data?.summary;
  const l = lookups.data ?? {};
  const none = { value: '', label: 'Any' };
  return (
    <Page permission="learning.assign.manage|learning.view" title="Compliance training" description="Mandatory courses by role, department or country, with due dates, escalation and per-person status." action={manage && (
      <div className="flex gap-2">
        <Button variant="secondary" loading={actions.busy === 'run'} onClick={async () => { const r = await actions.run('run', () => send('POST', paths.complianceRun, {}), 'Compliance run finished'); if (r) { status.reload(); overdue.reload(); } }}>Run now</Button>
        <Button onClick={() => setCreate(true)}>Add rule</Button>
      </div>
    )}>
      <Loaded list={status}>
        {s && (
          <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card><Body><p className="m-0 text-xs text-slate-500">People with assignments</p><p className="m-0 text-2xl font-semibold">{s.employees}</p></Body></Card>
            <Card><Body><p className="m-0 text-xs text-slate-500">Overdue people</p><p className="m-0 text-2xl font-semibold">{s.overdue_employees}</p></Body></Card>
            <Card><Body><p className="m-0 text-xs text-slate-500">Completed</p><p className="m-0 text-2xl font-semibold">{s.completed} / {s.assignments}</p></Body></Card>
            <Card><Body><p className="m-0 text-xs text-slate-500">Compliance</p><p className="m-0 text-2xl font-semibold">{s.compliance_pct}%</p></Body></Card>
          </div>
        )}
        <Card title="Compliance by person" className="mb-5">
          <DataTable
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => r.employee?.name ?? '—' },
              { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'overdue' ? 'amber' : r.status === 'compliant' ? 'green' : 'neutral'}>{r.status.replace('_', ' ')}</Badge> },
              { key: 'progress', label: 'Completed', render: (r) => `${r.completed} of ${r.total}` },
              { key: 'overdue', label: 'Overdue' },
              { key: 'next_due', label: 'Next due', render: (r) => dash(r.next_due) },
            ]}
            rows={(status.data?.rows ?? []).map((r, i) => ({ ...r, id: r.employee?.uuid ?? i }))}
            empty={{ title: 'No mandatory training assigned', description: 'Rules assign courses automatically when they run.' }}
          />
        </Card>
      </Loaded>
      {manage && (
        <>
          <Card title="Rules" className="mb-5">
            <Loaded list={rules}>
              <DataTable
                columns={[
                  { key: 'name', label: 'Rule' },
                  { key: 'course', label: 'Course', render: (r) => r.course?.title ?? '—' },
                  { key: 'due_days', label: 'Due (days)' },
                  { key: 'recurrence_months', label: 'Repeats (months)', render: (r) => dash(r.recurrence_months) },
                  { key: 'country', label: 'Country', render: (r) => dash(r.country) },
                  { key: 'active', label: 'State', render: (r) => <StatusBadge value={r.active ? 'active' : 'draft'} /> },
                ]}
                rows={rules.rows.map((r) => ({ ...r, id: r.uuid }))}
                empty={{ title: 'No rules yet', description: 'Add a rule to assign mandatory training automatically.' }}
              />
            </Loaded>
          </Card>
          <Card title="Open assignments">
            <Loaded list={overdue}>
              <DataTable
                columns={[
                  { key: 'employee', label: 'Employee', render: (r) => r.employee?.name ?? '—' },
                  { key: 'course', label: 'Course', render: (r) => r.course?.title ?? '—' },
                  { key: 'due_on', label: 'Due', render: (r) => (r.overdue ? <Badge tone="amber">{r.due_on} overdue</Badge> : r.due_on) },
                  { key: 'actions', label: 'Actions', render: (r) => <Button variant="secondary" onClick={() => setWaive(r)}>Waive</Button> },
                ]}
                rows={overdue.rows.map((r) => ({ ...r, id: r.uuid }))}
                empty={{ title: 'No open assignments' }}
              />
            </Loaded>
          </Card>
          <FormModal open={create} onClose={() => setCreate(false)} title="Add a compliance rule" intro="People matching every filter you choose are assigned the course when the rule runs." initial={{ due_days: 30, escalation_days: 3 }} fields={[
            { name: 'name', label: 'Rule name' },
            { name: 'course_uuid', label: 'Course', options: opts(courses.rows.filter((c) => c.status === 'published'), 'uuid', 'title') },
            { name: 'designation_id', label: 'Designation', required: false, options: [none, ...opts(l.designations ?? [], 'id')] },
            { name: 'department_id', label: 'Department', required: false, options: [none, ...opts(l.departments ?? [], 'id')] },
            { name: 'legal_entity_id', label: 'Legal entity', required: false, options: [none, ...opts(l.legal_entities ?? [], 'id')] },
            { name: 'country', label: 'Country (2-letter code)', required: false },
            { name: 'due_days', label: 'Due within (days)', type: 'number' },
            { name: 'recurrence_months', label: 'Repeat every (months)', type: 'number', required: false },
            { name: 'escalation_days', label: 'Escalate to manager after (days overdue)', type: 'number' },
          ]} onSubmit={async (v) => { const body = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '' && x !== undefined)); const r = await send('POST', paths.rules, body); rules.reload(); return r; }} success="Rule created" />
          <FormModal open={Boolean(waive)} onClose={() => setWaive(null)} title="Waive assignment" intro="The reason is kept in the audit log." fields={[{ name: 'reason', label: 'Reason', textarea: true, minLength: 5 }]} submitLabel="Waive" onSubmit={async (v) => { const r = await send('POST', paths.waive(waive.uuid), { reason: v.reason }); overdue.reload(); status.reload(); return r; }} success="Assignment waived" />
        </>
      )}
    </Page>
  );
}

/* ---------- Assessment ---------- */

export function AssessmentPage() {
  const { courseUuid } = useParams();
  const quiz = useList(paths.assessment(courseUuid));
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const actions = useDo();
  const a = quiz.data;
  const toggle = (q, i) => setAnswers((x) => {
    const cur = x[q.id] ?? [];
    if (!q.multiple) return { ...x, [q.id]: [i] };
    return { ...x, [q.id]: cur.includes(i) ? cur.filter((n) => n !== i) : [...cur, i] };
  });
  async function submit(e) {
    e.preventDefault();
    const r = await actions.run('attempt', () => send('POST', paths.attempts(a.uuid), { answers }), 'Answers submitted');
    if (r) { setResult(r); quiz.reload(); }
  }
  return (
    <Page permission="learning.self" title="Assessment" description="Answers are scored by the server when you submit.">
      <Loaded list={quiz}>
        {a && (
          <Card title={a.title} action={<span className="text-xs text-slate-500">Pass mark {a.pass_percent}% · {a.attempts_remaining === null ? 'Unlimited attempts' : `${a.attempts_remaining} attempt(s) left`}</span>}>
            {result && (
              <Body>
                <div role="status" className={`mb-4 rounded-lg border p-4 text-sm ${result.passed ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'}`}>
                  {result.passed ? 'Passed' : 'Not passed'} with {result.percent}% (attempt {result.attempt_no}).{result.course_completed ? ' The course is complete.' : ''}{result.note ? ` ${result.note}` : ''}
                </div>
              </Body>
            )}
            <form onSubmit={submit}>
              {a.questions.map((q, n) => (
                <fieldset key={q.id} className="mb-5 border-0 p-0">
                  <legend className="mb-2 text-sm font-semibold">
                    {n + 1}. {q.text} {q.multiple && <span className="font-normal text-slate-500">(select all that apply)</span>}
                    {result?.results && <Badge tone={result.results[q.id] ? 'green' : 'amber'}>{result.results[q.id] ? 'Correct' : 'Incorrect'}</Badge>}
                  </legend>
                  {q.options.map((o, i) => (
                    <label key={i} className="mb-1 flex min-h-10 items-center gap-2 text-sm">
                      <input type={q.multiple ? 'checkbox' : 'radio'} name={q.id} checked={(answers[q.id] ?? []).includes(i)} onChange={() => toggle(q, i)} className="accent-brand-500" />
                      {o}
                    </label>
                  ))}
                </fieldset>
              ))}
              <Button type="submit" loading={actions.busy === 'attempt'} disabled={a.attempts_remaining === 0}>Submit answers</Button>
            </form>
          </Card>
        )}
        {quiz.error?.status === 404 && null}
      </Loaded>
      <p className="mt-4 text-sm"><Link className="text-brand-700 dark:text-brand-300" to="/learning/my">Back to my learning</Link></p>
    </Page>
  );
}

/* ---------- Certificates ---------- */

export function CertificatesPage() {
  const { can } = useAuth();
  const mine = useList(can('learning.self') ? paths.myCertificates : null);
  const team = useList(can('learning.view') ? paths.certificates : null);
  const defs = useList(can('learning.catalog.manage') ? paths.certifications : null);
  const [create, setCreate] = useState(false);
  const print = (c) => <a className={linkClass} href={`${API_BASE()}${paths.certificatePrint(c.uuid)}`} target="_blank" rel="noreferrer">Print view</a>;
  const cols = (who) => [
    ...(who ? [{ key: 'employee', label: 'Employee', render: (r) => r.employee?.name ?? '—' }] : []),
    { key: 'certification', label: 'Certificate', render: (r) => r.certification?.name },
    { key: 'issued_on', label: 'Issued' },
    { key: 'expires_on', label: 'Expires', render: (r) => (r.expires_on ? `${r.expires_on}${r.days_to_expiry !== null && r.days_to_expiry >= 0 && r.days_to_expiry <= 60 ? ` (${r.days_to_expiry} days)` : ''}` : 'No expiry') },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
    { key: 'print', label: '', render: print },
  ];
  return (
    <Page permission="learning.self|learning.view|learning.catalog.manage" title="Certificates" description="Certificates issued on completion, with expiry and renewal reminders." action={can('learning.catalog.manage') && <Button onClick={() => setCreate(true)}>Add certification</Button>}>
      {can('learning.self') && <Card title="My certificates" className="mb-5"><Loaded list={mine}><DataTable columns={cols(false)} rows={mine.rows.map((r) => ({ ...r, id: r.uuid }))} empty={{ title: 'No certificates yet', description: 'Complete a certifying course to earn one.' }} /></Loaded></Card>}
      {can('learning.view') && <Card title="Team certificates" className="mb-5"><Loaded list={team}><DataTable columns={cols(true)} rows={team.rows.map((r) => ({ ...r, id: r.uuid }))} empty={{ title: 'No certificates in your scope' }} /></Loaded></Card>}
      {can('learning.catalog.manage') && (
        <Card title="Certification types">
          <Loaded list={defs}>
            <DataTable columns={[{ key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'validity_months', label: 'Valid (months)', render: (r) => dash(r.validity_months) }, { key: 'reminder_days', label: 'Reminders (days before)', render: (r) => (r.reminder_days ?? []).join(', ') }]} rows={defs.rows.map((r) => ({ ...r, id: r.uuid }))} empty={{ title: 'No certification types' }} />
          </Loaded>
        </Card>
      )}
      <FormModal open={create} onClose={() => setCreate(false)} title="Add a certification" intro="Link it to a course by its certification code when you edit the course." fields={[{ name: 'code', label: 'Code' }, { name: 'name', label: 'Name' }, { name: 'issuer', label: 'Issuer', required: false }, { name: 'validity_months', label: 'Valid for (months)', type: 'number', required: false }]} onSubmit={async (v) => { const body = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '' && x !== undefined)); const r = await send('POST', paths.certifications, body); defs.reload(); return r; }} success="Certification created" />
    </Page>
  );
}

/* ---------- Skills administration ---------- */

export function SkillsAdminPage() {
  const cats = useList(paths.skillCategories);
  const skills = useList(paths.skillsAdmin);
  const levels = useList(paths.levels);
  const reqs = useList(paths.requirements);
  const lookups = useList(paths.lookups);
  const [dialog, setDialog] = useState(null);
  const [scale, setScale] = useState(null);
  const actions = useDo();
  const l = lookups.data ?? {};
  const scaleRows = scale ?? levels.rows;
  return (
    <Page permission="learning.skills.manage" title="Skills administration" description="Skill categories, skills, the proficiency scale and the skills each role requires.">
      <Card title="Categories" action={<Button variant="secondary" onClick={() => setDialog('category')}>Add category</Button>} className="mb-5">
        <Loaded list={cats}><Body><ul className="m-0 list-none p-0 text-sm">{cats.rows.map((c) => <li key={c.uuid} className="py-1">{c.name} <span className="text-xs text-slate-500">({c.skills} skills)</span></li>)}{!cats.rows.length && <li>No categories yet.</li>}</ul></Body></Loaded>
      </Card>
      <Card title="Skills" action={<Button variant="secondary" onClick={() => setDialog('skill')}>Add skill</Button>} className="mb-5">
        <Loaded list={skills}><DataTable columns={[{ key: 'name', label: 'Skill' }, { key: 'category', label: 'Category', render: (r) => dash(r.category) }, { key: 'active', label: 'State', render: (r) => <StatusBadge value={r.active ? 'active' : 'draft'} /> }]} rows={skills.rows.map((r) => ({ ...r, id: r.uuid }))} empty={{ title: 'No skills yet' }} /></Loaded>
      </Card>
      <Card title="Proficiency scale" className="mb-5">
        <Loaded list={levels}>
          <Body>
            {scaleRows.map((lv, i) => (
              <div className="mb-2 flex items-center gap-3" key={lv.rank}>
                <span className="w-6 text-sm">{lv.rank}</span>
                <Input label="" aria-label={`Level ${lv.rank} name`} value={lv.name} onChange={(e) => setScale(scaleRows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              </div>
            ))}
            <Button variant="secondary" disabled={!scale} loading={actions.busy === 'scale'} onClick={async () => { const r = await actions.run('scale', () => send('PUT', paths.levels, { levels: scale.map((x) => ({ rank: x.rank, name: x.name, description: x.description ?? null })) }), 'Scale saved'); if (r) { setScale(null); levels.reload(); } }}>Save scale</Button>
          </Body>
        </Loaded>
      </Card>
      <Card title="Role skill requirements" action={<Button variant="secondary" onClick={() => setDialog('requirement')}>Add requirement</Button>}>
        <Loaded list={reqs}>
          <DataTable columns={[{ key: 'designation', label: 'Designation' }, { key: 'skill', label: 'Skill' }, { key: 'required_rank', label: 'Required level' }, { key: 'mandatory', label: 'Mandatory', render: (r) => (r.mandatory ? 'Yes' : 'No') }, { key: 'actions', label: '', render: (r) => <Button variant="secondary" onClick={async () => { if (await actions.run(r.uuid, () => send('DELETE', `${paths.requirements}/${r.uuid}`), 'Requirement removed')) reqs.reload(); }}>Remove</Button> }]} rows={reqs.rows.map((r) => ({ ...r, id: r.uuid }))} empty={{ title: 'No requirements yet', description: 'Requirements drive the skill-gap view.' }} />
        </Loaded>
      </Card>
      <FormModal open={dialog === 'category'} onClose={() => setDialog(null)} title="Add a skill category" fields={[{ name: 'code', label: 'Code' }, { name: 'name', label: 'Name' }]} onSubmit={async (v) => { const r = await send('POST', paths.skillCategories, v); cats.reload(); return r; }} success="Category added" />
      <FormModal open={dialog === 'skill'} onClose={() => setDialog(null)} title="Add a skill" fields={[{ name: 'name', label: 'Name' }, { name: 'category_uuid', label: 'Category', required: false, options: [{ value: '', label: 'None' }, ...opts(cats.rows)] }]} onSubmit={async (v) => { const body = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '')); const r = await send('POST', paths.skills, body); skills.reload(); return r; }} success="Skill added" />
      <FormModal open={dialog === 'requirement'} onClose={() => setDialog(null)} title="Add a role requirement" initial={{ mandatory: true }} fields={[{ name: 'designation_id', label: 'Designation', options: opts(l.designations ?? [], 'id') }, { name: 'skill_uuid', label: 'Skill', options: opts(skills.rows.filter((s) => s.active)) }, { name: 'required_rank', label: 'Required level', options: levels.rows.map((x) => ({ value: x.rank, label: `${x.rank} · ${x.name}` })) }, { name: 'mandatory', label: 'Mandatory', type: 'checkbox' }]} onSubmit={async (v) => { const r = await send('PUT', paths.requirements, { designation_id: Number(v.designation_id), skill_uuid: v.skill_uuid, required_rank: Number(v.required_rank), mandatory: Boolean(v.mandatory) }); reqs.reload(); return r; }} success="Requirement saved" />
    </Page>
  );
}

/* ---------- Team skills: gaps and manager validation with evidence ---------- */

export function TeamSkillsPage() {
  const { can } = useAuth();
  const gaps = useList(paths.skillGaps);
  const skills = useList(paths.skills);
  const levels = useList(paths.levels);
  const lookups = useList(can('learning.skills.validate') ? paths.lookups : null);
  const [open, setOpen] = useState(false);
  return (
    <Page permission="learning.view|learning.skills.validate" title="Team skills" description="Where your people are below the skills their role requires, and validate skill levels with evidence." action={can('learning.skills.validate') && <Button onClick={() => setOpen(true)}>Validate a skill</Button>}>
      <Card title="Skill gaps">
        <Loaded list={gaps}>
          <DataTable columns={[{ key: 'skill', label: 'Skill' }, { key: 'required', label: 'Required level' }, { key: 'people', label: 'People assessed' }, { key: 'below', label: 'Below requirement' }]} rows={gaps.rows.map((r) => ({ ...r, id: r.skill_uuid }))} empty={{ title: 'No role requirements configured', description: 'Ask your learning administrator to define role skill requirements.' }} />
        </Loaded>
      </Card>
      <FormModal open={open} onClose={() => setOpen(false)} title="Validate a skill" intro="Record what you observed. The evidence is stored with the validated level." initial={{ kind: 'observation' }} fields={[
        { name: 'employee', label: 'Employee', options: opts(lookups.data?.employees ?? []) },
        { name: 'skill', label: 'Skill', options: opts(skills.rows) },
        { name: 'level', label: 'Validated level', options: levels.rows.map((x) => ({ value: x.rank, label: `${x.rank} · ${x.name}` })) },
        { name: 'kind', label: 'Evidence type', options: ['observation', 'project', 'certificate', 'assessment', 'other'] },
        { name: 'note', label: 'Evidence', textarea: true, minLength: 5 },
      ]} onSubmit={async (v) => { const r = await send('POST', paths.validateSkill(v.employee, v.skill), { level: Number(v.level), evidence: { kind: v.kind, note: v.note } }); gaps.reload(); return r; }} success="Skill validated" />
    </Page>
  );
}

/* ---------- Dashboard / command center ---------- */

const Tile = ({ label, value }) => <Card><Body><p className="m-0 text-xs text-slate-500">{label}</p><p className="m-0 text-2xl font-semibold">{value}</p></Body></Card>;

export function DashboardPage() {
  const { can } = useAuth();
  const dash_ = useList(paths.dashboard);
  const cc = useList(can('learning.reports.view') ? paths.commandCenter : null);
  const d = dash_.data;
  const c = cc.data && !cc.error ? cc.data : null;
  const cost = (v) => Object.entries(v ?? {}).map(([cur, amt]) => `${cur} ${amt}`).join(' · ') || '—';
  return (
    <Page permission="learning.reports.view|learning.view" title="Learning dashboard" description="Team learning, compliance and cost for the people in your scope." action={can('learning.reports.export') && <a className={linkClass} href={`${API_BASE()}${paths.exportCsv}`}>Export CSV</a>}>
      <Loaded list={dash_}>
        {d && (
          <>
            <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Tile label="People in scope" value={d.people} />
              <Tile label="Completions this month" value={d.completions_this_month} />
              <Tile label="Awaiting approval" value={d.pending_approvals} />
              <Tile label="Overdue learning" value={d.overdue_learning} />
              <Tile label="Compliance" value={`${d.compliance?.compliance_pct ?? '0.0'}%`} />
              <Tile label="Overdue mandatory" value={d.compliance?.overdue_assignments ?? 0} />
              <Tile label="Certificates expiring (60 days)" value={d.certificates_expiring} />
              <Tile label="Learning cost" value={d.cost_masked ? 'Hidden' : cost(d.cost)} />
            </div>
            <Card title="Top skill gaps" className="mb-5">
              <DataTable columns={[{ key: 'skill', label: 'Skill' }, { key: 'below', label: 'Below requirement' }, { key: 'people', label: 'People' }]} rows={(d.skill_gaps ?? []).map((r) => ({ ...r, id: r.skill_uuid }))} empty={{ title: 'No skill gaps' }} />
            </Card>
          </>
        )}
      </Loaded>
      {c && (
        <>
          <Card title="Catalog" className="mb-5"><Body><p className="m-0 text-sm">{c.catalog.published} published · {c.catalog.draft} draft · {c.catalog.retired} retired</p></Body></Card>
          <Card title="Most popular courses" className="mb-5"><DataTable columns={[{ key: 'title', label: 'Course' }, { key: 'enrolments', label: 'Enrolments' }]} rows={c.popular_courses.map((r) => ({ ...r, id: r.uuid }))} empty={{ title: 'No enrolments yet' }} /></Card>
          <Card title="Upcoming sessions" className="mb-5"><DataTable columns={[{ key: 'code', label: 'Session' }, { key: 'starts_on', label: 'Starts' }, { key: 'fill', label: 'Filled', render: (r) => `${r.filled}${r.capacity ? ` / ${r.capacity}` : ''}` }]} rows={c.upcoming_sessions.map((r) => ({ ...r, id: r.uuid }))} empty={{ title: 'No upcoming sessions' }} /></Card>
          <Card title="Budgets"><DataTable columns={[{ key: 'name', label: 'Budget' }, { key: 'fiscal_year', label: 'Year' }, { key: 'amount', label: 'Amount', render: (r) => `${r.currency} ${r.amount}` }, { key: 'spent', label: 'Committed', render: (r) => `${r.currency} ${r.spent}` }]} rows={c.budgets.map((r) => ({ ...r, id: r.uuid }))} empty={{ title: 'No budgets defined' }} /></Card>
        </>
      )}
    </Page>
  );
}
