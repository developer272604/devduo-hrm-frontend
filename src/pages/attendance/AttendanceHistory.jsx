import { useState } from 'react';
import { useResource } from '../../lib/hooks';
import { api, query } from '../../lib/api';
import {
  Card,
  Resource,
  Input,
  DataTable,
  Pagination,
  Badge,
  Button,
  Modal,
  useToast,
} from '../../components/ui';

export default function AttendanceHistory({ employee }) {
  const today = new Date().toLocaleDateString('en-CA'),
    [from, setFrom] = useState(today.slice(0, 7) + '-01'),
    [to, setTo] = useState(today),
    [page, setPage] = useState(1),
    [detail, setDetail] = useState(null),
    toast = useToast();
  const resource = useResource(`/v1/attendance/days?${query({ from, to, page, employee })}`);
  async function explain(row) {
    try {
      setDetail(await api(`/v1/attendance/days/${row.uuid}`));
    } catch (e) {
      toast(e.message, 'error');
    }
  }
  return (
    <>
      <Card>
        <div className="flex flex-wrap items-end gap-4 p-5">
          <Input
            label="From"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
          <Input
            label="To"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
          <Button variant="secondary" onClick={resource.reload}>
            Refresh
          </Button>
        </div>
        <Resource resource={resource}>
          {(data) => (
            <>
              <DataTable
                rows={data.data.map((r) => ({ ...r, id: r.uuid }))}
                columns={[
                  ...(!employee ? [{ key: 'employee_name', label: 'Employee' }] : []),
                  { key: 'attendance_date', label: 'Date' },
                  {
                    key: 'status',
                    label: 'Attendance',
                    render: (r) => <Badge>{r.status.replaceAll('_', ' ')}</Badge>,
                  },
                  { key: 'net_minutes', label: 'Worked (min)' },
                  { key: 'late_minutes', label: 'Late (min)' },
                  { key: 'overtime_minutes', label: 'Overtime (min)' },
                  { key: 'finalization', label: 'Finalization' },
                  {
                    key: 'explain',
                    label: 'Why?',
                    render: (r) => (
                      <Button variant="secondary" onClick={() => explain(r)}>
                        Explain day
                      </Button>
                    ),
                  },
                ]}
              />
              <Pagination data={data} onChange={setPage} />
            </>
          )}
        </Resource>
      </Card>
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Attendance explainer">
        <p className="mb-2 text-lg font-semibold">
          {detail?.explanation?.headline || detail?.status?.replaceAll('_', ' ')}
        </p>
        <p className="mb-5 text-xs text-slate-500 dark:text-slate-400">
          {detail?.attendance_date} · calculation version {detail?.calculation_version} ·{' '}
          {detail?.confidence?.replaceAll('_', ' ')}
        </p>
        <dl className="space-y-4">
          {detail?.explanation?.lines?.map((line, i) => (
            <div key={i}>
              <dt className="text-xs text-slate-500 dark:text-slate-400">{line.label}</dt>
              <dd className="mt-1 text-sm">{line.value}</dd>
            </div>
          ))}
        </dl>
        {detail?.explanation?.facts?.map((fact, i) => (
          <p key={i} className="mt-3 text-sm">
            {fact}
          </p>
        ))}
      </Modal>
    </>
  );
}
