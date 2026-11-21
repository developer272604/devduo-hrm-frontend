import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';

/**
 * Explains, before the user fills a form, that the feature needs an employee profile linked to
 * this login. Renders nothing when a profile is linked (or the session has not loaded yet).
 * Server authorization stays in place; this only surfaces the requirement.
 */
export default function ProfileLinkNotice({ feature }) {
  const { session, can } = useAuth();
  if (!session || session.has_employee_profile !== false) return null;
  return (
    <div role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <strong>No employee profile is linked to your login.</strong> {feature} needs one.{' '}
      {can('people.manage') ? (
        <>
          Add yourself as an employee in <Link className="underline" to="/people/new">People</Link> and link it to this login.
        </>
      ) : (
        'Ask an administrator to link your login to an employee profile.'
      )}
    </div>
  );
}
