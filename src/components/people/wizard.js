/** Employee creation wizard: step metadata, per-step validation and payload building (pure, testable). */

export const STEPS = [
  { key: 'name', title: 'Name' },
  { key: 'personal', title: 'Personal details' },
  { key: 'employment', title: 'Employment' },
  { key: 'terms', title: 'Probation and contract' },
  { key: 'organization', title: 'Organization' },
  { key: 'manager', title: 'Reporting manager' },
  { key: 'contact', title: 'Contact' },
  { key: 'emergency', title: 'Emergency contact and address' },
  { key: 'review', title: 'Review' },
];

export const ORG_FIELDS = [
  ['legal_entity_id', 'legal-entities', 'Legal entity'],
  ['department_id', 'departments', 'Department'],
  ['designation_id', 'designations', 'Designation'],
  ['location_id', 'locations', 'Location'],
  ['employee_type_id', 'employee-types', 'Employee type'],
];

export const INITIAL = {
  legal_first_name: '',
  legal_middle_name: '',
  legal_last_name: '',
  preferred_name: '',
  gender: '',
  date_of_birth: '',
  pronouns: '',
  nationality: '',
  marital_status: '',
  employee_number: '',
  joined_on: '',
  worker_type: 'employee',
  status: '',
  country: 'IN',
  timezone: 'Asia/Kolkata',
  probation_applicable: false,
  probation_start: '',
  probation_end: '',
  contract_start: '',
  contract_end: '',
  notice_period_days: '',
  legal_entity_id: '',
  department_id: '',
  designation_id: '',
  location_id: '',
  employee_type_id: '',
  work_mode: '',
  manager_uuid: '',
  manager_name: '',
  work_email: '',
  work_phone: '',
  personal_email: '',
  personal_phone: '',
  em_name: '',
  em_relationship: '',
  em_phone: '',
  addr_line1: '',
  addr_city: '',
  addr_region: '',
  addr_postal_code: '',
  addr_country: '',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+()\-.\s]{5,40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toLocaleDateString('en-CA');

/** Returns {field: message}; an empty object means the step is valid. */
export function validateStep(key, d) {
  const e = {};
  const need = (field, message) => {
    if (!String(d[field] ?? '').trim()) e[field] = message;
  };
  switch (key) {
    case 'name':
      need('legal_first_name', 'First name is required.');
      break;
    case 'personal':
      if (d.date_of_birth && (!DATE.test(d.date_of_birth) || d.date_of_birth >= today()))
        e.date_of_birth = 'Date of birth must be a past date.';
      if (d.nationality && d.nationality.length !== 2) e.nationality = 'Use a 2-letter country code.';
      break;
    case 'employment':
      need('joined_on', 'Joining date is required.');
      need('worker_type', 'Choose a worker type.');
      if (d.country && d.country.length !== 2) e.country = 'Use a 2-letter country code.';
      if (d.employee_number && !/^[A-Za-z0-9._/-]+$/.test(d.employee_number))
        e.employee_number = 'Use letters, numbers and . _ / - only.';
      break;
    case 'terms':
      if (d.probation_start && d.probation_end && d.probation_end < d.probation_start)
        e.probation_end = 'Probation cannot end before it starts.';
      if (d.contract_start && d.contract_end && d.contract_end < d.contract_start)
        e.contract_end = 'The contract cannot end before it starts.';
      if (d.notice_period_days !== '' && !(Number(d.notice_period_days) >= 0 && Number(d.notice_period_days) <= 365))
        e.notice_period_days = 'Notice period must be between 0 and 365 days.';
      break;
    case 'organization':
      ORG_FIELDS.forEach(([field, , lbl]) => need(field, `${lbl} is required.`));
      break;
    case 'contact':
      if (d.work_email && !EMAIL.test(d.work_email)) e.work_email = 'Enter a valid work email.';
      if (d.personal_email && !EMAIL.test(d.personal_email)) e.personal_email = 'Enter a valid personal email.';
      if (d.work_phone && !PHONE.test(d.work_phone)) e.work_phone = 'Enter a valid phone number.';
      if (d.personal_phone && !PHONE.test(d.personal_phone)) e.personal_phone = 'Enter a valid phone number.';
      break;
    case 'emergency':
      if (d.em_name || d.em_phone || d.em_relationship) {
        need('em_name', 'Contact name is required.');
        need('em_phone', 'Contact phone is required.');
        need('em_relationship', 'Relationship is required.');
        if (d.em_phone && !PHONE.test(d.em_phone)) e.em_phone = 'Enter a valid phone number.';
      }
      if (d.addr_line1 || d.addr_city || d.addr_postal_code) {
        need('addr_line1', 'Address line 1 is required.');
        need('addr_country', 'Country is required.');
        if (d.addr_country && d.addr_country.length !== 2) e.addr_country = 'Use a 2-letter country code.';
      }
      break;
    default:
  }
  return e;
}

/** Quick add needs only the essentials. */
export function validateQuick(d) {
  return {
    ...validateStep('name', d),
    ...validateStep('employment', d),
    ...validateStep('organization', d),
    ...validateStep('contact', d),
  };
}

export const firstInvalidStep = (d) => STEPS.findIndex((s) => Object.keys(validateStep(s.key, d)).length > 0);

const pick = (d, keys, numeric = []) => {
  const out = {};
  keys.forEach((k) => {
    const v = d[k];
    if (v === '' || v === null || v === undefined || v === false) return;
    out[k] = numeric.includes(k) ? Number(v) : v;
  });
  return out;
};

/** Build the API payload; `quick` uses only the essentials. */
export function buildPayload(d, { quick = false, confirmDuplicates = false } = {}) {
  const person = pick(d, quick
    ? ['legal_first_name', 'legal_last_name']
    : ['legal_first_name', 'legal_middle_name', 'legal_last_name', 'preferred_name', 'gender', 'date_of_birth', 'pronouns', 'nationality', 'marital_status', 'personal_email', 'personal_phone']);
  const employment = pick(d, quick
    ? ['joined_on', 'worker_type', 'work_email', 'country']
    : ['employee_number', 'joined_on', 'worker_type', 'status', 'country', 'timezone', 'work_email', 'work_phone', 'probation_start', 'probation_end', 'contract_start', 'contract_end', 'notice_period_days'], ['notice_period_days']);
  if (!quick && d.probation_applicable) employment.probation_applicable = true;
  const assignment = pick(d, [...ORG_FIELDS.map(([f]) => f), ...(quick ? [] : ['work_mode'])], ORG_FIELDS.map(([f]) => f));
  return { person, employment, assignment, ...(confirmDuplicates ? { confirm_duplicates: true } : {}) };
}

const STEP_FIELDS = {
  name: ['legal_first_name', 'legal_middle_name', 'legal_last_name', 'preferred_name'],
  personal: ['gender', 'date_of_birth', 'pronouns', 'nationality', 'marital_status'],
  employment: ['employee_number', 'joined_on', 'worker_type', 'status', 'country', 'timezone'],
  terms: ['probation_applicable', 'probation_start', 'probation_end', 'contract_start', 'contract_end', 'notice_period_days'],
  organization: [...ORG_FIELDS.map(([f]) => f), 'work_mode'],
  contact: ['work_email', 'work_phone', 'personal_email', 'personal_phone'],
};

/** Maps server error keys (`person.x`, `employment.y`, `assignment.z`) to {fieldErrors, firstStepIndex}. */
export function mapServerErrors(errors = {}) {
  const fields = {};
  let first = -1;
  Object.entries(errors).forEach(([key, value]) => {
    const field = key.split('.').pop();
    fields[field] = Array.isArray(value) ? value.join(' ') : String(value);
    const step = STEPS.findIndex((s) => (STEP_FIELDS[s.key] || []).includes(field));
    if (step >= 0 && (first < 0 || step < first)) first = step;
  });
  return { fields, first };
}
