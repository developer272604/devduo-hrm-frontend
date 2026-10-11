import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import { Card, Resource, Tabs } from '../../components/ui';
import PersonAvatar from '../../components/people/PersonAvatar';
import StatusBadge from '../../components/people/StatusBadge';
import ProfileActions from '../../components/people/ProfileActions';
import RecordSection from '../../components/people/RecordSection';
import { SECTION_CONFIGS } from '../../components/people/sectionConfigs';
import PersonalPanel from '../../components/people/PersonalPanel';
import JobPanel from '../../components/people/JobPanel';
import DocumentsPanel from '../../components/people/DocumentsPanel';
import SensitivePanel from '../../components/people/SensitivePanel';
import NotesPanel from '../../components/people/NotesPanel';
import CustomFieldsPanel from '../../components/people/CustomFieldsPanel';
import {
  Completeness,
  Employee360,
  OrganizationMemory,
  Timeline,
} from '../../components/people/ProfileInsights';

/** Tabs exist only for sections the API says this viewer may see (`viewer.sections`). */
export function buildTabs(sections = [], canView = false) {
  const has = (s) => sections.includes(s);
  return [
    { value: 'overview', label: 'Overview' },
    (has('job') || has('employment')) && { value: 'job', label: 'Job' },
    has('personal') && { value: 'personal', label: 'Personal' },
    (has('contact') || has('address')) && { value: 'contact', label: 'Contact & address' },
    has('emergency') && { value: 'emergency', label: 'Emergency' },
    has('dependents') && { value: 'dependents', label: 'Dependents' },
    has('education') && { value: 'education', label: 'Education' },
    has('experience') && { value: 'experience', label: 'Experience' },
    has('skills') && { value: 'skills', label: 'Skills' },
    has('certifications') && { value: 'certifications', label: 'Certifications' },
    has('documents') && { value: 'documents', label: 'Documents' },
    (has('identity') || has('bank')) && { value: 'identity', label: 'Identity & bank' },
    has('notes') && { value: 'notes', label: 'Notes' },
    canView && { value: 'timeline', label: 'Timeline' },
    canView && { value: 'custom', label: 'Custom fields' },
  ].filter(Boolean);
}

function Overview({ uuid, profile, canView, tabs, onGo }) {
  const h = profile.header;
  const facts = [
    ['Employee number', h.employee_number],
    ['Designation', h.designation],
    ['Department', h.department],
    ['Location', h.location],
    ['Manager', h.manager?.name],
    ['Work email', h.work_email],
    ['Work phone', h.work_phone],
  ].filter(([, v]) => v);
  return (
    <>
      <dl className="m-0 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-slate-500 dark:text-slate-400">{k}</dt>
            <dd className="m-0 mt-1 wrap-break-word text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {canView && <CompletenessLoader uuid={uuid} tabs={tabs.map((t) => t.value)} onGo={onGo} />}
      {canView && <Employee360 uuid={uuid} />}
    </>
  );
}

function CompletenessLoader({ uuid, tabs, onGo }) {
  const resource = useResource(`/v1/employees/${uuid}/completeness`);
  // Completeness is supplementary: if the viewer cannot read it, simply omit the panel.
  if (resource.error) return null;
  return <Completeness resource={resource} tabs={tabs} onGo={onGo} />;
}

