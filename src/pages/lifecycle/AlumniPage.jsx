import { useState } from 'react';
import { Button, Pagination } from '../../components/ui';
import { FormModal, ListCard, Page, StatusBadge } from '../../components/lifecycle/kit';
import { clean, pageOf, paths, send, useList } from '../../lib/lifecycleApi';

const YES_NO = [
  { value: 'yes', label: 'Eligible for rehire' },
  { value: 'no', label: 'Not eligible' },
];

export default function AlumniPage() {
  const [page, setPage] = useState(1);
  const list = useList(`${paths.alumni}?page=${page}`);
  const [edit, setEdit] = useState(null);
  const label = (a) =>
    a.rehire_eligible === null || a.rehire_eligible === undefined
      ? 'unknown'
      : a.rehire_eligible
        ? 'eligible'
        : 'not eligible';
  const action = (a) => (
    <Button
      variant="secondary"
      aria-label={`Set rehire eligibility for ${a.employee_name ?? a.name}`}
      onClick={() =>
        setEdit({ ...a, eligible: a.rehire_eligible === false ? 'no' : 'yes', note: '' })
      }
    >
      Eligibility
    </Button>
  );
  return (
    <Page
      permission="lifecycle.alumni.manage"
      title="Alumni"
      description="Former employees and rehire eligibility."
    >
      <ListCard
        title="Alumni"
        list={list}
        columns={[
          { key: 'employee_name', label: 'Name', render: (a) => a.employee_name ?? a.name },
          {
            key: 'separation_date',
            label: 'Left on',
            priority: 'md',
            render: (a) => a.separation_date ?? a.last_working_date ?? '—',
          },
          {
            key: 'rehire_eligible',
            label: 'Rehire',
            render: (a) => <StatusBadge value={label(a)} />,
          },
          { key: 'actions', label: 'Actions', render: action },
        ]}
        card={(a) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <strong className="text-sm">{a.employee_name ?? a.name}</strong>
              <StatusBadge value={label(a)} />
            </div>
            <div className="mt-2">{action(a)}</div>
          </div>
        )}
        empty={{ title: 'No alumni', description: 'Separated employees appear here.' }}
      />
      <Pagination data={list.data ? pageOf(list.data) : null} onChange={setPage} />
      <FormModal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title={`Rehire eligibility: ${edit?.employee_name ?? edit?.name ?? ''}`}
        intro="This also updates the separation record used by the rehire flow."
        initial={edit ?? {}}
        fields={[
          { name: 'eligible', label: 'Eligibility', options: YES_NO },
          { name: 'note', label: 'Note', textarea: true, required: false },
        ]}
        onSubmit={async (v) => {
          await send(
            'PUT',
            paths.eligibility(edit.uuid),
            clean({ rehire_eligible: v.eligible === 'yes', note: v.note }),
          );
          list.reload();
        }}
        success="Eligibility updated"
      />
    </Page>
  );
}
