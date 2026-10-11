import { useEffect } from 'react';
import { Navigate, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import Access from '../components/Access';
import { Skeleton } from '../components/ui';
import { api } from '../lib/api';
import EmployeeDirectory from '../pages/people/EmployeeDirectory';
import CoworkerDirectory from '../pages/people/CoworkerDirectory';
import EmployeeCreate from '../pages/people/EmployeeCreate';
import EmployeeProfile from '../pages/people/EmployeeProfile';
import OrgChart from '../pages/people/OrgChart';
import PeopleActionCenter from '../pages/people/PeopleActionCenter';
import ProfileChanges from '../pages/people/ProfileChanges';
import ImportExport from '../pages/people/ImportExport';
import PeopleSettings from '../pages/people/PeopleSettings';
import DataQuality from '../pages/people/DataQuality';

/** Sends the signed-in user to their own profile (falls back to the directory). */
function MyProfile() {
  const navigate = useNavigate();
  useEffect(() => {
    api('/v1/me/employee')
      .then((me) =>
        navigate(me.employee_uuid ? `/people/${me.employee_uuid}` : '/directory', {
          replace: true,
        }),
      )
      .catch(() => navigate('/directory', { replace: true }));
  }, [navigate]);
  return <Skeleton rows={2} />;
}

const gate = (permission, element) => (
  <Access permission={permission} module="people">
    {element}
  </Access>
);

/** Preserve existing task links and their insight filters. */
function LegacyEmployeeLink() {
  const { uuid } = useParams(),
    location = useLocation();
  return (
    <Navigate
      to={`${uuid ? `/people/${encodeURIComponent(uuid)}` : '/people'}${location.search}${location.hash}`}
      replace
    />
  );
}

/** People routes (spread inside the authenticated layout route). One page component per file. */
export const peopleRoutes = (
  <>
    <Route path="employees" element={<LegacyEmployeeLink />} />
    <Route path="employees/:uuid" element={<LegacyEmployeeLink />} />
    <Route path="people" element={gate('people.view', <EmployeeDirectory />)} />
    <Route path="directory" element={gate('people.directory', <CoworkerDirectory />)} />
    <Route path="people/new" element={gate('people.manage', <EmployeeCreate />)} />
    <Route path="people/org-chart" element={gate('people.view|people.directory', <OrgChart />)} />
    <Route
      path="people/action-center"
      element={gate('people.quality.view', <PeopleActionCenter />)}
    />
    <Route path="people/quality" element={gate('people.quality.view', <DataQuality />)} />
    <Route path="people/changes" element={gate('people.view', <ProfileChanges />)} />
    <Route
      path="people/import-export"
      element={gate('people.import|people.export', <ImportExport />)}
    />
    <Route path="people/settings" element={gate('people.settings', <PeopleSettings />)} />
    <Route
      path="people/:uuid"
      element={gate('people.view|people.directory', <EmployeeProfile />)}
    />
    <Route path="my-profile" element={<MyProfile />} />
  </>
);
