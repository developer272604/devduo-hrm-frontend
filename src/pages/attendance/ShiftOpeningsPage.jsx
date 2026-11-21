import { useState } from 'react';
import { api } from '../../lib/api';
import { useResource } from '../../lib/hooks';
import {
  Badge,
  Button,
  Card,
  DataTable,
  FormError,
  PageHeader,
  Pagination,
  Resource,
} from '../../components/ui';
import { FormModal } from '../../components/payroll/kit';

const path = '/v1/shift-openings';

export default function ShiftOpeningsPage() {
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const resource = useResource(path + '?page=' + page);
  const columns = [
    { key: 'work_date', label: 'Date' },
    { key: 'shift', label: 'Shift' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge>{row.awarded_to_me ? 'Awarded to you' : row.status}</Badge>,
    },
    { key: 'bid_at', label: 'Your application', render: (row) => (row.bid_at ? 'Applied' : '-') },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) =>
        row.status === 'open' && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await api(path + '/' + row.uuid + '/bid', {
                  method: 'POST',
                  body: { apply: !row.bid_at },
                });
                resource.reload();
              } catch (failure) {
                setError(failure);
              } finally {
                setBusy(false);
              }
            }}
          >
            {row.bid_at ? 'Withdraw bid' : 'Apply for shift'}
          </Button>
        ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Open shifts"
        description="Apply for available shifts and track the result. Check your schedule after the roster is published."
      />
      <FormError error={error} />
      <Card>
        <Resource resource={resource}>
          {(data) => (
            <>
              <DataTable
                columns={columns}
                rows={data.data.map((row) => ({ ...row, id: row.uuid }))}
                empty={{
                  title: 'No open shifts for you',
                  description: 'Your roster team openings will appear here.',
                }}
              />
              <Pagination data={data} onChange={setPage} />
            </>
          )}
        </Resource>
      </Card>
    </>
  );
}

function OpeningBids({ opening, onChanged }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const resource = useResource(path + '/' + opening.uuid + '/bids?page=' + page);
  const columns = [
    { key: 'name', label: 'Employee' },
    { key: 'bid_at', label: 'Applied on', render: (row) => row.bid_at.slice(0, 10) },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) =>
        opening.status === 'open' && (
          <Button variant="secondary" onClick={() => setSelected(row)}>
            Award shift
          </Button>
        ),
    },
  ];
  return (
    <Card title={opening.shift + ' applications'}>
      <Resource resource={resource}>
        {(data) => (
          <>
            <DataTable
              columns={columns}
              rows={data.data.map((row) => ({ ...row, id: row.uuid }))}
              empty={{ title: 'No applications yet' }}
            />
            <Pagination data={data} onChange={setPage} />
          </>
        )}
      </Resource>
      {selected && (
        <FormModal
          open
          title={'Award shift to ' + selected.name}
          submitLabel="Award shift"
          intro="The award adds a draft shift. Publish the roster when it is ready."
          success="Shift awarded. Roster draft updated."
          onClose={() => setSelected(null)}
          onSubmit={async () => {
            await api(path + '/' + opening.uuid + '/decision', {
              method: 'POST',
              body: { action: 'award', employee_uuid: selected.uuid },
            });
            onChanged(true);
            return true;
          }}
        />
      )}
    </Card>
  );
}

export function RosterOpenShifts({ roster, shiftOptions, onRosterChanged }) {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const rosterPath = '/v1/rosters/' + roster.uuid + '/open-shifts';
  const resource = useResource(rosterPath + '?page=' + page);
  const refresh = (awarded = false) => {
    setSelected(null);
    setPage(1);
    resource.reload();
    if (awarded) onRosterChanged();
  };
  const columns = [
    { key: 'work_date', label: 'Date' },
    { key: 'shift', label: 'Shift' },
    { key: 'status', label: 'Status', render: (row) => <Badge>{row.status}</Badge> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setSelected(row)}>
            View applications
          </Button>
          {row.status === 'open' && (
            <Button variant="secondary" onClick={() => setCancelling(row)}>
              Cancel opening
            </Button>
          )}
        </div>
      ),
    },
  ];
  return (
    <div className="grid gap-3">
      <Card
        title="Roster shift openings"
        action={
          <Button variant="secondary" onClick={() => setCreating(true)}>
            Post open shift
          </Button>
        }
      >
        <Resource resource={resource}>
          {(data) => (
            <>
              <DataTable
                columns={columns}
                rows={data.data.map((row) => ({ ...row, id: row.uuid }))}
                empty={{ title: 'No openings created by you' }}
              />
              <Pagination data={data} onChange={setPage} />
            </>
          )}
        </Resource>
      </Card>
      {selected && <OpeningBids key={selected.uuid} opening={selected} onChanged={refresh} />}
      {creating && (
        <FormModal
          open
          title="Post open shift"
          submitLabel="Post shift"
          intro="Eligible members in your roster scope can apply for this vacancy."
          fields={[
            { name: 'date', label: 'Shift date', type: 'date' },
            { name: 'shift_uuid', label: 'Shift', options: shiftOptions },
          ]}
          onClose={() => setCreating(false)}
          success="Open shift posted."
          onSubmit={async (body) => {
            const result = await api(rosterPath, { method: 'POST', body });
            refresh();
            return result;
          }}
        />
      )}
      {cancelling && (
        <FormModal
          open
          title="Cancel shift opening"
          submitLabel="Confirm cancellation"
          intro="Close the vacancy and stop accepting applications."
          onClose={() => setCancelling(null)}
          success="Shift opening cancelled."
          onSubmit={async () => {
            await api(path + '/' + cancelling.uuid + '/decision', {
              method: 'POST',
              body: { action: 'cancel' },
            });
            refresh();
            return true;
          }}
        />
      )}
    </div>
  );
}
