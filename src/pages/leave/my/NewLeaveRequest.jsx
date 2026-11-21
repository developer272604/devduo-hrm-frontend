import { Link, useSearchParams } from 'react-router-dom';
import { useResource } from '../../../lib/hooks';
import { useAuth } from '../../../lib/auth';
import ProfileLinkNotice from '../../../components/ProfileLinkNotice';
import { leavePaths, listOf, unwrap } from '../../../lib/leaveApi';
import { EmptyState, PageHeader, Resource } from '../../../components/ui';
import NewRequestForm from '../../../components/leave/my/NewRequestForm';

function NoTypes() {
  const { can } = useAuth();
  const manage = can('leave.policy.manage|leave.manage');
  return (
    <>
    <ProfileLinkNotice feature="Requesting leave" />
    <EmptyState
      title="No leave types available"
      description={
        manage
          ? 'Either no leave type has been set up yet, or none applies to your employee profile (eligibility rules, or no linked employee profile). Set up leave types first, then check eligibility on the policy.'
          : 'No leave type is open to you yet. Contact HR if you think this is a mistake.'
      }
      action={manage ? <Link className="underline" to="/leave/hr/types">Set up leave types</Link> : undefined}
    />
    </>
  );
}

function Types({ children }) {
  const types = useResource(`${leavePaths.types}?active_only=1`);
  return (
    <Resource resource={types}>
      {(res) =>
        listOf(res).length ? (
          children(listOf(res))
        ) : (
          <NoTypes />
        )
      }
    </Resource>
  );
}

function ModifyForm({ uuid }) {
  const original = useResource(leavePaths.request(uuid));
  return (
    <Resource resource={original}>
      {(res) => {
        const o = unwrap(res);
        return (
          <Types>
            {(types) => (
              <NewRequestForm
                types={types}
                mode="modify"
                original={o}
                initial={{
                  leave_type: o.type?.uuid ?? '',
                  start_date: o.start_date,
                  end_date: o.end_date,
                  portion: o.portion || 'full_day',
                  start_time: o.start_time || '',
                  end_time: o.end_time || '',
                  reason: o.reason_hidden ? '' : o.reason || '',
                  handover_notes: o.handover_notes || '',
                }}
              />
            )}
          </Types>
        );
      }}
    </Resource>
  );
}

function ClaimForm({ uuid }) {
  const credits = useResource(`${leavePaths.compOff}?scope=mine`);
  return (
    <Resource resource={credits}>
      {(res) => {
        const credit = listOf(res).find((c) => c.uuid === uuid);
        if (!credit)
          return <EmptyState title="Comp-off credit not found" description="It may have expired or been used already." />;
        return (
          <Types>
            {(types) => (
              <NewRequestForm
                types={types}
                mode="claim"
                credit={credit}
                initial={{ leave_type: credit.leave_type?.uuid ?? credit.leave_type_uuid ?? '' }}
              />
            )}
          </Types>
        );
      }}
    </Resource>
  );
}

/** /leave/new, /leave/new?type=<uuid>, /leave/new?modify=<request> or /leave/new?compoff=<credit>. */
export default function NewLeaveRequest() {
  const [params] = useSearchParams();
  const modify = params.get('modify');
  const compoff = params.get('compoff');
  return (
    <>
      <PageHeader
        title={modify ? 'Change approved leave' : compoff ? 'Use comp-off' : 'Request leave'}
        description="See the exact impact on your balance before you submit."
        action={
          <Link className="text-xs font-semibold text-brand-700 underline dark:text-brand-300" to="/leave">
            Back to my leave
          </Link>
        }
      />
      {modify ? (
        <ModifyForm key={modify} uuid={modify} />
      ) : compoff ? (
        <ClaimForm key={compoff} uuid={compoff} />
      ) : (
        <Types>
          {(types) => {
            const pre = params.get('type');
            return <NewRequestForm types={types} initial={{ leave_type: types.some((t) => t.uuid === pre) ? pre : '' }} />;
          }}
        </Types>
      )}
    </>
  );
}
