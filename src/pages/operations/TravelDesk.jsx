import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, DataTable, Resource } from '../../components/ui';
import { FormModal } from '../../components/payroll/kit';
import { useResource } from '../../lib/hooks';
import { currencyOptions, operationPaths, send } from '../../lib/operationsApi';

const options = (values) =>
  values.map((value) => ({
    value,
    label: value[0].toUpperCase() + value.slice(1),
  }));

const reason = { name: 'reason', label: 'Decision reason', textarea: true, minLength: 3 };
const settlementLabels = {
  company_owes_employee: 'Company owes employee',
  employee_owes_company: 'Employee owes company',
  settled: 'Settled',
};

export default function TravelDesk({ trip }) {
  const { can, enabled } = useAuth();
  const path = operationPaths.trip(trip.uuid);
  const resource = useResource(path + '/desk');
  const [dialog, setDialog] = useState(null);

  const edit = (title, endpoint, fields = [], initial, body, intro) => {
    setDialog({ title, endpoint, fields, initial, body, intro });
  };

  return (
    <div className="mt-4">
      <Resource resource={resource}>
        {(desk) => {
          const reconciliation = desk.reconciliation;
          const advanceColumns = [
            { key: 'amount', label: 'Amount', render: (row) => row.currency + ' ' + row.amount },
            { key: 'purpose', label: 'Purpose' },
            { key: 'status', label: 'Status', render: (row) => <Badge>{row.status}</Badge> },
            { key: 'finance_reference', label: 'Payment reference' },
            { key: 'decision_reason', label: 'Review note' },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => {
                const advance = '/v1/travel/advances/' + row.uuid;
                return (
                  <div className="flex flex-wrap justify-end gap-2">
                    {row.can_review &&
                      ['approve', 'reject'].map((decision) => (
                        <Button
                          key={decision}
                          variant="secondary"
                          onClick={() =>
                            edit(
                              decision === 'approve' ? 'Approve advance' : 'Reject advance',
                              advance + '/decision',
                              [reason],
                              {},
                              { decision },
                            )
                          }
                        >
                          {decision === 'approve' ? 'Approve' : 'Reject'}
                        </Button>
                      ))}
                    {row.can_cancel && (
                      <Button
                        variant="secondary"
                        onClick={() => edit('Cancel advance', advance + '/cancel')}
                      >
                        Cancel
                      </Button>
                    )}
                    {row.can_reference && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          edit(
                            'Record payment reference',
                            advance + '/reference',
                            [
                              {
                                name: 'reference_type',
                                label: 'Source',
                                options: options(['finance', 'payroll']),
                              },
                              { name: 'reference', label: 'Payment reference' },
                            ],
                            { reference_type: 'finance' },
                            {},
                            'Enter the reference from your finance or payroll system.',
                          )
                        }
                      >
                        Record reference
                      </Button>
                    )}
                  </div>
                );
              },
            },
          ];
          const bookingColumns = [
            { key: 'kind', label: 'Type' },
            { key: 'vendor', label: 'Vendor' },
            { key: 'starts_on', label: 'Start date' },
            { key: 'confirmation_reference', label: 'Confirmation' },
            { key: 'cost', label: 'Cost', render: (row) => row.currency + ' ' + row.cost },
            { key: 'status', label: 'Status', render: (row) => <Badge>{row.status}</Badge> },
            ...(!desk.can_cancel_booking
              ? []
              : [
                  {
                    key: 'actions',
                    label: 'Actions',
                    render: (row) =>
                      row.status === 'booked' && (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            edit(
                              'Cancel booking record',
                              '/v1/travel/bookings/' + row.uuid + '/cancel',
                              [],
                              {},
                              {},
                              'Confirm cancellation with the vendor before updating this record.',
                            )
                          }
                        >
                          Cancel record
                        </Button>
                      ),
                  },
                ]),
          ];
          const claims = [
            { key: 'title', label: 'Claim' },
            { key: 'status', label: 'Status' },
            { key: 'total', label: 'Total', render: (row) => row.currency + ' ' + row.total },
          ];
          return (
            <div className="grid gap-4">
              <Card
                title="Travel advances"
                action={
                  desk.can_request_advance && (
                    <Button
                      onClick={() =>
                        edit('Request travel advance', path + '/advances', [
                          { name: 'amount', label: 'Amount (' + trip.currency + ')' },
                          { name: 'purpose', label: 'Purpose', required: false },
                        ])
                      }
                    >
                      Request advance
                    </Button>
                  )
                }
              >
                <DataTable
                  columns={advanceColumns}
                  rows={desk.advances.map((row) => ({ ...row, id: row.uuid }))}
                  empty={{
                    title: 'No travel advances',
                    description: 'Requests and decisions appear here.',
                  }}
                />
              </Card>
              <Card
                title="Booking records"
                action={
                  desk.can_record_booking && (
                    <Button
                      onClick={() =>
                        edit(
                          'Record booking',
                          path + '/bookings',
                          [
                            {
                              name: 'kind',
                              label: 'Booking type',
                              options: options(['flight', 'hotel', 'rail', 'car', 'other']),
                            },
                            { name: 'vendor', label: 'Vendor' },
                            {
                              name: 'confirmation_reference',
                              label: 'Confirmation reference',
                              required: false,
                            },
                            { name: 'starts_on', label: 'Start date', type: 'date' },
                            { name: 'ends_on', label: 'End date', type: 'date', required: false },
                            { name: 'currency', label: 'Currency', options: currencyOptions },
                            { name: 'cost', label: 'Cost', required: false },
                          ],
                          { currency: trip.currency, starts_on: trip.starts_on },
                        )
                      }
                    >
                      Record booking
                    </Button>
                  )
                }
              >
                <DataTable
                  columns={bookingColumns}
                  rows={desk.bookings.map((row) => ({ ...row, id: row.uuid }))}
                  empty={{ title: 'No booking records' }}
                />
              </Card>
              <Card
                title="Trip reconciliation"
                action={
                  <>
                    <Badge>{reconciliation.status}</Badge>
                    {desk.can_request_advance &&
                      reconciliation.status === 'open' &&
                      can('expenses.self') &&
                      enabled('expenses') && (
                        <Link
                          to={'/expenses?trip=' + encodeURIComponent(trip.uuid)}
                          className="text-xs font-semibold text-brand-700 underline dark:text-brand-300"
                        >
                          Add trip expense
                        </Link>
                      )}
                  </>
                }
              >
                <dl className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-4">
                  {[
                    ['Budget', 'budget'],
                    ['Claim total', 'actual'],
                    ['Recorded advances', 'advance'],
                    ['Settlement', 'settlement'],
                  ].map(([label, key]) => (
                    <div key={key}>
                      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
                      <dd className="text-sm font-semibold">
                        {reconciliation.currency} {reconciliation[key]}
                      </dd>
                    </div>
                  ))}
                </dl>
                {reconciliation.settlement_direction && (
                  <p className="px-4 pb-2 text-xs">
                    {settlementLabels[reconciliation.settlement_direction]}
                  </p>
                )}
                {!!reconciliation.blockers.length && (
                  <ul className="mx-4 mb-4 list-disc rounded-lg bg-amber-50 px-7 py-3 text-xs dark:bg-amber-950">
                    {reconciliation.blockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                )}
                {reconciliation.can_close && (
                  <div className="p-4">
                    <Button
                      onClick={() =>
                        edit(
                          'Close trip reconciliation',
                          path + '/reconciliation',
                          [
                            {
                              name: 'note',
                              label: 'Closing note',
                              textarea: true,
                              required: false,
                            },
                          ],
                          {},
                          {},
                          'Closing records the final reconciliation totals for this trip.',
                        )
                      }
                    >
                      Close reconciliation
                    </Button>
                  </div>
                )}
                <DataTable
                  columns={claims}
                  rows={desk.claims.map((row) => ({ ...row, id: row.uuid }))}
                  empty={{ title: 'No linked expense claims' }}
                />
              </Card>
            </div>
          );
        }}
      </Resource>
      {dialog && (
        <FormModal
          open
          onClose={() => setDialog(null)}
          title={dialog.title}
          fields={dialog.fields}
          initial={dialog.initial}
          intro={dialog.intro}
          submitLabel="Confirm"
          success="Travel desk updated."
          onSubmit={async (values) => {
            const updated = await send('POST', dialog.endpoint, { ...values, ...dialog.body });
            resource.reload();
            return updated;
          }}
        />
      )}
    </div>
  );
}
