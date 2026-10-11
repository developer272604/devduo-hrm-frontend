import { Link } from 'react-router-dom';
import { Avatar, Badge, Drawer } from '../ui';

const rows = (node) => [
  ['Designation', node.designation],
  ['Department', node.department],
  ['Location', node.location],
  ['Status', node.status],
  ['Direct reports', node.children_count ?? 0],
];

/** Read-only preview built only from the (privacy-filtered) org chart node. */
export default function OrgChartPreview({ node, onClose }) {
  return (
    <Drawer open={Boolean(node)} onClose={onClose} title="Employee preview">
      {node && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Avatar name={node.name} size="large" />
            <div>
              <p className="text-base font-semibold">{node.name}</p>
              {node.is_self && <Badge tone="purple">You</Badge>}
            </div>
          </div>
          {node.ancestors?.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Reports through {node.ancestors.map((a) => a.name).join(' › ')}
            </p>
          )}
          <dl className="grid grid-cols-2 gap-3 text-xs">
            {rows(node).map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className="mt-1 font-medium capitalize">
                  {value || <span className="font-normal text-slate-400">Not visible</span>}
                </dd>
              </div>
            ))}
          </dl>
          {node.in_scope === false ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This person is outside your data scope, so the full profile is unavailable.
            </p>
          ) : (
            <Link
              to={`/people/${node.uuid}`}
              className="inline-flex min-h-10 items-center rounded-lg bg-brand-500 px-4 text-xs font-semibold text-white hover:bg-brand-600"
            >
              Open full profile
            </Link>
          )}
        </div>
      )}
    </Drawer>
  );
}
