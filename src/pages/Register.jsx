import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Eye, EyeOff } from 'lucide-react';
import { ThemeToggle } from '../lib/theme';
import { Brand } from '../components/Layout';
import { Button, Input, FormError } from '../components/ui';
import { useAuth } from '../lib/auth';

const perks = [
  'Full access to every HRMS module for 24 hours',
  'No credit card required',
  'After the trial, the HRMS owner approves your account to continue',
];

export function RegisterPage() {
  const { session, register } = useAuth(),
    navigate = useNavigate();
  const [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [form, setForm] = useState({ company_name: '', name: '', email: '', password: '', password_confirmation: '' });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  if (session) return <Navigate to="/" replace />;
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  const fieldError = (key) => error?.errors?.[key]?.[0];
  return (
    <div className="relative min-h-screen bg-white dark:bg-slate-900">
      <div className="absolute right-5 top-5 z-20">
        <ThemeToggle />
      </div>
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-6 pt-10">
        <div className="mx-auto">
          <Brand />
        </div>
        <div className="m-auto w-full py-10">
          <span className="mb-2.5 block text-[10px] font-semibold tracking-widest text-slate-500 dark:text-slate-400">
            24-HOUR FREE TRIAL
          </span>
          <h2 className="mb-3 text-3xl font-semibold tracking-tight text-brand-900 dark:text-brand-100">
            Start your free trial.
          </h2>
          <ul className="mb-8 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-brand-500" />
                {p}
              </li>
            ))}
          </ul>
          <form onSubmit={submit}>
            <FormError error={error} />
            <Input label="Company name" required autoComplete="organization" value={form.company_name} onChange={set('company_name')} error={fieldError('company_name')} />
            <Input label="Your name" required autoComplete="name" value={form.name} onChange={set('name')} error={fieldError('name')} />
            <Input label="Work email" type="email" required autoComplete="username" placeholder="you@company.com" value={form.email} onChange={set('email')} error={fieldError('email')} />
            <div className="relative [&_input]:pr-12">
              <Input
                label="Password"
                type={show ? 'text' : 'password'}
                required
                minLength={12}
                autoComplete="new-password"
                placeholder="At least 12 characters, letters and numbers"
                value={form.password}
                onChange={set('password')}
                error={fieldError('password')}
              />
              <button
                type="button"
                className="absolute right-2 top-8 flex p-1 text-slate-400 hover:text-brand-700 dark:hover:text-brand-300"
                aria-label={show ? 'Hide password' : 'Show password'}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <Input label="Confirm password" type={show ? 'text' : 'password'} required minLength={12} autoComplete="new-password" value={form.password_confirmation} onChange={set('password_confirmation')} />
            <Button type="submit" loading={busy} className="mt-3 w-full min-h-11 justify-between">
              Start free trial
              <ArrowRight size={17} />
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Already have a workspace?{' '}
            <Link to="/login" className="text-brand-700 dark:text-brand-300">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
