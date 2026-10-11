import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  X,
  Search as SearchIcon,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  Inbox,
  LoaderCircle,
} from 'lucide-react';
const buttonVariants = {
  primary: 'bg-brand-500 text-white shadow-sm hover:bg-brand-600',
  secondary:
    'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-950',
  ghost:
    'bg-transparent p-2 text-slate-500 dark:text-slate-400 hover:bg-brand-50 dark:hover:bg-brand-950 hover:text-brand-700 dark:hover:text-brand-300',
  danger: 'bg-rose-700 text-white hover:bg-rose-800',
};
const badgeTones = {
  neutral:
    'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300',
  purple:
    'border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300',
  green:
    'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
  amber:
    'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200',
};
export function Button({
  children,
  variant = 'primary',
  loading = false,
  type = 'button',
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-4 py-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant] || buttonVariants.primary}  ${className}`}
      {...props}
      disabled={props.disabled || loading}
    >
      {loading ? (
        <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" />
      ) : null}
      {children}
    </button>
  );
}
export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <div className="mb-5 min-w-0 [&>label]:mb-2 [&>label]:block [&>label]:text-xs [&>label]:font-semibold [&>label]:text-slate-600 dark:[&>label]:text-slate-300 [&>small]:mt-1 [&>small]:block">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
      {error && (
        <small className="text-xs text-rose-700 dark:text-rose-300" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
export function Input({ label, error, hint, id, ...props }) {
  const generated = useId(),
    key = id || generated;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={key}>
      <input
        className="w-full min-h-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:border-brand-400 focus:outline-2 focus:outline-brand-100"
        id={key}
        aria-invalid={!!error}
        {...props}
      />
    </Field>
  );
}
export function Textarea({ label, error, ...props }) {
  const id = useId();
  return (
    <Field label={label} error={error} htmlFor={id}>
      <textarea
        className="w-full min-h-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:border-brand-400 focus:outline-2 focus:outline-brand-100 min-h-24 resize-y"
        id={id}
        rows={3}
        {...props}
      />
    </Field>
  );
}
export { Select } from './Select';
export function MultiSelect({ label, options, value, onChange }) {
  return (
    <fieldset className="mb-5 flex flex-wrap gap-x-5 gap-y-4 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 [&>legend]:px-1 [&>legend]:text-xs [&>legend]:font-semibold [&>legend]:text-slate-600 dark:[&>legend]:text-slate-300">
      <legend>{label}</legend>
      {options.map((o) => (
        <Checkbox
          key={o.value}
          label={o.label}
          checked={value.includes(o.value)}
          onChange={(e) =>
            onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))
          }
        />
      ))}
    </fieldset>
  );
}
export function Checkbox({ label, ...props }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300 [&>input]:size-4 [&>input]:min-h-4 [&>input]:w-4 [&>input]:accent-brand-500">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
export function Radio({ label, ...props }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300 [&>input]:size-4 [&>input]:min-h-4 [&>input]:w-4 [&>input]:accent-brand-500">
      <input type="radio" {...props} />
      <span>{label}</span>
    </label>
  );
}
export function Switch({ label, checked, onChange, disabled }) {
  return (
    <button
      type="button"
      className="group/switch flex items-center gap-3 py-2 text-left text-sm"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span
        className={`inline-flex h-5 w-9 rounded-full bg-slate-300 dark:bg-slate-600 p-0.5 transition-colors group-aria-checked/switch:bg-brand-500 [&>i]:block [&>i]:size-4 [&>i]:rounded-full [&>i]:bg-white dark:[&>i]:bg-slate-900 [&>i]:shadow-sm [&>i]:transition-transform group-aria-checked/switch:[&>i]:translate-x-4 `}
      >
        <i />
      </span>
      {label}
    </button>
  );
}
export const DatePicker = (props) => <Input type="date" {...props} />;
export const TimePicker = (props) => <Input type="time" {...props} />;
export function DateRange({ from, to, onChange }) {
  return (
    <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
      <DatePicker
        label="From date"
        value={from}
        onChange={(e) => onChange({ from: e.target.value, to })}
      />
      <DatePicker
        label="To date"
        min={from}
        value={to}
        onChange={(e) => onChange({ from, to: e.target.value })}
      />
    </div>
  );
}
export const Badge = ({ children, tone = 'neutral' }) => (
  <span
    className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize ${badgeTones[tone] || badgeTones.neutral}`}
  >
    {children}
  </span>
);
export const Avatar = ({ name = '', size = 'normal' }) => (
  <span
    className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900 text-xs font-semibold text-brand-700 dark:text-brand-300 ${size === 'small' ? 'size-7' : 'size-9'}`}
    aria-label={name}
  >
    {name
      .split(' ')
      .map((s) => s[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()}
  </span>
);
export const Tooltip = ({ label, children }) => (
  <span
    className="relative inline-flex [&>[role=tooltip]]:absolute [&>[role=tooltip]]:bottom-full [&>[role=tooltip]]:left-1/2 [&>[role=tooltip]]:z-50 [&>[role=tooltip]]:mb-2 [&>[role=tooltip]]:hidden [&>[role=tooltip]]:-translate-x-1/2 [&>[role=tooltip]]:whitespace-nowrap [&>[role=tooltip]]:rounded [&>[role=tooltip]]:bg-slate-800 [&>[role=tooltip]]:px-3 [&>[role=tooltip]]:py-2 [&>[role=tooltip]]:text-xs [&>[role=tooltip]]:text-white hover:[&>[role=tooltip]]:block focus:[&>[role=tooltip]]:block"
    tabIndex={0}
  >
    {children}
    <span role="tooltip">{label}</span>
  </span>
);
export function Popover({ trigger, children }) {
  const [open, set] = useState(false),
    ref = useRef();
  useEffect(() => {
    const close = (e) => {
      if (!ref.current?.contains(e.target)) set(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  return (
    <div
      className="relative"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === 'Escape') set(false);
      }}
    >
      <button
        type="button"
        className="flex items-center gap-2.5 p-0"
        aria-expanded={open}
        onClick={() => set(!open)}
      >
        {trigger}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-4 min-w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl [&>a]:flex [&>a]:items-center [&>a]:gap-2 [&>a]:rounded [&>a]:p-3 [&>a]:text-xs [&>a]:hover:bg-brand-50 dark:[&>a]:hover:bg-brand-950 [&>button]:flex [&>button]:w-full [&>button]:items-center [&>button]:gap-2 [&>button]:rounded [&>button]:p-3 [&>button]:text-xs [&>button]:hover:bg-brand-50 dark:[&>button]:hover:bg-brand-950"
          onClick={() => set(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}
export const Dropdown = Popover;
export function Modal({ open, onClose, title, children, drawer = false }) {
  const ref = useRef(),
    titleId = useId(),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const wasLocked = document.body.classList.contains('overflow-hidden');
    document.body.classList.add('overflow-hidden');
    const el = ref.current;
    el?.focus();
    const key = (e) => {
      if (e.key === 'Escape') {
        // Let an open dropdown consume Escape before closing its parent dialog.
        if (e.target.closest('[role="combobox"][aria-expanded="true"]')) return;
        closeRef.current();
      }
      if (e.key === 'Tab') {
        const items = el.querySelectorAll(
          'button:not(:disabled),input:not(:disabled):not([tabindex="-1"]),select:not(:disabled):not([tabindex="-1"]),textarea:not(:disabled),a[href],[tabindex="0"]',
        );
        const first = items[0],
          last = items[items.length - 1];
        if (!first) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last || document.activeElement === el)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    el?.addEventListener('keydown', key);
    return () => {
      if (!wasLocked) document.body.classList.remove('overflow-hidden');
      el?.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center bg-slate-950/40 backdrop-blur-sm ${drawer ? 'justify-start' : 'justify-center p-4 sm:p-6'}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`w-full overflow-y-auto border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl outline-none ${drawer ? 'h-dvh max-h-dvh max-w-80 rounded-none p-5' : 'max-h-[90dvh] max-w-xl rounded-xl p-6'}`}
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="mb-6 flex items-center justify-between gap-3 [&>h2]:m-0 [&>h2]:text-lg">
          <h2 id={titleId}>{title}</h2>
          <Button variant="ghost" aria-label="Close dialog" onClick={onClose}>
            <X size={19} />
          </Button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
}
export const Drawer = (props) => <Modal {...props} drawer />;
export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title = 'Delete this record?',
  loading,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p>This action cannot be undone. Check that this record is no longer needed.</p>
      <div className="flex items-center gap-2.5 mt-6 justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          Delete record
        </Button>
      </div>
    </Modal>
  );
}
export function Tabs({ items, value, onChange }) {
  const ref = useRef();
  return (
    <div
      className="flex gap-6 overflow-x-auto border-b border-slate-200 dark:border-slate-700 px-5 [&>button]:whitespace-nowrap [&>button]:border-b-2 [&>button]:border-transparent [&>button]:px-1 [&>button]:py-4 [&>button]:text-xs [&>button]:text-slate-500 dark:[&>button]:text-slate-400 [&>button[aria-selected=true]]:border-brand-700 [&>button[aria-selected=true]]:font-semibold [&>button[aria-selected=true]]:text-brand-700 dark:[&>button[aria-selected=true]]:text-brand-300"
      role="tablist"
      ref={ref}
    >
      {items.map((x, i) => (
        <button
          key={x.value}
          role="tab"
          aria-selected={value === x.value}
          tabIndex={value === x.value ? 0 : -1}
          onClick={() => onChange(x.value)}
          onKeyDown={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
              e.preventDefault();
              const next =
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? items.length - 1
                    : (i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
              onChange(items[next].value);
              ref.current.children[next].focus();
            }
          }}
        >
          {x.label}
        </button>
      ))}
    </div>
  );
}
export const Accordion = ({ title, children }) => (
  <details className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 [&>summary]:cursor-pointer [&>summary]:text-sm">
    <summary>{title}</summary>
    {children}
  </details>
);
export const Breadcrumb = ({ items }) => (
  <nav
    className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-400 [&>span]:flex [&>span]:items-center [&>span]:gap-2 [&>span:last-child]:text-slate-600 dark:[&>span:last-child]:text-slate-300 max-sm:[&>a]:hidden max-sm:[&>span:not(:last-child)]:hidden"
    aria-label="Breadcrumb"
  >
    <Link to="/">Workspace</Link>
    {items.map((x, i) => (
      <span key={i}>
        <ChevronRight size={12} />
        {x}
      </span>
    ))}
  </nav>
);
export function Pagination({ data, onChange }) {
  if (!data || data.last_page <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 px-5 py-4">
      <small>
        {data.total} records · Page {data.current_page} of {data.last_page}
      </small>
      <div className="flex items-center gap-2.5">
        <Button
          variant="secondary"
          aria-label="Previous page"
          disabled={data.current_page === 1}
          onClick={() => onChange(data.current_page - 1)}
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          variant="secondary"
          aria-label="Next page"
          disabled={data.current_page === data.last_page}
          onClick={() => onChange(data.current_page + 1)}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
export const Skeleton = ({ rows = 4 }) => (
  <div className="p-5" aria-label="Loading" role="status">
    {Array.from({ length: rows }, (_, i) => (
      <div
        className="mb-4 h-16 animate-pulse rounded-lg bg-brand-100/70 dark:bg-brand-900/70 even:w-4/5 motion-reduce:animate-none"
        key={i}
      />
    ))}
  </div>
);
export const EmptyState = ({
  title = 'Nothing here yet',
  description = 'New records will appear here.',
  action,
}) => (
  <div className="px-6 py-10 text-center text-brand-300 [&>svg]:mx-auto [&>svg]:mb-3 [&>h3]:mb-2 [&>h3]:text-sm [&>h3]:text-slate-600 dark:[&>h3]:text-slate-300 [&>p]:mx-auto [&>p]:mb-3 [&>p]:max-w-xs [&>p]:text-xs [&>p]:text-slate-500 dark:[&>p]:text-slate-400">
    <Inbox size={28} />
    <h3>{title}</h3>
    <p>{description}</p>
    {action}
  </div>
);
export function ErrorState({ error, onRetry }) {
  return (
    <div
      className="px-6 py-10 text-center text-rose-500 [&>svg]:mx-auto [&>svg]:mb-3 [&>h3]:mb-2 [&>h3]:text-sm [&>h3]:text-rose-800 dark:[&>h3]:text-rose-200 [&>p]:mx-auto [&>p]:mb-4 [&>p]:max-w-sm [&>p]:text-sm"
      role="alert"
    >
      <AlertCircle size={24} />
      <h3>{error?.status === 403 ? 'Access restricted' : 'We couldn’t load this page'}</h3>
      <p>{error?.message || 'Check your connection and try again.'}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function Resource({ resource, children }) {
  if (resource.loading) return <Skeleton />;
  if (resource.error) return <ErrorState error={resource.error} onRetry={resource.reload} />;
  return children(resource.data);
}
export function DataTable({ columns, rows, empty }) {
  if (!rows?.length) return <EmptyState {...empty} />;
  return (
    <div className="w-full overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-xs [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-slate-200 dark:[&_th]:border-slate-700 [&_th]:bg-slate-50 dark:[&_th]:bg-slate-950 [&_th]:px-5 [&_th]:py-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-slate-500 dark:[&_th]:text-slate-400 [&_td]:max-w-88 [&_td]:border-b [&_td]:border-slate-100 dark:[&_td]:border-slate-800 [&_td]:px-5 [&_td]:py-4 [&_td]:align-middle [&_td]:text-slate-600 dark:[&_td]:text-slate-300 [&_td]:wrap-anywhere [&_tr:last-child_td]:border-b-0 [&_tbody_tr]:hover:bg-brand-50/30 dark:[&_tbody_tr]:hover:bg-brand-950/30 max-[769px]:overflow-visible max-[769px]:[&_table]:block max-[769px]:[&_thead]:hidden max-[769px]:[&_tbody]:block max-[769px]:[&_tr]:block max-[769px]:[&_tr]:border-b max-[769px]:[&_tr]:border-slate-200 dark:max-[769px]:[&_tr]:border-slate-700 max-[769px]:[&_tr]:px-4 max-[769px]:[&_tr]:py-3 max-[769px]:[&_td]:flex max-[769px]:[&_td]:max-w-none max-[769px]:[&_td]:items-center max-[769px]:[&_td]:justify-between max-[769px]:[&_td]:gap-5 max-[769px]:[&_td]:border-0 max-[769px]:[&_td]:px-0 max-[769px]:[&_td]:py-2 max-[769px]:[&_td]:text-right max-[769px]:[&_td]:before:shrink-0 max-[769px]:[&_td]:before:text-left max-[769px]:[&_td]:before:text-xs max-[769px]:[&_td]:before:text-slate-500 dark:max-[769px]:[&_td]:before:text-slate-400 max-[769px]:[&_td]:before:content-[attr(data-label)]">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => (
                <td data-label={c.label} key={c.key}>
                  {c.render ? c.render(row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export const FilterBar = ({ children }) => (
  <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 dark:border-slate-700 p-5 [&>div]:mb-0 [&>div]:flex [&>div]:items-center [&>div]:gap-3 [&_label]:whitespace-nowrap [&_select]:w-auto max-sm:[&>div]:w-full">
    {children}
  </div>
);
export function Search({ value, onChange, placeholder = 'Search records…', ...props }) {
  return (
    <label className="flex min-w-48 max-w-96 flex-1 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-slate-400 dark:text-slate-400 [&>input]:min-h-9 [&>input]:w-full [&>input]:border-0 [&>input]:py-2 [&>input]:text-xs [&>input]:outline-none">
      <SearchIcon size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      />
    </label>
  );
}
export const StatCard = ({ label, value, detail, icon: Icon }) => (
  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 [&>strong]:my-3 [&>strong]:block [&>strong]:text-3xl [&>strong]:font-semibold [&>strong]:text-brand-800 dark:[&>strong]:text-brand-200 [&>small]:text-[11px] max-sm:p-3">
    <div className="flex items-start justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 [&>svg]:text-brand-300">
      {label}
      {Icon && <Icon size={17} />}
    </div>
    <strong>{value ?? '—'}</strong>
    <small>{detail}</small>
  </div>
);
export const ActivityTimeline = ({ items }) => (
  <ol className="m-0 list-none p-0 [&>li]:flex [&>li]:gap-4 [&>li]:pb-5 [&_strong]:text-sm [&_p]:my-2 [&_p]:text-xs">
    {items.map((x, i) => (
      <li key={x.id ?? i}>
        <span className="mt-1 size-2.5 shrink-0 rounded-full bg-brand-400" />
        <div>
          <strong>{x.title}</strong>
          <p>{x.description}</p>
          <small>{x.time}</small>
        </div>
      </li>
    ))}
  </ol>
);
export const PageHeader = ({ eyebrow, title, description, action }) => (
  <header className="mb-7 flex items-center justify-between gap-5 [&_h1]:mb-2 [&_p]:m-0 [&_p]:text-xs max-sm:items-start max-sm:[&>button]:px-2 max-sm:[&>button]:text-[0px] max-sm:[&>a]:px-2 max-sm:[&>a]:text-[0px]">
    <div>
      {eyebrow && (
        <span className="mb-2.5 block text-[10px] font-semibold tracking-widest text-slate-500 dark:text-slate-400">
          {eyebrow}
        </span>
      )}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {action}
  </header>
);
export const Card = ({ title, action, children, className = '' }) => (
  <section
    className={`overflow-visible rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 [&>form]:px-6 [&>form]:pb-6 [&>form]:pt-1 ${className}`}
  >
    {title && (
      <div className="flex items-center justify-between gap-3 px-6 pb-4 pt-5 [&>h2]:m-0 [&>h2]:text-sm">
        <h2>{title}</h2>
        {action}
      </div>
    )}
    {children}
  </section>
);
export function FormError({ error }) {
  return error ? (
    <div
      className="mb-5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950 px-4 py-3 text-sm text-rose-800 dark:text-rose-200 [&>ul]:mt-2 [&>ul]:list-disc [&>ul]:pl-5"
      role="alert"
    >
      {error.message}
      {Object.keys(error.errors || {}).length > 0 && (
        <ul>
          {Object.entries(error.errors).map(([k, v]) => (
            <li key={k}>{v.join(' ')}</li>
          ))}
        </ul>
      )}
    </div>
  ) : null;
}
const ToastContext = createContext(null);
let toastSequence = 0;
export function ToastProvider({ children }) {
  const [toasts, set] = useState([]);
  const notify = (message, tone = 'success') => {
    const id = globalThis.crypto?.randomUUID?.() ?? `toast-${Date.now()}-${++toastSequence}`;
    set((t) => [...t, { id, message, tone }]);
    setTimeout(() => set((t) => t.filter((x) => x.id !== id)), 5000);
  };
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        className="fixed bottom-6 right-6 z-[100] flex max-w-[calc(100vw-36px)] flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            className={`flex items-center gap-3 rounded-lg border bg-white dark:bg-slate-900 px-5 py-4 text-xs shadow-xl [&>button]:ml-2 [&>button]:flex [&>button]:p-0 ${t.tone === 'error' ? 'border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300' : 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'}`}
            key={t.id}
          >
            <Check size={18} />
            {t.message}
            <button
              aria-label="Dismiss notification"
              onClick={() => set((v) => v.filter((x) => x.id !== t.id))}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
