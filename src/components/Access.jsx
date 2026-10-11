import { useAuth } from '../lib/auth';
import { ErrorState } from './ui';

/** Route/section gate. `permission` may be 'a|b' (any of). Backend authorization is authoritative; this only avoids dead ends. */
export default function Access({ permission, module, children, fallback }) {
  const { can, enabled } = useAuth();
  if (!can(permission) || !enabled(module))
    return (
      fallback ?? (
        <ErrorState
          error={{
            status: 403,
            message:
              'Your role or workspace settings do not allow access to this page. Contact your administrator.',
          }}
        />
      )
    );
  return children;
}
