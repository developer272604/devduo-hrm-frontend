import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api, query } from '../lib/api';
import { useResource, useDebounced } from '../lib/hooks';
import {
  PageHeader,
  Button,
  Card,
  Resource,
  DataTable,
  Avatar,
  Badge,
  Pagination,
  Search,
  FilterBar,
  Modal,
  Input,
  Textarea,
  Switch,
  MultiSelect,
  Select,
  FormError,
  EmptyState,
  ConfirmationDialog,
  Checkbox,
  useToast,
} from '../components/ui';
const newUser = { name: '', email: '', password: '', active: true, role_ids: [] };
export function UsersPage() {
  const { can, refresh } = useAuth(),
    toast = useToast(),
    [params] = useSearchParams();
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState(params.has('new') && can('users.manage') ? newUser : null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const delayed = useDebounced(search),
    res = useResource(`/users?${query({ search: delayed, page })}`),
    roles = useResource('/roles');
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: edit.name,
        email: edit.email,
        active: edit.active,
        role_ids: edit.role_ids,
        ...(!edit.id ? { password: edit.password } : {}),
      };
      await api(`/users${edit.id ? `/${edit.id}` : ''}`, {
        method: edit.id ? 'PUT' : 'POST',
        body,
      });
      setEdit(null);
      res.reload();
      await refresh();
      toast('User access saved.');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="People & access"
        description="Give the right people the right space to work."
        action={
          can('users.manage') && (
            <Button
              onClick={() => {
                setEdit(newUser);
                setError(null);
              }}
            >
              <Plus size={17} />
              Add user
            </Button>
          )
        }
      />
      <Card>
        <FilterBar>
          <Search
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search people by name or email…"
          />
        </FilterBar>
        <Resource resource={res}>
          {(data) => (
            <>
              <DataTable
                rows={data.data}
                columns={[
                  {
                    key: 'name',
                    label: 'Person',
                    render: (r) => (
                      <div className="flex items-center gap-3 text-left [&_small]:mt-1 [&_small]:block [&_small]:text-xs">
                        <Avatar name={r.name} />
                        <div>
                          <strong>{r.name}</strong>
                          <small>{r.email}</small>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'roles',
                    label: 'Access',
                    render: (r) => (
                      <div className="flex flex-wrap gap-1">
                        {r.roles.map((x) => (
                          <Badge key={x.id} tone="purple">
                            {x.name}
                          </Badge>
                        ))}
                      </div>
                    ),
                  },
                  {
                    key: 'active',
                    label: 'Status',
                    render: (r) => (
                      <Badge tone={r.active ? 'green' : 'neutral'}>
                        {r.active ? 'Active' : 'Inactive'}
                      </Badge>
                    ),
                  },
                  {
                    key: 'created_at',
                    label: 'Added',
                    render: (r) => new Date(r.created_at).toLocaleDateString(),
                  },
                  ...(can('users.manage')
                    ? [
                        {
                          key: 'edit',
                          label: 'Actions',
                          render: (r) => (
                            <Button
                              variant="ghost"
                              aria-label={`Edit ${r.name}`}
                              onClick={() => {
                                setEdit({ ...r, role_ids: r.roles.map((x) => x.id) });
                                setError(null);
                              }}
                            >
                              <Pencil size={16} />
                              Edit
                            </Button>
                          ),
                        },
                      ]
                    : []),
                ]}
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
        title={edit?.id ? 'Edit user access' : 'Add a team member'}
      >
        {edit && (
          <form onSubmit={save}>
            <FormError error={error} />
            <Input
              label="Full name"
              required
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
            <Input
              label="Work email"
              type="email"
              required
              value={edit.email}
              onChange={(e) => setEdit({ ...edit, email: e.target.value })}
            />
            {!edit.id && (
              <Input
                label="Initial password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                hint="At least 12 characters with letters and numbers. Share securely."
                value={edit.password}
                onChange={(e) => setEdit({ ...edit, password: e.target.value })}
              />
            )}
            <Resource resource={roles}>
              {(data) => (
                <MultiSelect
                  label="Workspace roles"
                  options={data.map((r) => ({ value: r.id, label: r.name }))}
                  value={edit.role_ids}
                  onChange={(role_ids) => setEdit({ ...edit, role_ids })}
                />
              )}
            </Resource>
            <Switch
              label="Account active"
              checked={edit.active}
              onChange={(active) => setEdit({ ...edit, active })}
            />
            <div className="flex items-center gap-2.5 mt-6 justify-end">
              <Button variant="secondary" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={busy}
                disabled={roles.loading || !edit.role_ids.length}
              >
                Save user
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
export function RolesPage() {
  const toast = useToast(),
    { refresh } = useAuth(),
    roles = useResource('/roles'),
    permissions = useResource('/permissions');
  const [edit, setEdit] = useState(null),
    [deleting, setDeleting] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/roles${edit.id ? `/${edit.id}` : ''}`, {
        method: edit.id ? 'PUT' : 'POST',
        body: edit,
      });
      setEdit(null);
      roles.reload();
      await refresh();
      toast('Role saved.');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Roles & permissions"
        description="Clear responsibilities. Considered access."
        action={
          <Button
            onClick={() => {
              setEdit({ name: '', description: '', data_scope: 'self', permission_ids: [] });
              setError(null);
            }}
          >
            <Plus size={17} />
            Create role
          </Button>
        }
      />
      <Resource resource={roles}>
        {(data) => (
          <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 [&>section]:p-6 [&_p]:min-h-10 [&_p]:text-sm">
            {data.map((r) => (
              <Card key={r.id}>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span className="inline-flex rounded-xl bg-brand-50 dark:bg-brand-950 p-3 text-brand-500">
                    <ShieldCheck size={23} />
                  </span>
                  <Badge tone={r.system ? 'purple' : 'neutral'}>
                    {r.system ? 'Protected' : 'Custom role'}
                  </Badge>
                </div>
                <h2>{r.name}</h2>
                <p>{r.description || 'A custom set of workspace permissions.'}</p>
                <div className="my-5 flex justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>{r.permissions.length} permissions</span>
                  <span>{r.data_scope === 'tenant' ? 'Workspace-wide' : 'Own records'}</span>
                </div>
                <div className="flex min-h-15 items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-4 [&>small]:text-xs">
                  {r.system ? (
                    <small>The administrator role keeps your workspace manageable.</small>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEdit({ ...r, permission_ids: r.permissions.map((p) => p.id) });
                          setError(null);
                        }}
                      >
                        Manage role
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={`Delete ${r.name}`}
                        onClick={() => setDeleting(r)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Resource>
      <Card title="Permission directory" className="mt-6">
        <Resource resource={permissions}>
          {(data) => (
            <div className="grid grid-cols-1 gap-6 px-6 pb-6 pt-2 sm:grid-cols-2 xl:grid-cols-4 [&_h3]:mb-3 [&_h3]:text-xs [&_p]:mb-3 [&_p]:flex [&_p]:items-center [&_p]:gap-2 [&_p]:text-xs">
              {[...new Set(data.map((p) => p.group))].map((group) => (
                <div key={group}>
                  <h3>{group}</h3>
                  {data
                    .filter((p) => p.group === group)
                    .map((p) => (
                      <p key={p.id}>
                        <ShieldCheck size={15} />
                        {p.label}
                      </p>
                    ))}
                </div>
              ))}
            </div>
          )}
        </Resource>
      </Card>
      <Modal
        open={!!edit}
        onClose={() => {
          if (!busy) setEdit(null);
        }}
        title={edit?.id ? 'Manage role' : 'Create a role'}
      >
        {edit && (
          <form onSubmit={save}>
            <FormError error={error} />
            <Input
              label="Role name"
              required
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
            <Textarea
              label="Description"
              value={edit.description || ''}
              onChange={(e) => setEdit({ ...edit, description: e.target.value })}
            />
            <Select
              label="Task visibility"
              value={edit.data_scope}
              onChange={(e) => setEdit({ ...edit, data_scope: e.target.value })}
              options={[
                { value: 'self', label: 'Only their own tasks' },
                { value: 'tenant', label: 'All tasks in the workspace' },
              ]}
            />
            <Resource resource={permissions}>
              {(data) => (
                <div className="mt-6 [&>fieldset]:flex-col">
                  {[...new Set(data.map((p) => p.group))].map((group) => (
                    <MultiSelect
                      key={group}
                      label={group}
                      options={data
                        .filter((p) => p.group === group)
                        .map((p) => ({ value: p.id, label: p.label }))}
                      value={edit.permission_ids}
                      onChange={(permission_ids) => setEdit({ ...edit, permission_ids })}
                    />
                  ))}
                </div>
              )}
            </Resource>
            <div className="flex items-center gap-2.5 mt-6 justify-end">
              <Button variant="secondary" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={permissions.loading}>
                Save role
              </Button>
            </div>
          </form>
        )}
      </Modal>
      <ConfirmationDialog
        open={!!deleting}
        title={`Delete ${deleting?.name}?`}
        onClose={() => setDeleting(null)}
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await api(`/roles/${deleting.id}`, { method: 'DELETE' });
            setDeleting(null);
            roles.reload();
            toast('Role deleted.');
          } catch (e) {
            toast(e.message, 'error');
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
