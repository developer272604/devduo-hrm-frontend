import { useState } from 'react';
import { api } from '../../lib/api';
import { currencyOptions } from '../../lib/operationsApi';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import { RemoteSelect } from '../../components/DomainWorkspace';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  FormError,
  Modal,
  Input,
  PageHeader,
  Pagination,
  Resource,
  Select,
  Search,
  Tabs,
  useToast,
} from '../../components/ui';

const base = '/v1/projects';
const hours = (minutes) => (minutes / 60).toLocaleString(undefined, { maximumFractionDigits: 2 });
const weekPath = (week) => '?week_start=' + encodeURIComponent(week);

function monday(date) {
  const day = new Date(date + 'T12:00:00Z');
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

const timeColumns = [
  { key: 'date', label: 'Date' },
  { key: 'project_name', label: 'Project' },
  { key: 'minutes', label: 'Hours', render: (row) => hours(row.minutes) },
  {
    key: 'billable',
    label: 'Billing',
    render: (row) => (row.billable ? 'Billable' : 'Non-billable'),
  },
  { key: 'note', label: 'Note' },
];

function Timesheet({ initial }) {
  const [sheet, setSheet] = useState(initial);
  const [entry, setEntry] = useState({
    project: '',
    date: initial.week_start,
    minutes: '',
    billable: false,
    note: '',
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const editable = ['draft', 'rejected'].includes(sheet.status);
  const set = (key, value) => setEntry((current) => ({ ...current, [key]: value }));
  const rows = sheet.entries.map((row, id) => ({ ...row, id }));
  const columns = editable
    ? [
        ...timeColumns,
        {
          key: 'actions',
          label: 'Actions',
          render: ({ id }) => (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                setSheet((current) => ({
                  ...current,
                  entries: current.entries.filter((_, index) => index !== id),
                }))
              }
            >
              Remove entry
            </Button>
          ),
        },
      ]
    : timeColumns;

  async function save(submit) {
    setBusy(true);
    setError(null);
    try {
      const entries = sheet.entries.map(({ date, project, minutes, billable, note }) => ({
        date,
        project,
        minutes,
        billable,
        note,
      }));
      const result = await api(base + '/timesheet', {
        method: 'PUT',
        body: { week_start: sheet.week_start, version: sheet.version, entries, submit },
      });
      setSheet(result);
      toast(submit ? 'Timesheet submitted.' : 'Draft saved.');
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Weekly timesheet" action={<Badge>{sheet.status}</Badge>}>
      {sheet.review_note && <p className="px-4 pb-3 text-sm">{sheet.review_note}</p>}
      {editable && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (busy) return;
            setSheet((current) => ({
              ...current,
              entries: [...current.entries, { ...entry, minutes: Number(entry.minutes) }],
            }));
            setEntry((current) => ({ ...current, minutes: '', note: '' }));
          }}
        >
          <div className="grid gap-x-4 sm:grid-cols-2 xl:grid-cols-4">
            <RemoteSelect
              label="Assigned project"
              path={base + '?assigned=1'}
              value={entry.project}
              onChange={(event, project) => {
                setEntry((current) => ({
                  ...current,
                  project: event.target.value,
                  project_name: project?.name || event.target.value,
                }));
              }}
            />
            <Input
              label="Work date"
              type="date"
              min={sheet.week_start}
              required
              value={entry.date}
              onChange={(e) => set('date', e.target.value)}
            />
            <Input
              label="Minutes worked"
              type="number"
              min={1}
              max={1440}
              required
              value={entry.minutes}
              onChange={(e) => set('minutes', e.target.value)}
            />
            <Input
              label="Note"
              maxLength={300}
              value={entry.note}
              onChange={(e) => set('note', e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Checkbox
              label="Billable"
              checked={entry.billable}
              onChange={(e) => set('billable', e.target.checked)}
            />
            <Button type="submit" variant="secondary" disabled={busy || !entry.project}>
              Add time entry
            </Button>
          </div>
        </form>
      )}
      <DataTable
        columns={columns}
        rows={rows}
        empty={{
          title: 'No time entries',
          description: 'Add time against a project assigned to you.',
        }}
      />
      {editable && (
        <div className="border-t border-slate-200 p-4 dark:border-slate-700">
          <FormError error={error} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => save(false)}>
              Save draft
            </Button>
            <Button loading={busy} disabled={!rows.length} onClick={() => save(true)}>
              Submit timesheet
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function OwnTimesheet({ week }) {
  const resource = useResource(base + '/timesheet' + weekPath(week));
  return <Resource resource={resource}>{(data) => <Timesheet initial={data} />}</Resource>;
}

function TaskDialog({ project, member, onClose }) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  return (
    <Modal open title={'Assign task to ' + member.name} onClose={onClose}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api(base + '/' + project.uuid + '/tasks', {
              method: 'POST',
              body: { assignee_id: member.id, title, due_date: due || null },
            });
            toast('Task assigned in My Work.');
            onClose();
          } catch (failure) {
            setError(failure);
          } finally {
            setBusy(false);
          }
        }}
      >
        <FormError error={error} />
        <Input
          label="Task title"
          required
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Input
          label="Due date"
          type="date"
          value={due}
          onChange={(event) => setDue(event.target.value)}
        />
        <Button type="submit" loading={busy}>
          Assign task
        </Button>
      </form>
    </Modal>
  );
}

function ProjectMembers({ project }) {
  const { can } = useAuth();
  const [taskMember, setTaskMember] = useState(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const resource = useResource(
    base + '/people?' + new URLSearchParams({ project: project.uuid, page, q: query }),
  );
  const columns = [
    { key: 'name', label: 'Workspace member' },
    {
      key: 'assigned',
      label: 'Assignment',
      render: (row) => (
        <Button
          disabled={busy}
          variant="secondary"
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await api(base + '/' + project.uuid + '/members', {
                method: 'PUT',
                body: { user_id: row.id, assigned: !row.assigned },
              });
              resource.reload();
            } catch (failure) {
              setError(failure);
            } finally {
              setBusy(false);
            }
          }}
        >
          {row.assigned ? 'Remove assignment' : 'Assign'}
        </Button>
      ),
    },
  ];
  if (can('work.manage'))
    columns.push({
      key: 'task',
      label: 'Tasks',
      render: (row) =>
        row.assigned && (
          <Button variant="secondary" onClick={() => setTaskMember(row)}>
            Assign task
          </Button>
        ),
    });
  return (
    <Card title={project.name + ' assignments'}>
      {taskMember && (
        <TaskDialog member={taskMember} project={project} onClose={() => setTaskMember(null)} />
      )}
      <div className="p-4">
        <FormError error={error} />
        <Search
          value={query}
          onChange={(value) => {
            setPage(1);
            setQuery(value);
          }}
          placeholder="Search workspace members"
        />
      </div>
      <Resource resource={resource}>
        {(data) => (
          <>
            <DataTable rows={data.data} columns={columns} />
            <Pagination data={data} onChange={setPage} />
          </>
        )}
      </Resource>
    </Card>
  );
}

