/**
 * Declarative config for the self-service request sections. The server stays authoritative; client rules only
 * catch what can be known without it (required fields, obvious contradictions) so people get instant feedback.
 */
const required = (v) => (String(v ?? '').trim() ? null : 'This field is required.');
const todayLocal = () => new Date().toLocaleDateString('en-CA');

export function validateRegularization(v, today = todayLocal()) {
  const e = {};
  if (!v.date) e.date = 'Choose the attendance date.';
  else if (v.date > today) e.date = 'You cannot regularize a future date.';
  if (!v.type) e.type = 'Choose what went wrong.';
  if (!v.requested_in && !v.requested_out)
    e.requested_in = 'Enter the in time, the out time, or both.';
  if (v.type === 'forgot_in' && !v.requested_in)
    e.requested_in = 'Enter the in time you forgot to punch.';
  if (v.type === 'forgot_out' && !v.requested_out)
    e.requested_out = 'Enter the out time you forgot to punch.';
  if (required(v.reason)) e.reason = 'Give a short reason.';
  else if (v.reason.length > 2000) e.reason = 'Keep the reason under 2000 characters.';
  return e;
}

const validateOvertime = (v) => {
  const e = {};
  if (!v.work_date) e.work_date = 'Choose the work date.';
  if (!v.mode) e.mode = 'Choose a request mode.';
  if (!v.ot_type) e.ot_type = 'Choose the overtime type.';
  const m = Number(v.requested_minutes);
  if (!Number.isInteger(m) || m < 1 || m > 1440)
    e.requested_minutes = 'Enter minutes between 1 and 1440.';
  if (required(v.reason)) e.reason = 'Give a short reason.';
  return e;
};

const validateOnDuty = (v) => {
  const e = {};
  if (!v.type) e.type = 'Choose a type.';
  if (!v.start_date) e.start_date = 'Choose the first day.';
  if (!v.end_date) e.end_date = 'Choose the last day.';
  else if (v.start_date && v.end_date < v.start_date)
    e.end_date = 'The last day cannot be before the first day.';
  if (!v.full_day && (!v.start_time || !v.end_time))
    e.start_time = 'Enter start and end times, or tick full day.';
  if (required(v.reason)) e.reason = 'Give a short reason.';
  return e;
};

const validateSwap = (v) => {
  const e = {};
  if (!v.type) e.type = 'Choose what you need.';
  if (!v.work_date) e.work_date = 'Choose the date of the shift.';
  if (v.type === 'swap' && required(v.counterpart_uuid))
    e.counterpart_uuid = 'Choose the colleague to swap with.';
  if (v.type === 'swap' && !v.counterpart_date)
    e.counterpart_date = 'Choose the colleague shift date.';
  if (v.type && v.type !== 'swap' && required(v.to_shift_uuid))
    e.to_shift_uuid = 'Choose the shift you want.';
  if (required(v.reason)) e.reason = 'Give a short reason.';
  return e;
};

const statusTone = {
  approved: 'green',
  pending: 'amber',
  rejected: 'rose',
  withdrawn: 'slate',
  counterpart_accepted: 'amber',
};
const SWAP_TYPES = [
  { value: 'swap', label: 'Swap with a colleague' },
  { value: 'change', label: 'Change my shift' },
  { value: 'alternate', label: 'Work an alternate shift' },
];

