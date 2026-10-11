import { ThemeToggle } from '../lib/theme';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { Brand } from '../components/Layout';
import { Button, Input, Checkbox, FormError, Card, PageHeader, useToast } from '../components/ui';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
export function AuthPage({ mode = 'login' }) {
  const { session, login, expired } = useAuth(),
    navigate = useNavigate(),
    location = useLocation(),
    [params] = useSearchParams();
  const [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    workspace: '',
    email: params.get('email') || '',
    password: '',
    password_confirmation: '',
    remember: false,
  });
  const set = (key) => (e) =>
    setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const title =
    mode === 'login'
      ? 'Good to have you here.'
      : mode === 'forgot'
        ? 'Let’s get you back in.'
        : 'A fresh start.';
  if (session && mode === 'login') return <Navigate to="/" replace />;
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(form);
        navigate(location.state?.from || '/', { replace: true });
      } else {
        const data = await api(mode === 'forgot' ? '/forgot-password' : '/reset-password', {
          method: 'POST',
          body:
            mode === 'forgot'
              ? { email: form.email }
              : {
                  email: form.email,
                  password: form.password,
                  password_confirmation: form.password_confirmation,
                  token: params.get('token') || '',
                },
        });
        setSuccess(data.message);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="relative grid min-h-screen grid-cols-1 bg-white dark:bg-slate-900 min-[769px]:grid-cols-[48%_52%]">
      <div className="absolute right-5 top-5 z-20">
        <ThemeToggle />
      </div>
      <aside className="relative hidden flex-col overflow-hidden bg-brand-50 dark:bg-brand-950 px-14 pb-8 pt-12 min-[769px]:flex max-lg:px-8">
        <Brand />
        <div className="relative my-auto pb-5 pt-16 [&>h1]:mb-6 [&>h1]:text-5xl [&>h1]:font-semibold [&>h1]:leading-tight [&>h1]:tracking-tight [&>h1]:text-brand-900 dark:[&>h1]:text-brand-100 [&_em]:not-italic [&_em]:text-brand-400 [&>p]:max-w-88 [&>p]:text-sm [&>p]:leading-8 [&>p]:text-slate-500 dark:[&>p]:text-slate-400 max-lg:[&>h1]:text-4xl">
          <span className="mb-2.5 block text-[10px] font-semibold tracking-widest text-slate-500 dark:text-slate-400">
            YOUR PEOPLE. YOUR POSSIBILITY.
          </span>
          <h1>
            Great work starts
            <br />
            with <em>your people.</em>
          </h1>
          <p>
            One considered space for the everyday details that help your team do their best work.
          </p>
          <div
            className="relative mt-4 h-60 max-w-100 max-lg:origin-left max-lg:scale-80"
            aria-hidden="true"
          >
            <div className="absolute left-10 top-8 h-44 w-70 -rotate-20 rounded-[50%] border border-brand-200 dark:border-brand-800 before:absolute before:inset-6 before:rounded-[50%] before:border before:border-brand-200 dark:before:border-brand-800 before:content-['']" />
            <div className="absolute bottom-10 h-34 w-20 rounded-t-full rounded-b-2xl bg-brand-200 dark:bg-brand-800 shadow-inner [&>span]:absolute [&>span]:-top-7 [&>span]:left-4 [&>span]:size-12 [&>span]:rounded-full [&>span]:border-[7px] [&>span]:border-brand-300 [&>span]:border-b-transparent [&>span]:bg-orange-100 [&>i]:absolute [&>i]:left-4 [&>i]:top-9 [&>i]:h-2 [&>i]:w-11 [&>i]:-rotate-12 [&>i]:rounded [&>i]:bg-brand-50 dark:[&>i]:bg-brand-950 left-14 h-30 -rotate-9">
              <span />
              <i />
            </div>
            <div className="absolute bottom-10 h-34 w-20 rounded-t-full rounded-b-2xl bg-brand-200 dark:bg-brand-800 shadow-inner [&>span]:absolute [&>span]:-top-7 [&>span]:left-4 [&>span]:size-12 [&>span]:rounded-full [&>span]:border-[7px] [&>span]:border-brand-300 [&>span]:border-b-transparent [&>span]:bg-orange-100 [&>i]:absolute [&>i]:left-4 [&>i]:top-9 [&>i]:h-2 [&>i]:w-11 [&>i]:-rotate-12 [&>i]:rounded [&>i]:bg-brand-50 dark:[&>i]:bg-brand-950 left-38 bottom-11 z-10 bg-brand-400! [&>span]:border-brand-700 [&>span]:border-b-transparent">
              <span />
              <i />
            </div>
            <div className="absolute bottom-10 h-34 w-20 rounded-t-full rounded-b-2xl bg-brand-200 dark:bg-brand-800 shadow-inner [&>span]:absolute [&>span]:-top-7 [&>span]:left-4 [&>span]:size-12 [&>span]:rounded-full [&>span]:border-[7px] [&>span]:border-brand-300 [&>span]:border-b-transparent [&>span]:bg-orange-100 [&>i]:absolute [&>i]:left-4 [&>i]:top-9 [&>i]:h-2 [&>i]:w-11 [&>i]:-rotate-12 [&>i]:rounded [&>i]:bg-brand-50 dark:[&>i]:bg-brand-950 left-61 h-28 rotate-9 bg-violet-200!">
              <span />
              <i />
            </div>
            <div className="absolute bottom-2 left-20 z-20 flex items-center gap-2 rounded-lg border border-brand-100 dark:border-brand-900 bg-white dark:bg-slate-900 px-4 py-3 text-xs text-brand-700 dark:text-brand-300 shadow-sm">
              <span className="inline-flex rounded-full bg-brand-100 dark:bg-brand-900 p-1 text-brand-600 dark:text-brand-300">
                <Check size={16} />
              </span>
              Space to grow, together.
            </div>
          </div>
        </div>
        <div className="z-10 flex justify-between pt-7 text-[9px] tracking-widest text-slate-500 dark:text-slate-400 [&>span]:tracking-normal">
          PEOPLE FIRST. ALWAYS.<span>devduo HRM</span>
        </div>
      </aside>
      <main className="flex min-h-screen min-w-0 flex-col px-16 pb-6 pt-10 max-lg:px-10 max-sm:px-6">
        <div className="mx-auto mt-4 min-[769px]:hidden">
          <Brand />
        </div>
        <div className="m-auto w-full max-w-92 py-10 [&>h2]:mb-3 [&>h2]:text-3xl [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:text-brand-900 dark:[&>h2]:text-brand-100 [&>p]:mb-8 [&>p]:text-sm [&>form>button]:mt-3 [&>form>button]:min-h-11 [&>form>button]:justify-between">
          <span className="mb-2.5 block text-[10px] font-semibold tracking-widest text-slate-500 dark:text-slate-400">
            {mode === 'login' ? 'WELCOME TO YOUR WORKSPACE' : 'ACCOUNT RECOVERY'}
          </span>
          <h2>{title}</h2>
          <p>
            {mode === 'login'
              ? 'Sign in to your people workspace.'
              : mode === 'forgot'
                ? 'Enter your account email and we’ll send a reset link.'
                : 'Choose a strong password to secure your account.'}
          </p>
          {expired && mode === 'login' && (
            <div className="my-5 rounded-lg border border-brand-100 dark:border-brand-900 bg-brand-50 dark:bg-brand-950 p-4 text-xs leading-7 text-brand-800 dark:text-brand-200">
              Your session has expired. Please sign in again.
            </div>
          )}
          {success ? (
            <div
              className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 p-6 text-emerald-700 dark:text-emerald-300 [&>p]:my-3 [&>p]:text-sm"
              role="status"
            >
              <Check size={24} />
              <p>{success}</p>
              <Link
                className="inline-flex items-center gap-2 p-0 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline"
                to="/login"
              >
                Back to sign in <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              <FormError error={error} />
              {mode === 'login' && (
                <Input
                  label="Workspace"
                  placeholder="Your company workspace"
                  required
                  autoComplete="organization"
                  value={form.workspace}
                  onChange={set('workspace')}
                />
              )}
              <Input
                label="Work email"
                type="email"
                placeholder="you@company.com"
                autoComplete="username"
                required
                value={form.email}
                onChange={set('email')}
              />
              {mode !== 'forgot' && (
                <div className="relative [&_input]:pr-12">
                  <Input
                    label={mode === 'reset' ? 'New password' : 'Password'}
                    type={show ? 'text' : 'password'}
                    autoComplete={mode === 'reset' ? 'new-password' : 'current-password'}
                    placeholder={
                      mode === 'reset' ? 'At least 12 characters' : 'Enter your password'
                    }
                    minLength={mode === 'reset' ? 12 : undefined}
                    required
                    value={form.password}
                    onChange={set('password')}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-8 flex p-1 text-slate-400 dark:text-slate-400 hover:text-brand-700 dark:hover:text-brand-300"
                    aria-label={show ? 'Hide password' : 'Show password'}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              )}
              {mode === 'reset' && (
                <Input
                  label="Confirm new password"
                  type="password"
                  minLength={12}
                  required
                  autoComplete="new-password"
                  value={form.password_confirmation}
                  onChange={set('password_confirmation')}
                />
              )}
              {mode === 'login' && (
                <div className="mb-5 mt-6 flex items-center justify-between gap-2 [&>a]:text-xs [&>a]:text-brand-700 dark:[&>a]:text-brand-300">
                  <Checkbox
                    label="Remember me"
                    checked={form.remember}
                    onChange={set('remember')}
                  />
                  <Link to="/forgot-password">Forgot password?</Link>
                </div>
              )}
              <Button type="submit" loading={busy} className="w-full">
                {mode === 'login'
                  ? 'Sign in'
                  : mode === 'forgot'
                    ? 'Send reset link'
                    : 'Reset password'}
                <ArrowRight size={17} />
              </Button>
              {mode !== 'login' && (
                <Link
                  className="mt-5 block text-center text-xs text-brand-700 dark:text-brand-300"
                  to="/login"
                >
                  Back to sign in
                </Link>
              )}
            </form>
          )}
          <div className="my-6 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck size={17} />
            <span>Your workspace. Secure by design.</span>
          </div>
          <p className="mb-0! border-t border-slate-100 dark:border-slate-800 pt-6 text-center text-xs!">
            Need access? Contact your workspace administrator.
          </p>
        </div>
        <div className="text-center text-[10px] text-slate-400 dark:text-slate-400">
          © {new Date().getFullYear()} Devduo. Made for better workdays.
        </div>
      </main>
    </div>
  );
}
export function SecurityPage() {
  const [form, setForm] = useState({
      current_password: '',
      password: '',
      password_confirmation: '',
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    toast = useToast();
  return (
    <>
      <PageHeader title="Password & security" description="Keep your account protected." />
      <Card title="Change your password" className="max-w-156">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const res = await api('/change-password', { method: 'POST', body: form });
              toast(res.message);
              setForm({ current_password: '', password: '', password_confirmation: '' });
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <FormError error={error} />
          {[
            ['current_password', 'Current password'],
            ['password', 'New password'],
            ['password_confirmation', 'Confirm new password'],
          ].map(([key, label]) => (
            <Input
              key={key}
              label={label}
              type="password"
              autoComplete={key === 'current_password' ? 'current-password' : 'new-password'}
              required
              minLength={key === 'current_password' ? undefined : 12}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          ))}
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Use at least 12 characters with letters and numbers. Changing your password signs out
            other sessions.
          </p>
          <Button type="submit" loading={busy}>
            Update password
          </Button>
        </form>
      </Card>
    </>
  );
}