function TabBody({ tab, uuid, profile, sections, edit, canView, tabs, onGo, reload }) {
  const cfg = SECTION_CONFIGS;
  switch (tab) {
    case 'overview':
      return <Overview uuid={uuid} profile={profile} canView={canView} tabs={tabs} onGo={onGo} />;
    case 'job':
      return <JobPanel uuid={uuid} profile={profile} sections={sections} />;
    case 'personal':
      return (
        <PersonalPanel
          uuid={uuid}
          person={profile.person || {}}
          mode={edit.personal || 'none'}
          onSaved={reload}
        />
      );
    case 'contact':
      return (
        <>
          {sections.includes('contact') && (
            <RecordSection uuid={uuid} config={cfg.contacts} mode={edit.contact || 'none'} />
          )}
          {sections.includes('address') && (
            <RecordSection uuid={uuid} config={cfg.addresses} mode={edit.address || 'none'} />
          )}
        </>
      );
    case 'emergency':
      return <RecordSection uuid={uuid} config={cfg.emergency} mode={edit.emergency || 'none'} />;
    case 'dependents':
      return <RecordSection uuid={uuid} config={cfg.dependents} mode={edit.dependent || 'none'} />;
    case 'education':
      return <RecordSection uuid={uuid} config={cfg.education} mode={edit.education || 'none'} />;
    case 'experience':
      return <RecordSection uuid={uuid} config={cfg.experience} mode={edit.experience || 'none'} />;
    case 'skills':
      return <RecordSection uuid={uuid} config={cfg.skills} mode={edit.skill || 'none'} />;
    case 'certifications':
      return (
        <RecordSection
          uuid={uuid}
          config={cfg.certifications}
          mode={edit.certification || 'none'}
        />
      );
    case 'documents':
      return <DocumentsPanel uuid={uuid} mode={edit.document || 'none'} />;
    case 'identity':
      return <SensitivePanel uuid={uuid} sections={sections} edit={edit} />;
    case 'notes':
      return <NotesPanel uuid={uuid} />;
    case 'timeline':
      return (
        <>
          <Timeline uuid={uuid} />
          <OrganizationMemory uuid={uuid} />
        </>
      );
    case 'custom':
      return <CustomFieldsPanel uuid={uuid} />;
    default:
      return null;
  }
}

export default function EmployeeProfile() {
  const { uuid } = useParams(),
    { can } = useAuth(),
    [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('section') || 'overview');
  const resource = useResource(`/v1/employees/${uuid}`);
  return (
    <Resource resource={resource}>
      {(profile) => {
        const h = profile.header || {};
        const sections = profile.viewer?.sections || [];
        const edit = profile.viewer?.edit || {};
        const canView = can('people.view');
        const tabs = buildTabs(sections, canView);
        const active = tabs.some((t) => t.value === tab) ? tab : 'overview';
        const name = h.display_name || 'Employee';
        return (
          <>
            <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <PersonAvatar uuid={uuid} name={name} hasPhoto={Boolean(h.has_photo)} large />
                <div className="min-w-0">
                  {h.employee_number && (
                    <span className="block text-[10px] font-semibold tracking-widest text-slate-500 dark:text-slate-400">
                      {h.employee_number}
                    </span>
                  )}
                  <h1 className="mb-1 mt-0 wrap-break-word">{name}</h1>
                  <p className="m-0 text-xs text-slate-600 dark:text-slate-300">
                    {[h.designation, h.department, h.location].filter(Boolean).join(' · ')}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    <StatusBadge status={h.status} text={h.status_label} />
                    {h.pronouns && (
                      <span className="text-slate-500 dark:text-slate-400">{h.pronouns}</span>
                    )}
                    {h.manager && (
                      <Link
                        className="text-brand-600 dark:text-brand-300"
                        to={`/people/${h.manager.uuid}`}
                      >
                        Reports to {h.manager.name}
                      </Link>
                    )}
                    {h.work_email && (
                      <a
                        className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-300"
                        href={`mailto:${h.work_email}`}
                      >
                        <Mail size={14} /> Email
                      </a>
                    )}
                    {h.work_phone && (
                      <a
                        className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-300"
                        href={`tel:${h.work_phone}`}
                      >
                        <Phone size={14} /> Call
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <ProfileActions uuid={uuid} profile={profile} onChanged={resource.reload} />
            </header>
            <Card>
              <Tabs value={active} onChange={setTab} items={tabs} />
              <TabBody
                tab={active}
                uuid={uuid}
                profile={profile}
                sections={sections}
                edit={edit}
                canView={canView}
                tabs={tabs}
                onGo={setTab}
                reload={resource.reload}
              />
            </Card>
          </>
        );
      }}
    </Resource>
  );
}
