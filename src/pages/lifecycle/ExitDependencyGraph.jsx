import { Badge, Card, ErrorState, Skeleton } from '../../components/ui';
import { useList } from '../../lib/timeOfficeApi';

const STATE = {
  clear: { tone: 'green', text: 'clear' },
  blocked: { tone: 'amber', text: 'blocked' },
  not_checked: { tone: 'neutral', text: 'not checked here' },
  ready: { tone: 'green', text: 'ready' },
  ready_unchecked: { tone: 'purple', text: 'ready, with unchecked items' },
};

/** Groups nodes by depth: checks first, then the steps that wait for them. Exported for tests. */
export function layers(nodes) {
  const byKey = Object.fromEntries(nodes.map((n) => [n.key, n]));
  const depth = (k, seen = new Set()) => {
    const n = byKey[k];
    if (!n || !n.depends_on?.length || seen.has(k)) return 0;
    seen.add(k);
    return 1 + Math.max(...n.depends_on.map((d) => depth(d, seen)));
  };
  const out = [];
  nodes.forEach((n) => {
    const d = depth(n.key);
    (out[d] ||= []).push(n);
  });
  return out.filter(Boolean);
}

export function ExitDependencyGraph({ employeeUuid }) {
  const g = useList(`/v1/lifecycle/employees/${employeeUuid}/dependency-graph`);
  if (g.loading) return <Skeleton />;
  if (g.error) return <ErrorState error={g.error} onRetry={g.reload} />;
  const d = g.data;
  const names = Object.fromEntries(d.nodes.map((n) => [n.key, n.label]));
  return (
    <Card title="Exit dependencies" className="mb-5">
      <div className="space-y-4 text-xs">
        <p className="m-0">
          Final settlement: <Badge tone={STATE[d.settlement_state]?.tone}>{STATE[d.settlement_state]?.text ?? d.settlement_state}</Badge>
          {d.next_actions.length > 0 && <span className="ml-2">Start with: {d.next_actions.map((a) => a.label).join(', ')}</span>}
        </p>
        {layers(d.nodes).map((layer, i) => (
          <div key={i}>
            <p className="m-0 mb-2 text-[10px] font-semibold tracking-widest text-slate-400">{i === 0 ? 'CHECKS' : i === 1 ? 'THEN' : 'FINALLY'}</p>
            <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {layer.map((n) => (
                <li key={n.key} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <p className="m-0 mb-1 flex flex-wrap items-center gap-2">
                    <strong>{n.label}</strong>
                    <Badge tone={STATE[n.state]?.tone}>{STATE[n.state]?.text ?? n.state}</Badge>
                  </p>
                  {n.blockers.map((b) => (
                    <p key={b} className="m-0 text-amber-800 dark:text-amber-200">{b}</p>
                  ))}
                  {n.depends_on.length > 0 && <p className="m-0 text-slate-500">Waits for: {n.depends_on.map((k) => names[k] ?? k).join(', ')}</p>}
                  {n.blocked_by.length > 0 && <p className="m-0 text-amber-800 dark:text-amber-200">Held up by: {n.blocked_by.map((k) => names[k] ?? k).join(', ')}</p>}
                  {n.unchecked_by.length > 0 && <p className="m-0 text-slate-500">Cannot confirm: {n.unchecked_by.map((k) => names[k] ?? k).join(', ')}</p>}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="m-0 text-slate-500">{d.limitations}</p>
      </div>
    </Card>
  );
}
