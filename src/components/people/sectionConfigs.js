import { GENDERS, label } from '../../lib/peopleApi';

const opts = (values) => values.map((value) => ({ value, label: label(value) }));
const text = (key, lbl, extra = {}) => ({ key, label: lbl, type: 'text', ...extra });
const date = (key, lbl, extra = {}) => ({ key, label: lbl, type: 'date', ...extra });
const join = (...parts) => parts.filter(Boolean).join(' · ');

/**
 * Declarative description of each profile record section. `group` is the key in `viewer.edit`;
 * `requestSection` is the change-request section name (only some sections support approval workflow).
 */
export const SECTION_CONFIGS = {
  contacts: {
    segment: 'contacts',
    group: 'contact',
    requestSection: 'contact',
    title: 'Contact details',
    noun: 'contact',
    fields: [
      { key: 'kind', label: 'Type', type: 'select', options: opts(['email', 'phone']), required: true, createOnly: true },
      { key: 'label', label: 'Label', type: 'select', options: opts(['work', 'personal', 'home', 'mobile', 'other']) },
      text('value', 'Value', { required: true }),
      text('country_code', 'Country code', { placeholder: '+91' }),
      { key: 'is_primary', label: 'Primary contact of this type', type: 'checkbox' },
      date('effective_from', 'Effective from'),
      date('effective_to', 'Effective to'),
    ],
    heading: (r) => `${label(r.kind)}: ${r.country_code || ''} ${r.value}`.replace('  ', ' '),
    detail: (r) => join(label(r.label), r.is_primary && 'Primary', r.verified && 'Verified', r.is_current === false && 'Ended'),
  },
  addresses: {
    segment: 'addresses',
    group: 'address',
    requestSection: 'address',
    title: 'Addresses',
    noun: 'address',
    fields: [
      { key: 'type', label: 'Type', type: 'select', options: opts(['current', 'permanent', 'mailing', 'other']), required: true },
      text('line1', 'Address line 1', { required: true }),
      text('line2', 'Address line 2'),
      text('city', 'City'),
      text('region', 'State / region'),
      text('postal_code', 'Postal code'),
      text('country', 'Country (2 letters)', { required: true, maxLength: 2 }),
      { key: 'is_primary', label: 'Primary address of this type', type: 'checkbox' },
      date('effective_from', 'Effective from'),
      date('effective_to', 'Effective to'),
    ],
    heading: (r) => r.formatted || join(r.line1, r.city, r.postal_code, r.country),
    detail: (r) => join(label(r.type), r.is_primary && 'Primary'),
  },
  emergency: {
    segment: 'emergency-contacts',
    group: 'emergency',
    requestSection: 'emergency',
    title: 'Emergency contacts',
    noun: 'emergency contact',
    fields: [
      text('name', 'Name', { required: true }),
      text('relationship', 'Relationship', { required: true }),
      text('phone', 'Phone', { required: true }),
      text('alternate_phone', 'Alternate phone'),
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'is_primary', label: 'Primary emergency contact', type: 'checkbox' },
    ],
    heading: (r) => r.name,
    detail: (r) => join(r.relationship, r.phone, r.is_primary && 'Primary'),
  },
  dependents: {
    segment: 'dependents',
    group: 'dependent',
    requestSection: 'dependent',
    title: 'Dependents',
    noun: 'dependent',
    fields: [
      text('name', 'Name', { required: true }),
      text('relationship', 'Relationship', { required: true }),
      date('date_of_birth', 'Date of birth'),
      { key: 'gender', label: 'Gender', type: 'select', options: opts(GENDERS) },
      text('phone', 'Phone'),
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'status', label: 'Status', type: 'select', options: opts(['active', 'inactive']) },
      date('effective_from', 'Effective from'),
      date('effective_to', 'Effective to'),
    ],
    heading: (r) => r.name,
    detail: (r) => join(r.relationship, r.date_of_birth, label(r.status)),
  },
  education: {
    segment: 'education',
    group: 'education',
    title: 'Education',
    noun: 'qualification',
    verifiable: true,
    fields: [
      text('institution', 'Institution', { required: true }),
      text('qualification', 'Qualification', { required: true }),
      text('field_of_study', 'Field of study'),
      date('start_date', 'Start date'),
      date('end_date', 'End date'),
      text('grade', 'Grade'),
      text('country', 'Country (2 letters)', { maxLength: 2 }),
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    heading: (r) => r.qualification,
    detail: (r) => join(r.institution, r.field_of_study, r.end_date),
  },
  experience: {
    segment: 'experience',
    group: 'experience',
    title: 'Work experience',
    noun: 'job',
    fields: [
      text('employer', 'Employer', { required: true }),
      text('job_title', 'Job title', { required: true }),
      text('location', 'Location'),
      date('start_date', 'Start date', { required: true }),
      date('end_date', 'End date'),
      { key: 'responsibilities', label: 'Responsibilities', type: 'textarea' },
    ],
    heading: (r) => `${r.job_title} at ${r.employer}`,
    detail: (r) => join(r.start_date && `${r.start_date} to ${r.end_date || 'present'}`, r.location),
    summary: (data) =>
      data.total_experience
        ? `Total experience: ${data.total_experience.years} years ${data.total_experience.months} months`
        : null,
  },
  certifications: {
    segment: 'certifications',
    group: 'certification',
    title: 'Certifications',
    noun: 'certification',
    verifiable: true,
    fields: [
      text('name', 'Certification', { required: true }),
      text('issuer', 'Issuer', { required: true }),
      date('issue_date', 'Issue date'),
      date('expiry_date', 'Expiry date'),
      text('credential_id', 'Credential ID'),
      { key: 'credential_url', label: 'Credential URL', type: 'url' },
    ],
    heading: (r) => r.name,
    detail: (r) => join(r.issuer, r.expiry_date && `Expires ${r.expiry_date}`, r.expiry_status && label(r.expiry_status)),
  },
  skills: {
    segment: 'skills',
    group: 'skill',
    title: 'Skills',
    noun: 'skill',
    verifiable: true,
    idOf: (r) => r.skill?.id,
    fields: [
      { key: 'skill_id', label: 'Skill', type: 'select', required: true, createOnly: true, optionsPath: '/v1/people/skills?per_page=100', numeric: true },
      { key: 'proficiency', label: 'Proficiency', type: 'select', options: opts(['beginner', 'intermediate', 'advanced', 'expert']), required: true },
      { key: 'years_experience', label: 'Years of experience', type: 'number' },
      date('last_used', 'Last used'),
    ],
    heading: (r) => r.skill?.name,
    detail: (r) => join(label(r.proficiency), r.years_experience && `${r.years_experience} yrs`, r.skill?.category),
  },
};
