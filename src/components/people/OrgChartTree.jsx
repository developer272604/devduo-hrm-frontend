import { useState } from 'react';
import { ChevronRight, ChevronDown, Users } from 'lucide-react';
import { useResource } from '../../lib/hooks';
import { Avatar, Badge, Button, Pagination, Resource, EmptyState } from '../ui';

const factLine = (node) =>
  [node.designation, node.department, node.location].filter(Boolean).join(' · ');

/** One person card. The name opens the preview; the chevron lazily expands direct reports. */
export function OrgChartCard({ node, onSelect, expanded, onToggle, onDrill, ancestors }) {
  const hasChildren = Boolean(node.has_children) && (node.children_count ?? 1) > 0;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      {onToggle && (
        <Button
          variant="ghost"
          className="shrink-0"
          disabled={!hasChildren}
          aria-expanded={hasChildren ? Boolean(expanded) : undefined}
          aria-label={
            hasChildren
              ? `${expanded ? 'Hide' : 'Show'} ${node.children_count} reports of ${node.name}`
              : `${node.name} has no reports`
          }
          onClick={() => onToggle(node)}
        >
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </Button>
      )}
      <Avatar name={node.name} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="max-w-full truncate text-left text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
          onClick={() => onSelect(node)}
        >
          {node.name}
        </button>
        {ancestors?.length > 0 && (
          <p className="truncate text-[11px] text-slate-400 dark:text-slate-400">
            {ancestors.map((a) => a.name).join(' › ')}
          </p>
        )}
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {factLine(node) || 'No role details visible'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {node.is_self && <Badge tone="purple">You</Badge>}
        {node.status && node.status !== 'active' && <Badge>{String(node.status)}</Badge>}
        {node.in_scope === false && <Badge tone="amber">Outside your scope</Badge>}
        {hasChildren && (
          <Badge>
            <Users size={11} className="mr-1" />
            {node.children_count}
          </Badge>
        )}
        {onDrill && hasChildren && (
          <Button variant="secondary" onClick={() => onDrill(node)}>
            View reports
          </Button>
        )}
      </div>
    </div>
  );
}

function OrgChartChildren({ uuid, onSelect }) {
  const [page, setPage] = useState(1),
    resource = useResource(`/v1/people/org-chart/${uuid}/children?page=${page}`);
  return (
    <Resource resource={resource}>
      {(data) =>
        data.data.length ? (
          <>
            <OrgChartLevel nodes={data.data} onSelect={onSelect} />
            <Pagination data={data} onChange={setPage} />
          </>
        ) : (
          <EmptyState title="No reports" description="This person has no visible direct reports." />
        )
      }
    </Resource>
  );
}

function OrgChartBranch({ node, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="my-2">
      <OrgChartCard
        node={node}
        onSelect={onSelect}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />
      {expanded && (
        <div className="ml-3 border-l-2 border-brand-200 pl-2 dark:border-brand-800 sm:ml-8 sm:pl-4">
          <OrgChartChildren uuid={node.uuid} onSelect={onSelect} />
        </div>
      )}
    </li>
  );
}

export function OrgChartLevel({ nodes, onSelect }) {
  return (
    <ul className="list-none p-0">
      {nodes.map((node) => (
        <OrgChartBranch key={node.uuid} node={node} onSelect={onSelect} />
      ))}
    </ul>
  );
}

/** Mobile-first list mode: one level at a time with a breadcrumb stack instead of nested indentation. */
export function OrgChartDrillList({ stack, setStack, rootPage, onSelect }) {
  const top = stack[stack.length - 1],
    [page, setPage] = useState(1),
    resource = useResource(
      top ? `/v1/people/org-chart/${top.uuid}/children?page=${page}` : rootPage.path,
    );
  return (
    <div>
      {stack.length > 0 && (
        <nav aria-label="Reporting path" className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <Button variant="secondary" onClick={() => setStack([])}>
            Top level
          </Button>
          {stack.map((s, i) => (
            <Button
              key={s.uuid}
              variant="secondary"
              disabled={i === stack.length - 1}
              onClick={() => {
                setPage(1);
                setStack(stack.slice(0, i + 1));
              }}
            >
              {s.name}
            </Button>
          ))}
        </nav>
      )}
      <Resource resource={resource}>
        {(data) =>
          data.data.length ? (
            <>
              <ul className="list-none space-y-2 p-0">
                {data.data.map((node) => (
                  <li key={node.uuid}>
                    <OrgChartCard
                      node={node}
                      onSelect={onSelect}
                      onDrill={(n) => {
                        setPage(1);
                        setStack([...stack, { uuid: n.uuid, name: n.name }]);
                      }}
                    />
                  </li>
                ))}
              </ul>
              <Pagination data={data} onChange={top ? setPage : rootPage.setPage} />
            </>
          ) : (
            <EmptyState title="No employees found" description="No visible people at this level." />
          )
        }
      </Resource>
    </div>
  );
}
