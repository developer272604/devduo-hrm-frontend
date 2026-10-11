import { useState } from 'react';
import { Button, Card, ErrorState, PageHeader, Skeleton } from '../../components/ui';
import Access from '../../components/Access';
import { FormModal, StatusBadge, useDo } from '../../components/payroll/kit';
import { api } from '../../lib/api';
import { learningPaths as paths, send, useList } from '../../lib/learningApi';
import { useAuth } from '../../lib/auth';

function Page({ permission, title, description, action, children }) {
  return <Access permission={permission} module="learning"><PageHeader title={title} description={description} action={action} />{children}</Access>;
}

export function CatalogPage() {
  const { can } = useAuth();
  const [create, setCreate] = useState(false);
  const list = useList(paths.courses);
  const actions = useDo();
  const manage = can('learning.catalog.manage');
  return <Page permission="learning.self|learning.view|learning.catalog.manage" title="Course catalog" description="Browse published learning and enroll in courses available to you." action={manage && <Button onClick={() => setCreate(true)}>Add course</Button>}>
    {list.loading ? <Skeleton /> : list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {list.rows.map((course) => <Card key={course.uuid} title={course.title} action={<div className="flex items-center gap-2"><StatusBadge value={course.status} />{manage && course.status === 'draft' && <Button variant="secondary" onClick={async () => { const r = await actions.run(`publish-${course.uuid}`, () => send('POST', paths.course(course.uuid, 'status'), { status: 'published' }), 'Course published'); if (r) list.reload(); }}>Publish</Button>}</div>}>
        <p className="mt-0 text-sm text-slate-600 dark:text-slate-300">{course.description || `${course.delivery} course`}</p>
        <p className="text-xs text-slate-500">{course.code} · {course.duration_hours} hours · {course.provider || 'Internal'}</p>
        {!manage && <Button variant="secondary" disabled={Boolean(actions.busy)} onClick={async () => { const r = await actions.run(`enrol-${course.uuid}`, () => send('POST', paths.course(course.uuid, 'enrol'), {}), 'Enrolment request submitted'); if (r) list.reload(); }}>Enroll</Button>}
      </Card>)}
      {!list.rows.length && <Card><p className="m-0 text-sm">No courses are available yet.</p></Card>}
    </div>}
    <FormModal open={create} onClose={() => setCreate(false)} title="Add a course" intro="New courses start as drafts. Publish them when they are ready for employees." fields={[
      { name: 'code', label: 'Course code' }, { name: 'title', label: 'Title' }, { name: 'description', label: 'Description', textarea: true, required: false },
      { name: 'delivery', label: 'Delivery', options: ['online', 'classroom', 'internal', 'external'].map((value) => ({ value, label: value })) },
      { name: 'duration_hours', label: 'Duration (hours)', type: 'number', required: false }, { name: 'provider', label: 'Provider', required: false },
    ]} onSubmit={(v) => send('POST', paths.courses, v)} success="Course created" />
  </Page>;
}

export function MyLearningPage() {
  const list = useList(paths.my);
  return <Page permission="learning.self" title="My learning" description="Track your enrolments and course completion.">
    {list.loading ? <Skeleton /> : list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : <div className="grid gap-4 md:grid-cols-2">
      {list.rows.map((row) => <Card key={row.uuid} title={row.course?.title ?? 'Course'} action={<StatusBadge value={row.status} />}><p className="m-0 text-sm">{row.due_on ? `Due ${row.due_on}` : 'No due date'}</p></Card>)}
      {!list.rows.length && <Card><p className="m-0 text-sm">You have no course enrolments.</p></Card>}
    </div>}
  </Page>;
}

export function PathsPage() {
  const list = useList(paths.paths);
  return <Page permission="learning.self|learning.view|learning.catalog.manage" title="Learning paths" description="Follow a structured sequence of required and optional courses.">
    {list.loading ? <Skeleton /> : list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : <div className="grid gap-4 md:grid-cols-2">
      {list.rows.map((path) => <Card key={path.uuid} title={path.name}><p className="mt-0 text-sm">{path.description}</p><p className="text-xs text-slate-500">{path.progress ? `${path.progress.completed} of ${path.progress.required} required courses complete` : `${path.items?.length ?? 0} courses`}</p><ul className="mb-0 text-sm">{path.items?.map((item) => <li key={item.course.uuid}>{item.completed ? '✓ ' : ''}{item.course.title}{item.required ? ' (required)' : ' (optional)'}</li>)}</ul></Card>)}
      {!list.rows.length && <Card><p className="m-0 text-sm">No learning paths are published.</p></Card>}
    </div>}
  </Page>;
}

export function MySkillsPage() {
  const profile = useList(paths.mySkills);
  const catalogue = useList(paths.skills);
  const [skill, setSkill] = useState('');
  const [level, setLevel] = useState(1);
  const actions = useDo();
  const data = profile.data?.data ?? profile.data ?? {};
  const skillRows = data.profile?.skills ?? [];
  return <Page permission="learning.self" title="My skills" description="Record your own proficiency and see role requirements against your current skills.">
    {profile.loading ? <Skeleton /> : profile.error ? <ErrorState error={profile.error} onRetry={profile.reload} /> : <>
      <Card title="Declare a skill" className="mb-5"><form className="flex flex-wrap items-end gap-3" onSubmit={async (e) => { e.preventDefault(); const r = await actions.run('declare-skill', () => send('POST', paths.mySkills, { skill_uuid: skill, level: Number(level) }), 'Skill saved'); if (r) profile.reload(); }}>
        <label className="text-xs">Skill<select aria-label="Skill" required className="mt-1 block min-h-10 rounded-lg border border-slate-200 bg-white px-3 dark:bg-slate-900" value={skill} onChange={(e) => setSkill(e.target.value)}><option value="">Choose a skill</option>{catalogue.rows.map((s) => <option key={s.uuid} value={s.uuid}>{s.name}</option>)}</select></label>
        <label className="text-xs">Level<select aria-label="Level" className="mt-1 block min-h-10 rounded-lg border border-slate-200 bg-white px-3 dark:bg-slate-900" value={level} onChange={(e) => setLevel(e.target.value)}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <Button type="submit" disabled={Boolean(actions.busy)}>Save skill</Button>
      </form></Card>
      <Card title="Your skills" className="mb-5">{skillRows.length ? <ul className="m-0 list-none p-0">{skillRows.map((s) => <li className="border-b border-slate-100 py-3 last:border-0 dark:border-slate-800" key={s.skill_uuid}><strong>{s.skill}</strong> · Level {s.level} ({s.level_name}) · {s.validated ? 'Validated' : 'Self-declared'}</li>)}</ul> : <p className="m-0 text-sm">No skills declared yet.</p>}</Card>
      <Card title="Role skill gaps">{(data.gap?.gaps ?? []).length ? <ul className="m-0 list-none p-0">{data.gap.gaps.map((g) => <li className="border-b border-slate-100 py-3 last:border-0 dark:border-slate-800" key={g.skill_uuid}><strong>{g.skill}</strong> · current {g.current}, required {g.required}{g.gap ? ` · gap ${g.gap}` : ' · requirement met'}</li>)}</ul> : <p className="m-0 text-sm">No role skill requirements are configured.</p>}</Card>
    </>}
  </Page>;
}
