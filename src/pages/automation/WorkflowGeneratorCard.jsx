import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, FormError, Input, Textarea } from '../../components/ui';
import { send, useAction } from '../../lib/timeOfficeApi';

const W = '/v1/workflows';
const tone = { approval: 'purple', task: 'neutral', notify: 'green', wait: 'amber' };

/** Applies the reviewer's pick for an unresolved step. Returns a new result; the generator output is never mutated. */
export function resolveStep(result, stepNumber, user) {
  const steps = result.spec.steps.map((s, i) => (i === stepNumber - 1 ? { ...s, assignment: 'fixed', assignees: [user.id] } : s));
  const names = result.steps.map((s, i) => (i === stepNumber - 1 ? { ...s, assignee_names: [user.name], confidence: 'high' } : s));
  return { ...result, spec: { ...result.spec, steps }, steps: names, questions: result.questions.filter((q) => q.step !== stepNumber) };
}

export function WorkflowGeneratorCard({ onSaved }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(null);
  const gen = useAction();
  const save = useAction();
  const ready = result && result.steps.length > 0 && result.questions.length === 0;
  return (
    <Card title="Describe a workflow" className="mb-4">
      <div className="space-y-4 p-5">
        <p className="m-0 text-xs text-slate-600 dark:text-slate-300">
          Write the process in English, Tamil or Tanglish. Devduo drafts the steps for you to review. It uses a keyword-based interpreter, not an AI model.
        </p>
        <Textarea
          label="What should happen?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="When a new employee joins, Hema assigns a laptop within 2 days, then the manager approves, then notify HR"
        />
        <FormError error={gen.error} />
        <Button
          loading={gen.busy}
          disabled={text.trim().length < 8}
          onClick={async () => {
            const r = await gen.run(() => send('POST', `${W}/generate`, { instruction: text }));
            if (r && r !== true) {
              setResult(r);
              setName(r.name_suggestion || '');
              setSaved(null);
            }
          }}
        >
          Generate draft
        </Button>
        {result && (
          <div className="space-y-3 text-xs" role="region" aria-label="Generated draft">
            <p className="m-0">
              Starts: <strong>{result.spec.trigger.type === 'event' ? result.spec.trigger.event_type : 'manually'}</strong> · Language: {result.language}
            </p>
            {result.warnings.map((w) => (
              <p key={w} className="m-0 rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                {w}
              </p>
            ))}
            <ol className="m-0 list-none space-y-2 p-0">
              {result.steps.map((s, i) => (
                <li key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>
                      {i + 1}. {s.title}
                    </strong>
                    <Badge tone={tone[s.action]}>{s.action}</Badge>
                    <Badge tone={s.confidence === 'needs_input' ? 'amber' : 'green'}>{s.confidence.replace('_', ' ')}</Badge>
                  </div>
                  <p className="m-0 mt-1 text-slate-600 dark:text-slate-300">
                    Responsible: {s.assignee_names.length ? s.assignee_names.join(', ') : 'not chosen yet'}
                    {s.matched.length ? ` · understood from: ${s.matched.join(', ')}` : ''}
                  </p>
                </li>
              ))}
            </ol>
            {result.questions.map((q, i) => (
              <div key={i} className="rounded-lg border border-amber-200 p-3 dark:border-amber-800">
                <p className="m-0 mb-2 font-semibold">
                  Step {q.step}: {q.question}
                </p>
                <div className="flex flex-wrap gap-2">
                  {q.candidates.map((c) => (
                    <Button key={c.id} variant="secondary" onClick={() => setResult(resolveStep(result, q.step, c))}>
                      {c.name}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
            {ready && !saved && (
              <div className="space-y-3">
                <FormError error={save.error} />
                <Input label="Workflow name" value={name} onChange={(e) => setName(e.target.value)} required />
                <Button
                  loading={save.busy}
                  disabled={!name.trim()}
                  onClick={async () => {
                    const d = await save.run(() => send('POST', `${W}/generations/${result.generation_uuid}/draft`, { name, spec: result.spec }));
                    if (d && d !== true) {
                      setSaved(d);
                      onSaved?.();
                    }
                  }}
                >
                  Save as draft
                </Button>
              </div>
            )}
            {saved && (
              <p className="m-0" role="status">
                Draft saved.{' '}
                <Link className="underline text-brand-700" to={`/workflows/definitions/${saved.uuid}`}>
                  Open it to simulate and publish
                </Link>
                . Another administrator must publish it.
              </p>
            )}
            <p className="m-0 text-slate-500">{result.limitations}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
