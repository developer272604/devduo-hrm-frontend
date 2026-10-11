import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  GENDERS,
  WORKER_TYPES,
  WORK_MODES,
  changeManager,
  createEmployee,
  createRecord,
  isDuplicate,
  label,
  readLocal,
  removeLocal,
  writeLocal,
} from '../../lib/peopleApi';
import { Button, Card, Checkbox, ErrorState, FormError, Input, PageHeader, Select, useToast } from '../../components/ui';
import { EmployeePicker, OrgSelect } from '../../components/people/lookups';
import {
  INITIAL,
  ORG_FIELDS,
  STEPS,
  buildPayload,
  firstInvalidStep,
  mapServerErrors,
  validateQuick,
  validateStep,
} from '../../components/people/wizard';

const DRAFT_KEY = 'people.employee.draft';

export default function EmployeeCreate() {
  const { can } = useAuth(),
    navigate = useNavigate(),
    toast = useToast(),
    [params] = useSearchParams();
  const quick = params.get('mode') === 'quick';
  const [data, setData] = useState(() => ({ ...INITIAL, ...(readLocal(DRAFT_KEY)?.data || {}) })),
    [step, setStep] = useState(() => readLocal(DRAFT_KEY)?.step || 0),
    [errors, setErrors] = useState({}),
    [error, setError] = useState(null),
    [duplicate, setDuplicate] = useState(null),
    [busy, setBusy] = useState(false),
    [restored] = useState(() => Boolean(readLocal(DRAFT_KEY))),
    [nextNumber, setNextNumber] = useState(null);
  const heading = useRef(null);
  const set = (key) => (e) => {
    const value = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setData((d) => ({ ...d, [key]: value }));
    setErrors((er) => (er[key] ? { ...er, [key]: undefined } : er));
  };
  const input = (key, text, props = {}) => (
    <Input label={text} value={data[key]} onChange={set(key)} error={errors[key]} {...props} />
  );

  // Show what the workspace numbering will assign (manual numbering returns null).
  useEffect(() => {
    api(`/v1/people/numbering/preview?worker_type=${data.worker_type}&country=${data.country}`)
      .then((r) => setNextNumber(r?.next || null))
      .catch(() => setNextNumber(null));
  }, [data.worker_type, data.country]);
  useEffect(() => heading.current?.focus(), [step]);

  if (!can('people.manage'))
    return <ErrorState error={{ status: 403, message: 'You do not have permission to add employees.' }} />;

  const saveDraft = (notify = true) => {
    writeLocal(DRAFT_KEY, { data, step, savedAt: new Date().toISOString() });
    if (notify) toast('Draft saved on this device.');
  };
  const discard = () => {
    removeLocal(DRAFT_KEY);
    setData(INITIAL);
    setStep(0);
    setErrors({});
    toast('Draft discarded.');
  };
  const current = STEPS[step];
  const goNext = () => {
    const found = validateStep(current.key, data);
    setErrors(found);
    if (Object.keys(found).length) return;
    writeLocal(DRAFT_KEY, { data, step: step + 1, savedAt: new Date().toISOString() });
    setStep(step + 1);
  };

  async function submit(confirm = false) {
    const found = quick ? validateQuick(data) : {};
    const badStep = quick ? -1 : firstInvalidStep(data);
    if (quick ? Object.keys(found).length : badStep >= 0) {
      if (quick) setErrors(found);
      else {
        setErrors(validateStep(STEPS[badStep].key, data));
        setStep(badStep);
      }
      return;
    }
    setBusy(true);
    setError(null);
    setDuplicate(null);
    try {
      const created = await createEmployee(buildPayload(data, { quick, confirmDuplicates: confirm }), quick);
      const extras = [];
      if (!quick && data.manager_uuid)
        extras.push(changeManager(created.uuid, { type: 'primary', manager_uuid: data.manager_uuid, effective_from: data.joined_on }));
      if (!quick && data.em_name)
        extras.push(createRecord(created.uuid, 'emergency-contacts', { name: data.em_name, relationship: data.em_relationship, phone: data.em_phone, is_primary: true }));
      if (!quick && data.addr_line1)
        extras.push(createRecord(created.uuid, 'addresses', { type: 'current', line1: data.addr_line1, city: data.addr_city || undefined, region: data.addr_region || undefined, postal_code: data.addr_postal_code || undefined, country: data.addr_country.toUpperCase(), is_primary: true }));
      const results = await Promise.allSettled(extras);
      removeLocal(DRAFT_KEY);
      toast(
        results.some((r) => r.status === 'rejected')
          ? 'Employee created, but some optional details could not be saved. Add them from the profile.'
          : `Employee created${created.employee_number ? ` (${created.employee_number})` : ''}.`,
      );
      navigate(`/people/${created.uuid}`);
    } catch (e) {
      if (isDuplicate(e)) setDuplicate(e);
      else {
        const mapped = mapServerErrors(e.errors);
        setError(e);
        setErrors(mapped.fields);
        if (!quick && mapped.first >= 0) setStep(mapped.first);
      }
    } finally {
      setBusy(false);
    }
  }

  const orgFields = (
    <div className="grid gap-x-4 sm:grid-cols-2">
      {ORG_FIELDS.map(([key, type, text]) => (
        <OrgSelect key={key} type={type} label={text} required any="Choose…" value={data[key]} error={errors[key]} onChange={set(key)} />
      ))}
      {!quick && (
        <Select label="Work mode" value={data.work_mode} onChange={set('work_mode')}
          options={[{ value: '', label: 'Not set' }, ...WORK_MODES.map((v) => ({ value: v, label: label(v) }))]} />
      )}
    </div>
  );
  const nameFields = (
    <div className="grid gap-x-4 sm:grid-cols-2">
      {input('legal_first_name', 'Legal first name', { required: true, maxLength: 120, autoComplete: 'off' })}
      {input('legal_last_name', 'Legal last name', { maxLength: 120 })}
      {!quick && input('legal_middle_name', 'Legal middle name', { maxLength: 120 })}
      {!quick && input('preferred_name', 'Preferred name', { maxLength: 120 })}
    </div>
  );
  const employmentFields = (
    <div className="grid gap-x-4 sm:grid-cols-2">
      {!quick && input('employee_number', 'Employee number', { hint: nextNumber ? `Leave blank to use ${nextNumber}.` : 'Leave blank to use workspace numbering.' })}
      {input('joined_on', 'Joining date', { type: 'date', required: true })}
      <Select label="Worker type" required value={data.worker_type} error={errors.worker_type} onChange={set('worker_type')}
        options={WORKER_TYPES.map((v) => ({ value: v, label: label(v) }))} />
      {input('country', 'Country code', { maxLength: 2 })}
      {!quick && input('timezone', 'Timezone')}
      {!quick && (
        <Select label="Initial status" value={data.status} onChange={set('status')}
          options={[{ value: '', label: 'Default' }, ...['preboarding', 'active', 'probation'].map((v) => ({ value: v, label: label(v) }))]} />
      )}
      {quick && input('work_email', 'Work email', { type: 'email' })}
    </div>
  );

  const body = {
    name: nameFields,
    personal: (
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Select label="Gender" value={data.gender} onChange={set('gender')}
          options={[{ value: '', label: 'Not specified' }, ...GENDERS.map((v) => ({ value: v, label: label(v) }))]} />
        {input('date_of_birth', 'Date of birth', { type: 'date' })}
        {input('pronouns', 'Pronouns')}
        {input('nationality', 'Nationality (2 letters)', { maxLength: 2 })}
        {input('marital_status', 'Marital status')}
      </div>
    ),
    employment: employmentFields,
    terms: (
      <div className="grid gap-x-4 sm:grid-cols-2">
        <div className="sm:col-span-2 mb-5">
          <Checkbox label="Probation applies" checked={data.probation_applicable} onChange={set('probation_applicable')} />
        </div>
        {input('probation_start', 'Probation start', { type: 'date' })}
        {input('probation_end', 'Probation end', { type: 'date' })}
        {input('contract_start', 'Contract start', { type: 'date' })}
        {input('contract_end', 'Contract end', { type: 'date' })}
        {input('notice_period_days', 'Notice period (days)', { type: 'number', min: 0, max: 365 })}
      </div>
    ),
    organization: orgFields,
    manager: (
      <>
        <EmployeePicker label="Reporting manager" value={data.manager_uuid} onChange={(v) => setData((d) => ({ ...d, manager_uuid: v }))} valueLabel={data.manager_name} />
        <p className="text-xs text-slate-500 dark:text-slate-400">Optional. The manager applies from the joining date.</p>
      </>
    ),
    contact: (
      <div className="grid gap-x-4 sm:grid-cols-2">
        {input('work_email', 'Work email', { type: 'email' })}
        {input('work_phone', 'Work phone', { type: 'tel' })}
        {input('personal_email', 'Personal email', { type: 'email' })}
        {input('personal_phone', 'Personal phone', { type: 'tel' })}
      </div>
    ),
    emergency: (
      <>
        <fieldset className="mb-4 border-0 p-0">
          <legend className="mb-3 text-sm font-semibold">Emergency contact (optional)</legend>
          <div className="grid gap-x-4 sm:grid-cols-3">
            {input('em_name', 'Name')}
            {input('em_relationship', 'Relationship')}
            {input('em_phone', 'Phone', { type: 'tel' })}
          </div>
        </fieldset>
        <fieldset className="border-0 p-0">
          <legend className="mb-3 text-sm font-semibold">Current address (optional)</legend>
          <div className="grid gap-x-4 sm:grid-cols-2">
            {input('addr_line1', 'Address line 1')}
            {input('addr_city', 'City')}
            {input('addr_region', 'State / region')}
            {input('addr_postal_code', 'Postal code')}
            {input('addr_country', 'Country (2 letters)', { maxLength: 2 })}
          </div>
        </fieldset>
      </>
    ),
    review: (
      <dl className="m-0 grid gap-4 text-sm sm:grid-cols-2">
        {[
          ['Name', [data.legal_first_name, data.legal_middle_name, data.legal_last_name].filter(Boolean).join(' ')],
          ['Joining date', data.joined_on],
          ['Worker type', label(data.worker_type)],
          ['Work email', data.work_email],
          ['Manager', data.manager_uuid ? 'Selected' : ''],
          ['Probation', data.probation_applicable ? `${data.probation_start || '?'} to ${data.probation_end || '?'}` : ''],
          ['Emergency contact', data.em_name],
          ['Address', [data.addr_line1, data.addr_city].filter(Boolean).join(', ')],
        ]
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-slate-500 dark:text-slate-400">{k}</dt>
              <dd className="m-0 mt-1 font-medium">{v}</dd>
            </div>
          ))}
      </dl>
    ),
  };

  return (
    <>
      <PageHeader
        title={quick ? 'Quick add employee' : 'Add employee'}
        description={quick ? 'The essentials only. Complete the rest from the profile.' : `Step ${step + 1} of ${STEPS.length}: ${current.title}`}
        action={
          <Link className="text-xs font-semibold text-brand-600 dark:text-brand-300" to={quick ? '/people/new' : '/people/new?mode=quick'}>
            {quick ? 'Use the full guided form' : 'Switch to quick add'}
          </Link>
        }
      />
      {restored && !quick && step > 0 && (
        <p className="mb-4 text-xs" role="status">
          Draft restored from this device.{' '}
          <button type="button" className="font-semibold text-brand-600 underline dark:text-brand-300" onClick={discard}>
            Discard draft
          </button>
        </p>
      )}
      <Card>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (quick || current.key === 'review') submit(false);
            else goNext();
          }}
        >
          {!quick && (
            <ol className="m-0 mb-6 flex list-none gap-2 overflow-x-auto p-0" aria-label="Progress">
              {STEPS.map((s, i) => (
                <li
                  key={s.key}
                  aria-current={i === step ? 'step' : undefined}
                  className={`shrink-0 rounded-full border px-3 py-1 text-[11px] ${i === step ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300' : i < step ? 'border-emerald-300 text-emerald-700 dark:text-emerald-300' : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'}`}
                >
                  {i + 1}. {s.title}
                </li>
              ))}
            </ol>
          )}
          <FormError error={error} />
          {duplicate && (
            <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100" role="alert">
              <strong className="block">Possible duplicate</strong>
              <p className="my-2">{duplicate.message}</p>
              {(duplicate.duplicates || duplicate.data?.duplicates || []).length > 0 && (
                <ul className="mb-2 list-disc pl-5">
                  {(duplicate.duplicates || duplicate.data?.duplicates).map((m, i) => (
                    <li key={m.uuid || i}>{m.name || m.display_name || m.employee_number}{m.reason ? `: ${m.reason}` : ''}</li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setDuplicate(null)}>Review details</Button>
                <Button loading={busy} onClick={() => submit(true)}>This is a different person, create anyway</Button>
              </div>
            </div>
          )}
          {quick ? (
            <>
              <h2 className="mt-0 text-sm">Person</h2>
              {nameFields}
              <h2 className="text-sm">Employment</h2>
              {employmentFields}
              <h2 className="text-sm">Organization</h2>
              {orgFields}
            </>
          ) : (
            <section aria-labelledby="wizard-step-title">
              <h2 id="wizard-step-title" ref={heading} tabIndex={-1} className="mt-0 text-sm outline-none">
                {current.title}
              </h2>
              {body[current.key]}
            </section>
          )}
          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <div className="flex gap-2">
              {!quick && step > 0 && (
                <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>
              )}
              {!quick && <Button variant="secondary" onClick={() => saveDraft()}>Save draft</Button>}
            </div>
            {quick || current.key === 'review' ? (
              <Button type="submit" loading={busy}>Create employee</Button>
            ) : (
              <Button type="submit">Continue</Button>
            )}
          </div>
        </form>
      </Card>
    </>
  );
}
