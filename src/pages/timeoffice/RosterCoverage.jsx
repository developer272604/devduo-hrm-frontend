import { useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  DataTable,
  Input,
  Resource,
  Select,
  useToast,
} from '../../components/ui';
import { FormDialog } from '../../components/timeoffice/CrudPanel';
import { useResource } from '../../lib/hooks';
import { currencyOptions } from '../../lib/operationsApi';
import { paths, send, unwrap } from '../../lib/timeOfficeApi';

const scaleByCurrency = { JPY: 0, KWD: 3 };
const targetFields = [
  { name: 'minimum', label: 'Saved staffing target', type: 'number', min: 0, max: 50000 },
];

function parseRate(value, scale) {
  const [whole, fraction = '', ...extra] = value.split('.');
  if (
    !/^\d{1,9}$/.test(whole) ||
    !/^\d*$/.test(fraction) ||
    fraction.length > scale ||
    extra.length
  ) {
    return null;
  }
  return BigInt(whole + fraction.padEnd(scale, '0'));
}

function estimatedCost(minutes, rate, currency, scale) {
  const minor = (BigInt(minutes) * rate + 30n) / 60n;
  const digits = minor.toString().padStart(scale + 1, '0');
  return currency + ' ' + (scale ? digits.slice(0, -scale) + '.' + digits.slice(-scale) : digits);
}

export default function RosterCoverage({ roster, from, to, shiftOptions, onViewDay }) {
  const [minimum, setMinimum] = useState('');
  const [checked, setChecked] = useState(null);
  const [editing, setEditing] = useState(null);
  const [shortfallsOnly, setShortfallsOnly] = useState(false);
  const toast = useToast();
  const [shift, setShift] = useState('');
  const [rate, setRate] = useState('');
  const [currency, setCurrency] = useState('INR');
  const scale = scaleByCurrency[currency] ?? 2;
  const minorRate = rate.trim() ? parseRate(rate.trim(), scale) : null;
  const hours = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  const path =
    checked &&
    paths.roster(roster.uuid, 'coverage') +
      '?' +
      new URLSearchParams({
        from,
        to,
        minimum: checked.minimum,
        ...(checked.shift ? { shift_uuid: checked.shift } : {}),
      });
  const resource = useResource(path);
  const columns = [
    { key: 'date', label: 'Date' },
    { key: 'scheduled', label: 'Scheduled' },
    {
      key: 'scheduled_minutes',
      label: 'Scheduled hours',
      render: (row) =>
        row.scheduled_minutes == null ? '-' : hours.format(row.scheduled_minutes / 60),
    },
    { key: 'full_leave', label: 'Full-day leave' },
    { key: 'partial_leave', label: 'Partial leave' },
    { key: 'available', label: 'Available for full shift' },
    {
      key: 'minimum',
      label: 'Minimum staff',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span>
            {row.minimum}
            {row.saved_minimum != null && ' (saved)'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Edit target for ${row.date}`}
            onClick={() =>
              setEditing({ date: row.date, minimum: row.saved_minimum, shift: checked.shift })
            }
          >
            Edit
          </Button>
        </div>
      ),
    },
    {
      key: 'shortfall',
      label: 'Coverage',
      render: ({ date, shortfall }) =>
        shortfall > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-amber-800 dark:text-amber-200">{shortfall} short</strong>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`View roster for ${date}`}
              onClick={() => onViewDay(date)}
            >
              View day
            </Button>
          </div>
        ) : (
          <span className="text-emerald-700 dark:text-emerald-300">Target met</span>
        ),
    },
  ];
  if (minorRate !== null) {
    columns.push({
      key: 'cost',
      label: 'Estimated labor cost',
      render: (row) =>
        row.scheduled_minutes == null
          ? '-'
          : estimatedCost(row.scheduled_minutes, minorRate, currency, scale),
    });
  }

  return (
    <Card title="Staffing coverage">
      <p className="px-5 pb-3 text-xs">
        Compare scheduled headcount with a minimum for each day. The check includes roster drafts
        and excludes approved leave from full-shift availability. Cost estimates apply one hourly
        rate to scheduled work hours before leave adjustments.
      </p>
      <form
        className="flex flex-wrap items-start gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (minimum === checked?.minimum && shift === checked?.shift) resource.reload();
          else setChecked({ minimum, shift });
        }}
      >
        <Input
          label="Minimum staff per day"
          required
          type="number"
          min={1}
          max={50000}
          value={minimum}
          onChange={(event) => setMinimum(event.target.value)}
        />
        <Select
          label="Coverage shift"
          value={shift}
          options={[{ value: '', label: 'All shifts' }, ...shiftOptions]}
          onChange={(event) => setShift(event.target.value)}
        />
        <Select
          label="Planning currency"
          value={currency}
          options={currencyOptions}
          onChange={(event) => setCurrency(event.target.value)}
        />
        <Input
          label="Hourly planning rate"
          inputMode="decimal"
          maxLength={13}
          value={rate}
          error={
            rate.trim() && minorRate === null
              ? 'Enter a nonnegative amount with up to ' + scale + ' decimal places.'
              : undefined
          }
          onChange={(event) => setRate(event.target.value)}
        />
        <Button type="submit" variant="secondary" className="mt-6">
          Check coverage
        </Button>
      </form>
      {checked && (
        <Resource
          resource={{
            ...resource,
            loading: resource.loading || (resource.data === null && !resource.error),
          }}
        >
          {(data) => {
            const rows = unwrap(data).map((row) => ({ ...row, id: row.date }));
            const shortfalls = rows.filter((row) => row.shortfall > 0);
            const totalShortfall = shortfalls.reduce((total, row) => total + row.shortfall, 0);
            return (
              <>
                {data.shift && (
                  <p className="px-5 pb-3 text-xs font-semibold">Coverage for {data.shift.name}</p>
                )}
                {rows.length > 0 && (
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <dl
                      aria-label="Coverage summary"
                      className="m-0 flex flex-wrap gap-x-6 gap-y-2"
                    >
                      <div>
                        <dt className="text-xs">Days below target</dt>
                        <dd className="m-0 text-lg font-semibold tabular-nums">
                          {shortfalls.length} / {rows.length}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs">Staff needed across dates</dt>
                        <dd className="m-0 text-lg font-semibold tabular-nums">{totalShortfall}</dd>
                      </div>
                    </dl>
                    <Checkbox
                      label="Show shortfalls only"
                      checked={shortfallsOnly}
                      onChange={(event) => setShortfallsOnly(event.target.checked)}
                    />
                  </div>
                )}
                <DataTable
                  columns={columns}
                  rows={shortfallsOnly ? shortfalls : rows}
                  empty={
                    rows.length > 0
                      ? {
                          title: 'All dates meet the staffing target',
                          description: 'Clear the shortfalls filter to see all dates.',
                        }
                      : {
                          title: 'No dates in this roster',
                          description: 'Choose a period that overlaps the roster dates.',
                        }
                  }
                />
              </>
            );
          }}
        </Resource>
      )}
      <FormDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Staffing target for ${editing?.date ?? ''}`}
        fields={targetFields}
        row={editing}
        notice={
          <p className="mb-3 text-sm">
            This target is saved for your account and the checked shift. Leave it blank to use the
            default minimum for this day.
          </p>
        }
        onSubmit={async ({ minimum }) => {
          await send('PUT', paths.roster(roster.uuid, 'coverage/target'), {
            date: editing.date,
            minimum,
            shift_uuid: editing.shift || null,
          });
          toast(minimum === null ? 'Staffing target cleared' : 'Staffing target saved');
          resource.reload();
        }}
      />
    </Card>
  );
}
