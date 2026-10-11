import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Check, RotateCcw } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api, query, localAction } from '../lib/api';
import { useResource, useDebounced } from '../lib/hooks';
import {
  PageHeader,
  Card,
  Button,
  Tabs,
  Resource,
  DataTable,
  FilterBar,
  Search,
  Select,
  Pagination,
  Badge,
  Modal,
  Input,
  Textarea,
  DatePicker,
  FormError,
  useToast,
} from '../components/ui';
export default function WorkPage() {
  const { session, can } = useAuth(),
    [params] = useSearchParams(),
    toast = useToast();
  const [tab, setTab] = useState('open'),
    [search, setSearch] = useState(''),
    [priority, setPriority] = useState(''),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState(params.has('new') && can('work.manage') ? {} : null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const delayed = useDebounced(search),
    res = useResource(`/work?${query({ tab, search: delayed, priority, page })}`);
  async function status(t) {
    try {
      await api(`/work/${t.id}`, {
        method: 'PATCH',
        body: { status: t.status === 'completed' ? 'open' : 'completed' },
      });
      res.reload();
      toast(t.status === 'completed' ? 'Task reopened.' : 'Task completed.');
    } catch (e) {
      toast(e.message, 'error');
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="YOUR WORKSPACE"
        title="My Work"
        description="A focused place for everything that needs your attention."
        action={
          can('work.manage') && (
            <Button
              onClick={() => {
                setEdit({});
                setError(null);
              }}
            >
              <Plus size={17} />
              Create task
            </Button>
          )
        }
      />
      <Card>
        <Tabs
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(1);
          }}
          items={[
            { value: 'open', label: 'Open' },
            { value: 'due-soon', label: 'Due soon' },
            { value: 'overdue', label: 'Overdue' },
            { value: 'completed', label: 'Completed' },
          ]}
        />
        <FilterBar>
          <Search
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search tasks…"
          />
          <Select
            label="Priority"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
            options={[{ value: '', label: 'All priorities' }, 'low', 'normal', 'high', 'urgent']}
          />
        </FilterBar>
        <Resource resource={res}>
          {(data) => (
            <>
              <DataTable
                rows={data.data}
                columns={[
                  {
                    key: 'title',
                    label: 'Task',
                    render: (r) => (
                      <div className="[&>small]:mt-2 [&>small]:block [&>small]:max-w-75 [&>small]:text-xs [&>small]:leading-6">
                        <strong>{r.title}</strong>
                        <small>{r.description}</small>
                      </div>
                    ),
                  },
                  {
                    key: 'priority',
                    label: 'Priority',
                    render: (r) => (
                      <Badge tone={['high', 'urgent'].includes(r.priority) ? 'amber' : 'neutral'}>
                        {r.priority}
                      </Badge>
                    ),
                  },
                  { key: 'source_module', label: 'Source' },
                  { key: 'due_date', label: 'Due date' },
                  {
                    key: 'actions',
                    label: 'Actions',
                    render: (r) => (
                      <div className="flex items-center gap-2.5">
                        {localAction(r.action) && (
                          <Link
                            className="inline-flex items-center gap-2 p-0 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline"
                            to={localAction(r.action)}
                          >
                            Open
                          </Link>
                        )}
                        {can('work.manage') && (
                          <Button variant="secondary" onClick={() => status(r)}>
                            {r.status === 'completed' ? (
                              <RotateCcw size={14} />
                            ) : (
                              <Check size={14} />
                            )}
                            {r.status === 'completed' ? 'Reopen' : 'Complete'}
                          </Button>
                        )}
                      </div>
                    ),
                  },
                ]}
                empty={{
                  title:
                    tab === 'completed' ? 'No completed tasks yet' : 'Nothing needs your attention',
                  description: 'Tasks assigned to you will appear here as your workspace grows.',
                }}
              />
              <Pagination data={data} onChange={setPage} />
            </>
          )}
        </Resource>
      </Card>
      <Modal
        open={!!edit}
        onClose={() => {
          if (!busy) setEdit(null);
        }}
        title="Create a task"
      >
        {edit && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                await api('/work', {
                  method: 'POST',
                  body: {
                    ...edit,
                    assignee_id: session.user.id,
                    priority: edit.priority || 'normal',
                  },
                });
                setEdit(null);
                res.reload();
                toast('Task created.');
              } catch (e) {
                setError(e);
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
              value={edit.title || ''}
              onChange={(e) => setEdit({ ...edit, title: e.target.value })}
            />
            <Textarea
              label="Details"
              value={edit.description || ''}
              onChange={(e) => setEdit({ ...edit, description: e.target.value })}
            />
            <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
              <Select
                label="Priority"
                value={edit.priority || 'normal'}
                options={['low', 'normal', 'high', 'urgent']}
                onChange={(e) => setEdit({ ...edit, priority: e.target.value })}
              />
              <DatePicker
                label="Due date"
                value={edit.due_date || ''}
                onChange={(e) => setEdit({ ...edit, due_date: e.target.value || null })}
              />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This task will be assigned to you.
            </p>
            <div className="flex items-center gap-2.5 mt-6 justify-end">
              <Button variant="secondary" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Create task
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