export const requestConfigs = {
  regularization: {
    title: 'Regularization',
    noun: 'regularization request',
    path: '/v1/attendance/regularizations',
    description:
      'Forgot to punch, or a punch is wrong? Ask for a correction. Your approver decides.',
    initial: { date: '', type: '', requested_in: '', requested_out: '', reason: '', comments: '' },
    fields: [
      { name: 'date', label: 'Attendance date', type: 'date' },
      {
        name: 'type',
        label: 'What happened',
        type: 'select',
        options: [
          { value: 'forgot_in', label: 'Forgot check-in' },
          { value: 'forgot_out', label: 'Forgot check-out' },
          { value: 'wrong_punch', label: 'Wrong punch' },
          { value: 'offsite', label: 'Worked offsite' },
        ],
      },
      { name: 'requested_in', label: 'In time', type: 'time' },
      { name: 'requested_out', label: 'Out time', type: 'time' },
      { name: 'reason', label: 'Reason', type: 'textarea' },
      { name: 'comments', label: 'Extra comments (optional)', type: 'textarea' },
    ],
    validate: validateRegularization,
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'type_label', label: 'Type' },
      { key: 'reason', label: 'Reason', priority: 'md' },
    ],
    facts: [['Approver', 'current_approver']],
    statusTone,
  },
  overtime: {
    title: 'Overtime',
    noun: 'overtime request',
    path: '/v1/attendance/overtime',
    description: 'Ask for overtime before or after you work it. Only approved overtime counts.',
    initial: {
      work_date: '',
      mode: 'post_work',
      ot_type: 'post_shift',
      requested_minutes: '',
      reason: '',
    },
    fields: [
      { name: 'work_date', label: 'Work date', type: 'date' },
      {
        name: 'mode',
        label: 'Request type',
        type: 'select',
        options: [
          { value: 'pre_approval', label: 'Pre-approval (before working)' },
          { value: 'post_work', label: 'After working' },
        ],
      },
      {
        name: 'ot_type',
        label: 'Overtime on',
        type: 'select',
        options: [
          { value: 'pre_shift', label: 'Before shift' },
          { value: 'post_shift', label: 'After shift' },
          { value: 'weekly_off', label: 'Weekly off' },
          { value: 'holiday', label: 'Holiday' },
          { value: 'rest_day', label: 'Rest day' },
        ],
      },
      { name: 'requested_minutes', label: 'Minutes', type: 'number' },
      { name: 'reason', label: 'Reason', type: 'textarea' },
    ],
    validate: validateOvertime,
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'requested_minutes', label: 'Requested (min)' },
      { key: 'approved_minutes', label: 'Approved (min)', priority: 'md' },
      { key: 'reason', label: 'Reason', priority: 'lg' },
    ],
    facts: [['Approver', 'current_approver']],
    statusTone,
  },
  onduty: {
    title: 'On duty / remote',
    noun: 'on-duty or remote request',
    path: '/v1/attendance/on-duty',
    description:
      'Working away from the office? Request on-duty or remote days so they count as present.',
    initial: {
      type: 'remote_work',
      start_date: '',
      end_date: '',
      full_day: true,
      start_time: '',
      end_time: '',
      reason: '',
      location_text: '',
    },
    fields: [
      {
        name: 'type',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'remote_work', label: 'Remote work' },
          { value: 'client_visit', label: 'Client visit' },
          { value: 'field_work', label: 'Field work' },
          { value: 'training', label: 'Training' },
          { value: 'official_travel', label: 'Official travel' },
        ],
      },
      { name: 'start_date', label: 'From', type: 'date' },
      { name: 'end_date', label: 'To', type: 'date' },
      { name: 'full_day', label: 'Full day', type: 'checkbox' },
      { name: 'start_time', label: 'Start time', type: 'time', showIf: (v) => !v.full_day },
      { name: 'end_time', label: 'End time', type: 'time', showIf: (v) => !v.full_day },
      { name: 'location_text', label: 'Location (optional)', type: 'text' },
      { name: 'reason', label: 'Reason', type: 'textarea' },
    ],
    validate: validateOnDuty,
    columns: [
      { key: 'start_date', label: 'From' },
      { key: 'end_date', label: 'To' },
      { key: 'type_label', label: 'Type', priority: 'md' },
      { key: 'reason', label: 'Reason', priority: 'lg' },
    ],
    facts: [['Type', 'type_label']],
    statusTone,
  },
  swaps: {
    title: 'Shift swaps',
    noun: 'shift swap request',
    path: '/v1/shift-swaps',
    description:
      'Swap a shift with a colleague on the same or a different date, or ask for a different shift. A colleague must accept a swap, then your approver decides.',
    initial: {
      type: 'swap',
      work_date: '',
      counterpart_date: '',
      counterpart_uuid: '',
      to_shift_uuid: '',
      reason: '',
    },
    fields: [
      { name: 'type', label: 'What do you need', type: 'select', options: SWAP_TYPES },
      { name: 'work_date', label: 'Date of your shift', type: 'date' },
      {
        name: 'counterpart_date',
        label: 'Colleague shift date',
        type: 'date',
        showIf: (v) => v.type === 'swap',
      },
      {
        name: 'counterpart_uuid',
        label: 'Colleague to swap with',
        type: 'colleague',
        showIf: (v) => v.type === 'swap',
      },
      {
        name: 'to_shift_uuid',
        label: 'Shift you want',
        type: 'shift',
        showIf: (v) => v.type !== 'swap',
      },
      { name: 'reason', label: 'Reason', type: 'textarea' },
    ],
    validate: validateSwap,
    columns: [
      { key: 'work_date', label: 'Date' },
      {
        key: 'counterpart_date',
        label: 'Colleague date',
        priority: 'md',
        render: (r) => r.counterpart_date || r.work_date,
      },
      {
        key: 'type',
        label: 'Type',
        render: (r) => SWAP_TYPES.find((t) => t.value === r.type)?.label ?? r.type,
      },
      { key: 'counterpart', label: 'With', render: (r) => r.counterpart ?? r.to_shift ?? '—' },
      { key: 'reason', label: 'Reason', priority: 'lg' },
    ],
    facts: [
      ['With', 'counterpart'],
      ['Requested by', 'requester'],
      ['Change to shift', 'to_shift'],
    ],
    statusTone,
  },
};