function ProjectPlanning({ project, week, onClose, onSave }) {
  const path = base + '/' + project.uuid + '/planning';
  const resource = useResource(path + weekPath(week));
  return (
    <Modal open title={project.name + ' planning'} onClose={onClose}>
      <Resource resource={resource}>
        {(data) => <PlanningForm initial={data} path={path} week={week} onSave={onSave} />}
      </Resource>
    </Modal>
  );
}

function PlanningForm({ initial, path, week, onSave }) {
  const [client, setClient] = useState(initial.client_name ?? '');
  const [capacity, setCapacity] = useState(initial.planned_minutes ?? '');
  const [costingEnabled, setCostingEnabled] = useState(Boolean(initial.costing));
  const [rates, setRates] = useState(
    initial.costing ?? {
      currency: '',
      billing_rate: '',
      labor_rate: '',
      direct_cost: '0',
    },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api(path, {
            method: 'PUT',
            body: {
              week_start: week,
              client_name: client.trim() || null,
              planned_minutes: capacity === '' ? null : Number(capacity),
              ...(costingEnabled || initial.costing
                ? { costing: costingEnabled ? rates : null }
                : {}),
            },
          });
          toast('Project planning saved.');
          onSave();
        } catch (failure) {
          setError(failure);
        } finally {
          setBusy(false);
        }
      }}
    >
      <FormError error={error} />
      <Input
        label="Client name"
        hint="Applies to the project across all weeks."
        value={client}
        maxLength={150}
        onChange={(event) => setClient(event.target.value)}
      />
      <Input
        label="Planned minutes"
        hint={'Capacity for the week of ' + week + '. Leave blank to clear this week’s plan.'}
        type="number"
        min={1}
        max={60000000}
        value={capacity}
        onChange={(event) => setCapacity(event.target.value)}
      />
      <div className="mb-4">
        <Checkbox
          label="Configure weekly project costing"
          checked={costingEnabled}
          onChange={(event) => setCostingEnabled(event.target.checked)}
        />
      </div>
      {costingEnabled && (
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Select
            label="Costing currency"
            required
            options={currencyOptions}
            value={rates.currency}
            onChange={(event) => setRates({ ...rates, currency: event.target.value })}
          />
          {[
            ['billing_rate', 'Billing rate per hour'],
            ['labor_rate', 'Labor cost per hour'],
            ['direct_cost', 'Direct costs for the week'],
          ].map(([key, label]) => (
            <Input
              key={key}
              label={label}
              required
              inputMode="decimal"
              maxLength={16}
              value={rates[key]}
              onChange={(event) => setRates({ ...rates, [key]: event.target.value })}
            />
          ))}
        </div>
      )}
      <Button type="submit" loading={busy}>
        Save planning
      </Button>
    </form>
  );
}

