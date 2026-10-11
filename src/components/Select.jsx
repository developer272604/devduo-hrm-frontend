import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/** Shared themed select: native form validation plus a keyboard-accessible options panel. */
export function Select({
  label,
  options = [],
  error,
  value = '',
  onChange,
  disabled = false,
  required = false,
  name,
  id: suppliedId,
}) {
  const generated = useId();
  const id = suppliedId || generated;
  const normalized = options.map((option) =>
    typeof option === 'object' ? option : { value: option, label: option },
  );
  const selected = normalized.findIndex((option) => String(option.value) === String(value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [invalid, setInvalid] = useState(false);
  const root = useRef(null),
    trigger = useRef(null),
    list = useRef(null),
    search = useRef(''),
    timer = useRef(null);
  const available = normalized
    .map((option, index) => (!option.disabled ? index : -1))
    .filter((index) => index >= 0);
  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => {
    if (open)
      list.current
        ?.querySelector(`[data-index="${active}"]`)
        ?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open]);
  useEffect(() => () => clearTimeout(timer.current), []);
  function show() {
    setActive(selected >= 0 ? selected : (available[0] ?? 0));
    setOpen(true);
  }
  function choose(index) {
    const option = normalized[index];
    if (!option || option.disabled) return;
    onChange?.({ target: { value: option.value, name } });
    setInvalid(false);
    setOpen(false);
    trigger.current?.focus();
  }
  function keyDown(event) {
    if (disabled) return;
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) {
        show();
        return;
      }
      const current = available.indexOf(active);
      setActive(
        event.key === 'Home'
          ? available[0]
          : event.key === 'End'
            ? available.at(-1)
            : available[
                (current + (event.key === 'ArrowDown' ? 1 : -1) + available.length) %
                  available.length
              ],
      );
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(active);
      else show();
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === 'Tab') setOpen(false);
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      search.current += event.key.toLowerCase();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        search.current = '';
      }, 650);
      const match = normalized.findIndex(
        (option) =>
          !option.disabled && String(option.label).toLowerCase().startsWith(search.current),
      );
      if (match >= 0) {
        setOpen(true);
        setActive(match);
      }
    }
  }
  const message = error || (invalid ? 'Please choose an option.' : null);
  return (
    <div
      ref={root}
      className="relative mb-5 min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label
        id={`${id}-label`}
        htmlFor={id}
        className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300"
      >
        {label}
      </label>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        aria-required={required}
        aria-invalid={!!message}
        aria-describedby={message ? `${id}-error` : undefined}
        disabled={disabled}
        onKeyDown={keyDown}
        onClick={() => (open ? setOpen(false) : show())}
        className="flex min-h-11 w-full items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-800 outline-none hover:border-brand-400 focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus-visible:ring-brand-900"
      >
        <span id={`${id}-value`} className="truncate">
          {normalized[selected]?.label ?? 'Choose an option'}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-brand-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <select
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        name={name}
        value={value}
        disabled={disabled}
        required={required}
        onChange={onChange}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          trigger.current?.focus();
        }}
      >
        {selected < 0 && <option value="" />}
        {normalized.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {open && (
        <ul
          ref={list}
          id={`${id}-options`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute left-0 right-0 top-full z-40 mt-2 max-h-60 min-w-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
        >
          {normalized.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-option-${index}`}
              data-index={index}
              role="option"
              aria-selected={index === selected}
              aria-disabled={!!option.disabled}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => !option.disabled && setActive(index)}
              onClick={() => choose(index)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm ${option.disabled ? 'cursor-not-allowed opacity-40' : ''} ${index === active ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200' : 'text-slate-700 dark:text-slate-200'} ${index === selected ? 'font-semibold' : ''}`}
            >
              <span>{option.label}</span>
              {index === selected && <Check size={16} className="text-brand-500" />}
            </li>
          ))}
          {!normalized.length && (
            <li className="px-3 py-3 text-sm text-slate-500">No options available</li>
          )}
        </ul>
      )}
      {message && (
        <small
          id={`${id}-error`}
          role="alert"
          className="mt-1 block text-xs text-rose-700 dark:text-rose-300"
        >
          {message}
        </small>
      )}
    </div>
  );
}
