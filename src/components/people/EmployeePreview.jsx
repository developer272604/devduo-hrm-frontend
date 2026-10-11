import { Link } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import { Drawer } from '../ui';
import PersonAvatar from './PersonAvatar';
import StatusBadge from './StatusBadge';

/** Quick preview drawer: only what the list already returned (so it never exposes extra data). */
export default function EmployeePreview({ row, onClose, profileLink = true }) {
  const name = row?.display_name || row?.name || '';
  const facts = row
    ? [
        ['Employee number', row.employee_number],
        ['Designation', row.designation],
        ['Department', row.department],
        ['Location', row.location],
        ['Employee type', row.employee_type],
        ['Manager', row.manager?.name],
        ['Joined', row.joined_on],
      ].filter(([, v]) => v)
    : [];
  return (
    <Drawer open={Boolean(row)} onClose={onClose} title={name || 'Employee'}>
      {row && (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <PersonAvatar uuid={row.uuid} name={name} hasPhoto={row.has_photo !== false} large />
            <div className="min-w-0">
              <p className="m-0 text-sm text-slate-500 dark:text-slate-400">{row.pronouns}</p>
              <StatusBadge status={row.status} />
            </div>
          </div>
          <dl className="m-0 grid grid-cols-2 gap-4 text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-xs text-slate-500 dark:text-slate-400">{k}</dt>
                <dd className="m-0 wrap-break-word font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-3 text-sm">
            {row.work_email && (
              <a className="inline-flex items-center gap-2 text-brand-600 dark:text-brand-300" href={`mailto:${row.work_email}`}>
                <Mail size={16} /> {row.work_email}
              </a>
            )}
            {row.work_phone && (
              <a className="inline-flex items-center gap-2 text-brand-600 dark:text-brand-300" href={`tel:${row.work_phone}`}>
                <Phone size={16} /> {row.work_phone}
              </a>
            )}
          </div>
          {profileLink && (
            <Link
              className="inline-flex min-h-10 items-center rounded-lg bg-brand-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-brand-600"
              to={`/people/${row.uuid}`}
            >
              Open full profile
            </Link>
          )}
        </div>
      )}
    </Drawer>
  );
}