function Projects({ manage, week }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [planning, setPlanning] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const resource = useResource(base + '?page=' + page);
  const columns = [{ key: 'name', label: 'Project' }];
  if (manage)
    columns.push(
      { key: 'client_name', label: 'Client' },
      {
        key: 'members',
        label: 'Members',
        render: (project) => (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSelected(project)}>
              Manage assignments
            </Button>
            <Button variant="secondary" onClick={() => setPlanning(project)}>
              Plan capacity
            </Button>
          </div>
        ),
      },
    );

  return (
    <div className="grid gap-4">
      <Card title={manage ? 'Workspace projects' : 'My assigned projects'}>
        {manage && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const project = await api(base, { method: 'POST', body: { name } });
                setName('');
                setSelected(project);
                resource.reload();
              } catch (failure) {
                setError(failure);
              } finally {
                setBusy(false);
              }
            }}
          >
            <FormError error={error} />
            <Input
              label="Project name"
              value={name}
              maxLength={150}
              required
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" loading={busy}>
              Create project
            </Button>
          </form>
        )}
        <Resource resource={resource}>
          {(data) => (
            <>
              <DataTable rows={data.data.map((r) => ({ ...r, id: r.uuid }))} columns={columns} />
              <Pagination data={data} onChange={setPage} />
            </>
          )}
        </Resource>
      </Card>
      {planning && (
        <ProjectPlanning
          project={planning}
          week={week}
          onClose={() => setPlanning(null)}
          onSave={() => {
            setPlanning(null);
            resource.reload();
          }}
        />
      )}
      {selected && <ProjectMembers key={selected.uuid} project={selected} />}
    </div>
  );
}

