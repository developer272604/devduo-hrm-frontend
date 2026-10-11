import { EmptyState } from './ui';

/**
 * Large operational lists that adapt instead of squeezing (spec: no 15-column tables on a phone).
 *
 *  desktop (lg+)   dense table, every column
 *  tablet  (md)    reduced columns (priority "always" and "md") — row click opens a detail drawer
 *  mobile  (<md)   one card per row: title, subtitle, badge and a few facts
 *
 * columns: [{ key, label, render?(row), priority: 'always' | 'md' | 'lg' }]
 * card:    (row) => ReactNode — optional custom card; otherwise a generic card is derived from `mobile`
 * mobile:  { title: key|fn, subtitle?: key|fn, badge?: key|fn, facts?: [{label, value: key|fn}] }
 *
 * Both layouts are rendered and switched with Tailwind breakpoints (no JS media queries), so there is no
 * layout flash and tests can query either.
 */
const priorityClass = { always: '', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' };

const pick = (row, accessor) => (typeof accessor === 'function' ? accessor(row) : row[accessor]);

export default function ResponsiveList({
  columns,
  rows,
  rowKey = (row) => row.uuid ?? row.id,
  onRowClick,
  card,
  mobile,
  empty,
  selected,
  onToggle,
  label = 'Records',
}) {
  if (!rows?.length) return <EmptyState {...empty} />;
  const clickable = Boolean(onRowClick);
  return (
    <>
      <div className="hidden w-full overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-xs" aria-label={label}>
          <thead>
            <tr>
              {onToggle && <th className="w-10 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950" />}
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 ${priorityClass[c.priority || 'always']}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = rowKey(row);
              return (
                <tr
                  key={id}
                  className={`hover:bg-brand-50/40 dark:hover:bg-brand-950/40 ${clickable ? 'cursor-pointer' : ''}`}
                  onClick={clickable ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(row);
                        }
                      : undefined
                  }
                  tabIndex={clickable ? 0 : undefined}
                >
                  {onToggle && (
                    <td className="border-b border-slate-100 px-4 py-3 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="size-4 accent-brand-500"
                        aria-label={`Select ${pick(row, mobile?.title) ?? id}`}
                        checked={selected?.has(id) || false}
                        onChange={() => onToggle(row)}
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`max-w-72 border-b border-slate-100 px-4 py-3 align-middle text-slate-600 wrap-anywhere dark:border-slate-800 dark:text-slate-300 ${priorityClass[c.priority || 'always']}`}
                    >
                      {c.render ? c.render(row) : (row[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800 md:hidden" aria-label={label}>
        {rows.map((row) => {
          const id = rowKey(row);
          return (
            <li key={id}>
              <div
                className={`flex items-start gap-3 px-4 py-3 ${clickable ? 'cursor-pointer active:bg-brand-50 dark:active:bg-brand-950' : ''}`}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => onRowClick(row) : undefined}
                onKeyDown={clickable ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
              >
                {onToggle && (
                  <input
                    type="checkbox"
                    className="mt-1 size-5 accent-brand-500"
                    aria-label={`Select ${pick(row, mobile?.title) ?? id}`}
                    checked={selected?.has(id) || false}
                    onChange={() => onToggle(row)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <div className="min-w-0 flex-1">
                  {card ? (
                    card(row)
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <strong className="min-w-0 truncate text-sm text-slate-800 dark:text-slate-100">{pick(row, mobile?.title) ?? '—'}</strong>
                        {mobile?.badge && <span className="shrink-0">{pick(row, mobile.badge)}</span>}
                      </div>
                      {mobile?.subtitle && <p className="m-0 mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{pick(row, mobile.subtitle)}</p>}
                      {mobile?.facts?.length > 0 && (
                        <dl className="m-0 mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                          {mobile.facts.map((f) => (
                            <div key={f.label} className="min-w-0">
                              <dt className="text-slate-400 dark:text-slate-400">{f.label}</dt>
                              <dd className="m-0 truncate text-slate-700 dark:text-slate-200">{pick(row, f.value) ?? '—'}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
