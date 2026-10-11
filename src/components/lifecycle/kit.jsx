import { useEffect, useState } from 'react';
import Access from '../Access';
import { PageHeader } from '../ui';
import { api } from '../../lib/api';
import { listOf, paths } from '../../lib/lifecycleApi';

export {
  ConfirmDialog,
  FormModal,
  ListCard,
  Section,
  StatusBadge,
  Tiles,
  useDo,
  KeyValues,
  optionsOf,
} from '../payroll/kit';
export { Banner } from '../timeoffice/parts';

/** Page chrome plus permission gate. */
export function Page({ permission, title, description, action, children }) {
  return (
    <Access permission={permission} module="lifecycle">
      <PageHeader
        title={title}
        description={description}
        action={action && <div className="flex flex-wrap gap-2">{action}</div>}
      />
      {children}
    </Access>
  );
}

/** Employees as select options. Failure degrades to an empty list. */
export function useEmployeeOptions() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let live = true;
    api(paths.employees)
      .then((r) => live && setRows(listOf(r)))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, []);
  return rows.map((e) => ({
    value: e.uuid,
    label: [e.name ?? e.full_name, e.employee_number].filter(Boolean).join(' · ') || e.uuid,
  }));
}
