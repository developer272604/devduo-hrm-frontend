import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  MapPin,
  Users,
  ShieldCheck,
  Bell,
  Blocks,
  Palette,
  ArrowRight,
  Check,
  ChevronLeft,
  Save,
} from 'lucide-react';
import { api } from '../lib/api';
import { useResource } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import {
  PageHeader,
  Resource,
  Card,
  Button,
  Input,
  Select,
  MultiSelect,
  Switch,
  FormError,
  Badge,
  Textarea,
  useToast,
} from '../components/ui';
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(
  (label, value) => ({ label, value }),
);
const timezones = [
  'Asia/Kolkata',
  'UTC',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Singapore',
  'Australia/Sydney',
];
const settingsNav = [
  ['Company', Building2, 'company'],
  ['Organization', Building2, '/organization/departments'],
  ['Locations', MapPin, '/organization/locations'],
  ['Employee types', Users, '/organization/employee-types'],
  ['Roles', ShieldCheck, '/roles'],
  ['Permissions', ShieldCheck, '/roles'],
  ['Security', ShieldCheck, '/security'],
  ['Notifications', Bell, 'notifications'],
  ['Modules', Blocks, 'modules'],
  ['Branding', Palette, 'branding'],
];
export function SettingsPage() {
  const res = useResource('/settings');
  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Settings"
        description="Make this workspace work for your company."
      />
      <Resource resource={res}>{(data) => <SettingsForm data={data} />}</Resource>
    </>
  );
}
function SettingsForm({ data }) {
  const { refresh, can } = useAuth(),
    toast = useToast(),
    [tab, setTab] = useState('company'),
    [form, setForm] = useState({
      name: data.name,
      settings: {
        timezone: 'Asia/Kolkata',
        work_week: [1, 2, 3, 4, 5],
        hr_email: '',
        notifications: true,
        modules: ['work', 'notifications'],
        brand_name: 'devduo',
        ...data.settings,
      },
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const set = (k, v) => setForm({ ...form, settings: { ...form.settings, [k]: v } });
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[205px_minmax(0,1fr)] [&>section]:max-w-190 [&_form]:max-w-150">
      <nav
        className="flex gap-1 overflow-x-auto pb-2 xl:flex-col [&>a]:flex [&>a]:items-center [&>a]:gap-3 [&>a]:whitespace-nowrap [&>a]:rounded-lg [&>a]:px-4 [&>a]:py-3 [&>a]:text-xs [&>a]:text-slate-600 dark:[&>a]:text-slate-300 [&>button]:flex [&>button]:items-center [&>button]:gap-3 [&>button]:whitespace-nowrap [&>button]:rounded-lg [&>button]:px-4 [&>button]:py-3 [&>button]:text-left [&>button]:text-xs"
        aria-label="Settings sections"
      >
        {settingsNav
          .filter(([label]) => !['Roles', 'Permissions'].includes(label) || can('roles.manage'))
          .filter(
            ([label]) =>
              !['Organization', 'Locations', 'Employee types'].includes(label) ||
              can('organization.view'),
          )
          .map(([label, Icon, target]) =>
            target.startsWith('/') ? (
              <Link key={label} to={target}>
                <Icon size={17} />
                {label}
              </Link>
            ) : (
              <button
                key={label}
                className={
                  tab === target
                    ? 'bg-brand-100 dark:bg-brand-900 font-semibold text-brand-800 dark:text-brand-200'
                    : 'text-slate-600 dark:text-slate-300'
                }
                onClick={() => setTab(target)}
              >
                <Icon size={17} />
                {label}
              </button>
            ),
          )}
      </nav>
      <Card title={settingsNav.find((x) => x[2] === tab)?.[0]}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api('/settings', { method: 'PUT', body: form });
              await refresh();
              toast('Workspace settings saved.');
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <FormError error={error} />
          {tab === 'company' && (
            <>
              <Input
                label="Company name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Select
                label="Timezone"
                value={form.settings.timezone}
                options={[...new Set([...timezones, form.settings.timezone])]}
                onChange={(e) => set('timezone', e.target.value)}
              />
              <Input
                label="HR contact email"
                type="email"
                value={form.settings.hr_email || ''}
                onChange={(e) => set('hr_email', e.target.value)}
              />
              <MultiSelect
                label="Work week"
                options={days}
                value={form.settings.work_week}
                onChange={(v) => set('work_week', v)}
              />
              {!data.setup_completed_at && (
                <Link
                  className="inline-flex items-center gap-2 p-0 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline"
                  to="/setup"
                >
                  Continue company setup <ArrowRight size={16} />
                </Link>
              )}
            </>
          )}
          {tab === 'notifications' && (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Choose whether future company updates should notify your team. Task assignment
                notifications remain available in My Work.
              </p>
              <Switch
                label="Company notifications"
                checked={form.settings.notifications}
                onChange={(v) => set('notifications', v)}
              />
            </>
          )}
          {tab === 'modules' && (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Enable the modules your company needs. Disabled modules are hidden and
                blocked in the API.
              </p>
              {[
                ['work', 'My Work'],
                ['notifications', 'Notification center'],
                ['people', 'People'], ['attendance', 'Attendance'], ['leave', 'Leave'], ['payroll', 'Payroll'],
                ['recruitment', 'Recruitment'], ['lifecycle', 'Lifecycle'], ['performance', 'Performance'],
                ['learning', 'Learning'], ['experience', 'Employee experience'], ['assets', 'Assets'], ['expenses', 'Expenses'], ['travel', 'Travel'], ['workflows', 'Workflows'], ['analytics', 'Analytics'],
              ].map(([value, label]) => (
                <div
                  className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 py-4"
                  key={value}
                >
                  <Switch
                    label={label}
                    checked={form.settings.modules.includes(value)}
                    onChange={(v) =>
                      set(
                        'modules',
                        v
                          ? [...form.settings.modules, value]
                          : form.settings.modules.filter((x) => x !== value),
                      )
                    }
                  />
                  <Badge tone={form.settings.modules.includes(value) ? 'green' : 'neutral'}>{form.settings.modules.includes(value) ? 'Enabled' : 'Disabled'}</Badge>
                </div>
              ))}
              <div className="my-5 rounded-lg border border-brand-100 dark:border-brand-900 bg-brand-50 dark:bg-brand-950 p-4 text-xs leading-7 text-brand-800 dark:text-brand-200">
                Module access also depends on each user's role and employee data scope.
              </div>
            </>
          )}
          {tab === 'branding' && (
            <>
              <Input
                label="Workspace brand name"
                maxLength={80}
                value={form.settings.brand_name || ''}
                onChange={(e) => set('brand_name', e.target.value)}
              />
              <div className="my-5 flex items-center gap-4 rounded-lg bg-brand-50 dark:bg-brand-950 p-6 [&_strong]:text-xl [&_p]:mb-0 [&_p]:mt-1 [&_p]:text-xs">
                <span className="size-12 rounded-xl bg-brand-500" />
                <div>
                  <strong>{form.settings.brand_name || 'devduo'}</strong>
                  <p>Restrained purple · Your people workspace</p>
                </div>
              </div>
            </>
          )}
          <div className="flex items-center gap-2.5 mt-6 justify-end">
            <Button type="submit" loading={busy}>
              <Save size={16} />
              Save changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
const steps = [
  'Company',
  'Legal entity',
  'Location',
  'Departments',
  'Work week',
  'Employee types',
  'Admin & HR',
  'Review',
];
export function SetupPage() {
  const res = useResource('/settings');
  return (
    <>
      <PageHeader
        eyebrow="A STRONG START"
        title="Make yourself at home."
        description="A few thoughtful details to set your company up for better workdays."
      />
      <Resource resource={res}>
        {(data) =>
          data.setup_completed_at ? (
            <Card>
              <div className="px-6 py-12 text-center [&>svg]:mx-auto [&>svg]:text-emerald-600 [&>h2]:mb-3 [&>h2]:mt-5 [&>p]:mb-5 [&>p]:text-sm">
                <Check size={36} />
                <h2>Your company is ready.</h2>
                <p>You can update organization details and preferences in Settings.</p>
                <Link
                  className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-4 py-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-brand-500 text-white shadow-sm hover:bg-brand-600"
                  to="/"
                >
                  Go to overview <ArrowRight size={16} />
                </Link>
              </div>
            </Card>
          ) : (
            <SetupForm data={data} />
          )
        }
      </Resource>
    </>
  );
}
function SetupForm({ data }) {
  const navigate = useNavigate(),
    toast = useToast(),
    { refresh } = useAuth(),
    [step, setStep] = useState(data.setup_step || 1),
    [draft, setDraft] = useState(data.setup_draft || {}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const defaults = {
    1: { name: data.name, timezone: 'Asia/Kolkata' },
    2: { legal_entity: '', registration_number: '' },
    3: { location: '', address: '' },
    4: { departments: [] },
    5: { work_week: [1, 2, 3, 4, 5] },
    6: { employee_types: [] },
    7: { hr_email: data.settings?.hr_email || '', notifications: true },
    8: {},
  };
  const current = draft[step] || defaults[step];
  const set = (key, value) => setDraft({ ...draft, [step]: { ...current, [key]: value } });
  async function save(next = false) {
    setBusy(true);
    setError(null);
    try {
      const result = await api('/setup', {
        method: 'PUT',
        body: { step, data: current, complete: step === 8 && next },
      });
      setDraft(result.setup_draft);
      if (step === 8 && next) {
        await refresh();
        toast('Company setup complete.');
        navigate('/');
      } else if (next) setStep(step + 1);
      else toast('Your progress is saved.');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const lines = (key, label, hint) => (
    <Textarea
      label={label}
      required
      hint={hint}
      value={(current[key] || []).join('\n')}
      onChange={(e) => set(key, e.target.value.split('\n'))}
    />
  );
  return (
    <div className="grid max-w-275 grid-cols-1 items-start gap-8 xl:grid-cols-[215px_minmax(0,1fr)]">
      <aside
        data-testid="setup-steps"
        className="flex gap-1 overflow-x-auto pb-3 xl:flex-col [&>button]:mb-1 [&>button]:flex [&>button]:shrink-0 [&>button]:items-center [&>button]:gap-3 [&>button]:rounded-lg [&>button]:px-3 [&>button]:py-3 [&>button]:text-left [&>button]:text-xs [&>button>span]:flex [&>button>span]:size-7 [&>button>span]:shrink-0 [&>button>span]:items-center [&>button>span]:justify-center [&>button>span]:rounded-full [&>button>span]:border [&>button>span]:border-brand-200 dark:[&>button>span]:border-brand-800 [&>button>span]:text-[10px] [&_small]:mt-1 [&_small]:block [&_small]:text-[10px] [&>p]:mt-6 [&>p]:px-3 [&>p]:text-xs max-xl:[&_small]:hidden max-xl:[&>p]:hidden"
      >
        {steps.map((label, i) => (
          <button
            key={label}
            className={`${step === i + 1 ? 'bg-brand-100 dark:bg-brand-900 text-brand-800 dark:text-brand-200' : 'text-slate-500 dark:text-slate-400'}  ${draft[i + 1] ? '[&>span]:text-emerald-700 dark:[&>span]:text-emerald-300' : ''}`}
            onClick={() => {
              setError(null);
              setStep(i + 1);
            }}
          >
            <span>
              {draft[i + 1] && step !== i + 1 ? (
                <Check size={14} />
              ) : (
                String(i + 1).padStart(2, '0')
              )}
            </span>
            <div>
              {label}
              <small>
                {draft[i + 1]
                  ? 'Progress saved'
                  : i === 7
                    ? 'Check your details'
                    : 'Company foundation'}
              </small>
            </div>
          </button>
        ))}
        <p>You can save your progress and return whenever you’re ready.</p>
      </aside>
      <Card className="min-w-0">
        <div className="px-7 pb-4 pt-7 [&>h2]:mb-2 [&>h2]:text-2xl [&>p]:text-sm">
          <span className="mb-2.5 block text-[10px] font-semibold tracking-widest text-slate-500 dark:text-slate-400">
            STEP {String(step).padStart(2, '0')} OF 08
          </span>
          <h2>{steps[step - 1]}</h2>
          <p>
            {
              [
                'Start with the basics.',
                'Add your primary registered entity.',
                'Where does your team work?',
                'Give your teams a home. One department per line.',
                'Set your usual working days.',
                'Define your employee categories. One type per line.',
                'Choose your HR contact and preferences.',
                'Make sure everything looks right before you finish.',
              ][step - 1]
            }
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(true);
          }}
        >
          <FormError error={error} />
          {step === 1 && (
            <>
              <Input
                label="Company name"
                required
                value={current.name}
                onChange={(e) => set('name', e.target.value)}
              />
              <Select
                label="Timezone"
                value={current.timezone}
                options={timezones}
                onChange={(e) => set('timezone', e.target.value)}
              />
            </>
          )}
          {step === 2 && (
            <>
              <Input
                label="Legal entity name"
                required
                value={current.legal_entity}
                onChange={(e) => set('legal_entity', e.target.value)}
              />
              <Input
                label="Registration number (optional)"
                value={current.registration_number}
                onChange={(e) => set('registration_number', e.target.value)}
              />
            </>
          )}
          {step === 3 && (
            <>
              <Input
                label="Location name"
                required
                value={current.location}
                onChange={(e) => set('location', e.target.value)}
              />
              <Textarea
                label="Address"
                required
                value={current.address}
                onChange={(e) => set('address', e.target.value)}
              />
            </>
          )}
          {step === 4 && lines('departments', 'Departments')}
          {step === 5 && (
            <MultiSelect
              label="Working days"
              options={days}
              value={current.work_week}
              onChange={(v) => set('work_week', v)}
            />
          )}
          {step === 6 && lines('employee_types', 'Employee types')}
          {step === 7 && (
            <>
              <Input
                label="HR contact email"
                required
                type="email"
                value={current.hr_email}
                onChange={(e) => set('hr_email', e.target.value)}
              />
              <Switch
                label="Enable company notifications"
                checked={current.notifications}
                onChange={(v) => set('notifications', v)}
              />
            </>
          )}
          {step === 8 && (
            <div className="[&>section]:border-b [&>section]:border-slate-200 dark:[&>section]:border-slate-700 [&>section]:py-3 [&_h3]:m-0 [&_h3]:text-sm [&>section>div:first-child]:justify-between">
              {steps.slice(0, 7).map((label, i) => (
                <section key={label}>
                  <div className="flex items-center gap-2.5">
                    <h3>{label}</h3>
                    <Button variant="ghost" onClick={() => setStep(i + 1)}>
                      Edit
                    </Button>
                  </div>
                  {draft[i + 1] ? (
                    Object.entries(draft[i + 1]).map(([key, value]) => (
                      <div
                        className="flex justify-between gap-5 py-2 text-xs [&>span]:capitalize [&>strong]:max-w-2/3 [&>strong]:text-right [&>strong]:font-medium [&>strong]:wrap-anywhere"
                        key={key}
                      >
                        <span>{key.replaceAll('_', ' ')}</span>
                        <strong>
                          {key === 'work_week'
                            ? value.map((v) => days[v].label.slice(0, 3)).join(', ')
                            : Array.isArray(value)
                              ? value.join(', ')
                              : typeof value === 'boolean'
                                ? value
                                  ? 'Enabled'
                                  : 'Disabled'
                                : value || '—'}
                        </strong>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-rose-700 dark:text-rose-300">
                      This step needs to be saved.
                    </p>
                  )}
                </section>
              ))}
            </div>
          )}
          <div className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-700 pt-5 max-sm:[&>div]:gap-1">
            <Button
              variant="ghost"
              disabled={step === 1 || busy}
              onClick={() => {
                setStep(step - 1);
                setError(null);
              }}
            >
              <ChevronLeft size={16} />
              Back
            </Button>
            <div className="flex items-center gap-2.5">
              <Button variant="secondary" onClick={() => save(false)} loading={busy}>
                Save progress
              </Button>
              <Button type="submit" loading={busy}>
                {step === 8 ? 'Complete setup' : 'Continue'}
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
