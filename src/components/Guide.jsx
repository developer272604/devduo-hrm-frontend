import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, X, Users, Target, ListOrdered, ArrowRight } from 'lucide-react';
import { Button, Card, PageHeader, Search } from './ui';
import { GUIDE, guideFor } from '../lib/guideContent';

const KEY = 'devduo.guide.dismissed';

function readDismissed() {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function writeDismissed(map) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* storage blocked: the card simply returns next visit */
  }
}

function Steps({ steps }) {
  return (
    <ol className="m-0 grid list-none gap-2 p-0">
      {steps.map((step, i) => (
        <li key={step} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span className="mt-0.5 inline-grid size-5 shrink-0 place-items-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
            {i + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

/** First-visit tour card shown at the top of a section; dismissible, and reopenable from the header. */
export function SectionIntro({ pathname, forceOpen = false, onClose }) {
  const entry = guideFor(pathname);
  const [dismissed, setDismissed] = useState(readDismissed);
  if (!entry) return null;
  if (!forceOpen && dismissed[entry.id]) return null;
  const close = () => {
    const next = { ...dismissed, [entry.id]: true };
    setDismissed(next);
    writeDismissed(next);
    onClose?.();
  };
  return (
    <section
      aria-label={`About ${entry.title}`}
      className="mb-5 rounded-xl border border-brand-200 bg-brand-50/70 p-4 dark:border-brand-800 dark:bg-brand-950/60 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="ui-stat-icon">
            <Lightbulb size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="m-0 text-base">New here? What is {entry.title} for?</h2>
            <p className="mt-1 text-sm">{entry.purpose}</p>
          </div>
        </div>
        <Button variant="ghost" aria-label={`Dismiss ${entry.title} guide`} onClick={close}>
          <X size={18} />
        </Button>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Target size={14} aria-hidden="true" /> Why it matters
          </h3>
          <p className="m-0 text-sm">{entry.whyItMatters}</p>
          <h3 className="mb-2 mt-4 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Users size={14} aria-hidden="true" /> Who uses it
          </h3>
          <p className="m-0 text-sm">{entry.whoUses}</p>
        </div>
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <ListOrdered size={14} aria-hidden="true" /> First steps
          </h3>
          <Steps steps={entry.firstSteps} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={close}>
          Got it, hide this
        </Button>
        <Link to="/guide" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
          Full guide for every section <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

export function GuidePage() {
  const [query, setQuery] = useState('');
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const items = GUIDE.filter((g) =>
    terms.every((t) => `${g.title} ${g.purpose} ${g.whoUses} ${g.whyItMatters}`.toLowerCase().includes(t)),
  );
  const reset = () => {
    writeDismissed({});
    window.location.reload();
  };
  return (
    <>
      <PageHeader
        eyebrow="HELP"
        title="Guide to your workspace"
        description="What each section is for, who uses it, and what to do first when it is still empty."
        action={
          <Button variant="secondary" onClick={reset}>
            Show first-visit tips again
          </Button>
        }
      />
      <div className="mb-5">
        <Search value={query} onChange={setQuery} placeholder="Search the guide, e.g. leave, payslip, onboarding" />
      </div>
      {items.length === 0 ? (
        <p>No section matches “{query}”. Try a shorter word.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((g) => (
            <Card key={g.id} title={g.title} action={<Link to={g.link || g.prefix} className="text-xs font-semibold text-brand-700 dark:text-brand-300">Open</Link>}>
              <div className="grid gap-4 px-4 pb-4 pt-3">
                <p className="m-0 text-sm text-slate-700 dark:text-slate-200">{g.purpose}</p>
                <dl className="m-0 grid gap-2 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Who uses it</dt>
                    <dd className="m-0">{g.whoUses}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Why it matters</dt>
                    <dd className="m-0">{g.whyItMatters}</dd>
                  </div>
                </dl>
                <div>
                  <h3 className="mb-2 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">First steps</h3>
                  <Steps steps={g.firstSteps} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