function ReviewSheet({ sheet, onChange }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function decide(decision) {
    setBusy(true);
    setError(null);
    try {
      await api(base + '/reviews/' + sheet.uuid, {
        method: 'POST',
        body: { decision, version: sheet.version, note },
      });
      toast('Timesheet ' + decision + '.');
      onChange();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={sheet.name + ' - week of ' + sheet.week_start}>
      <DataTable columns={timeColumns} rows={sheet.entries.map((row, id) => ({ ...row, id }))} />
      <div className="p-4">
        <FormError error={error} />
        <Input
          label="Review note (required to reject)"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => decide('approved')}>
            Approve
          </Button>
          <Button
            variant="danger"
            disabled={busy || !note.trim()}
            onClick={() => decide('rejected')}
          >
            Reject
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Reviews() {
  const [page, setPage] = useState(1);
  const resource = useResource(base + '/reviews?page=' + page);
  return (
    <Resource resource={resource}>
      {(data) => (
        <div className="grid gap-4">
          {data.data.length ? (
            data.data.map((sheet) => (
              <ReviewSheet
                key={sheet.uuid}
                sheet={sheet}
                onChange={() => {
                  setPage(1);
                  resource.reload();
                }}
              />
            ))
          ) : (
            <Card title="Timesheet reviews">
              <p className="p-4 text-sm">No timesheets are awaiting your review.</p>
            </Card>
          )}
          <Pagination data={data} onChange={setPage} />
        </div>
      )}
    </Resource>
  );
}

const costingAmount = (row, key) =>
  row.costing ? row.costing.currency + ' ' + row.costing[key] : 'Unconfigured';

function Report({ week }) {
  const resource = useResource(base + '/report' + weekPath(week));
  const columns = [
    { key: 'name', label: 'Project' },
    { key: 'client_name', label: 'Client' },
    { key: 'billable', label: 'Billable hours', render: (row) => hours(row.billable) },
    { key: 'non_billable', label: 'Non-billable hours', render: (row) => hours(row.non_billable) },
    { key: 'total', label: 'Total hours', render: (row) => hours(row.billable + row.non_billable) },
    {
      key: 'planned_minutes',
      label: 'Planned hours',
      render: (row) => (row.planned_minutes ? hours(row.planned_minutes) : 'Unplanned'),
    },
    {
      key: 'utilization',
      label: 'Utilization',
      render: (row) =>
        row.planned_minutes
          ? new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(
              (row.billable + row.non_billable) / row.planned_minutes,
            )
          : 'Unplanned',
    },
    { key: 'revenue', label: 'Estimated revenue', render: (row) => costingAmount(row, 'revenue') },
    {
      key: 'total_cost',
      label: 'Estimated cost',
      render: (row) => costingAmount(row, 'total_cost'),
    },
    {
      key: 'contribution',
      label: 'Estimated contribution',
      render: (row) => costingAmount(row, 'contribution'),
    },
  ];
  return (
    <Card title="Approved project hours">
      <p className="px-4 pb-3 text-xs">
        Utilization compares approved hours with weekly capacity. Estimates use approved billable
        time, labor rates and recorded direct costs.
      </p>
      <Resource resource={resource}>
        {(rows) => (
          <DataTable columns={columns} rows={rows.map((row) => ({ ...row, id: row.project }))} />
        )}
      </Resource>
    </Card>
  );
}

export default function ProjectsPage() {
  const { session, can } = useAuth();
  const manage = session.project_management === true;
  const own = can('work.view');
  const [tab, setTab] = useState(own ? 'timesheet' : 'projects');
  const [week, setWeek] = useState(() =>
    monday(
      new Intl.DateTimeFormat('sv-SE', {
        timeZone: session.tenant.settings?.timezone || 'Asia/Kolkata',
        dateStyle: 'short',
      }).format(new Date()),
    ),
  );
  const items = [
    ...(own ? [{ value: 'timesheet', label: 'My timesheet' }] : []),
    { value: 'projects', label: 'Projects' },
    ...(manage
      ? [
          { value: 'reviews', label: 'Reviews' },
          { value: 'report', label: 'Project hours' },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Projects & timesheets"
        description="Assign projects, record weekly hours and review submitted timesheets."
      />
      <Card className="mb-4">
        <Tabs items={items} value={tab} onChange={setTab} />
      </Card>
      {(['timesheet', 'report'].includes(tab) || (tab === 'projects' && manage)) && (
        <div className="max-w-64">
          <Input
            label="Week of"
            type="date"
            value={week}
            onChange={(event) => {
              if (event.target.value) setWeek(monday(event.target.value));
            }}
          />
        </div>
      )}
      {tab === 'timesheet' && <OwnTimesheet key={week} week={week} />}
      {tab === 'projects' && <Projects manage={manage} week={week} />}
      {tab === 'reviews' && <Reviews />}
      {tab === 'report' && <Report week={week} />}
    </>
  );
}
