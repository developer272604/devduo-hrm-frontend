import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { organizationTypes } from '../components/Layout';
import { useAuth } from '../lib/auth';
import { api, query } from '../lib/api';
import { useResource, useDebounced } from '../lib/hooks';
import {
  Button,
  PageHeader,
  Card,
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
  Switch,
  FormError,
  ConfirmationDialog,
  useToast,
} from '../components/ui';
export default function Organization() {
  const { type } = useParams(),
    { can } = useAuth(),
    toast = useToast();
  const [search, setSearch] = useState(''),
    [active, setActive] = useState(''),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState(null),
    [deleting, setDeleting] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const delayed = useDebounced(search),
    res = useResource(`/organization/${type}?${query({ search: delayed, active, page })}`),
    title = organizationTypes[type] || 'Organization';
  const manage = can('organization.manage');
  const close = () => {
    if (!busy) setEdit(null);
  };
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/organization/${type}${edit.id ? `/${edit.id}` : ''}`, {
        method: edit.id ? 'PUT' : 'POST',
        body: edit,
      });
      setEdit(null);
      res.reload();
      toast('Organization record saved.');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="ORGANIZATION"
        title={title}
        description="The building blocks of your company, kept in one place."
        action={
          manage && (
            <Button
              onClick={() => {
                setEdit({ name: '', code: '', description: '', active: true });
                setError(null);
              }}
            >
              <Plus size={17} />
              Add record
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
            placeholder={`Search ${title.toLowerCase()}…`}
          />
          <Select
            label="Status"
            value={active}
            onChange={(e) => {
              setActive(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All statuses' },
              { value: '1', label: 'Active' },
              { value: '0', label: 'Inactive' },
            ]}
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
                    label: 'Name',
                    render: (r) => (
                      <div className="flex items-center gap-3 text-left">
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-400">
                          <Building2 size={16} />
                        </span>
                        <strong>{r.name}</strong>
                      </div>
                    ),
                  },
                  { key: 'code', label: 'Code', render: (r) => <code>{r.code}</code> },
                  { key: 'description', label: 'Description' },
                  {
                    key: 'active',
                    label: 'Status',
                    render: (r) => (
                      <Badge tone={r.active ? 'green' : 'neutral'}>
                        {r.active ? 'Active' : 'Inactive'}
                      </Badge>
                    ),
                  },
                  ...(manage
                    ? [
                        {
                          key: 'actions',
                          label: 'Actions',
                          render: (r) => (
                            <div className="flex items-center gap-2.5">
                              <Button
                                variant="ghost"
                                aria-label={`Edit ${r.name}`}
                                onClick={() => {
                                  setEdit(r);
                                  setError(null);
                                }}
                              >
                                <Pencil size={15} />
                              </Button>
                              <Button
                                variant="ghost"
                                aria-label={`Delete ${r.name}`}
                                onClick={() => setDeleting(r)}
                              >
                                <Trash2 size={15} />
                              </Button>
                            </div>
                          ),
                        },
                      ]
                    : []),
                ]}
                empty={{
                  title: `No ${title.toLowerCase()} yet`,
                  description: manage
                    ? 'Add your first record to start shaping your organization.'
                    : 'Your administrator can add these records.',
                }}
              />
              <Pagination data={data} onChange={setPage} />
            </>
          )}
        </Resource>
      </Card>
      <Modal
        open={!!edit}
        onClose={close}
        title={`${edit?.id ? 'Edit' : 'Add'} ${title.toLowerCase()} record`}
      >
        {edit && (
          <form onSubmit={save}>
            <FormError error={error} />
            <Input
              label="Name"
              required
              maxLength={150}
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
            <Input
              label="Code"
              required
              maxLength={40}
              pattern="[A-Za-z0-9_\-]+"
              hint="Letters, numbers, hyphens, and underscores."
              value={edit.code}
              onChange={(e) => setEdit({ ...edit, code: e.target.value })}
            />
            <Textarea
              label="Description"
              value={edit.description || ''}
              onChange={(e) => setEdit({ ...edit, description: e.target.value })}
            />
            <Switch
              label="Active record"
              checked={edit.active}
              onChange={(active) => setEdit({ ...edit, active })}
            />
            <div className="flex items-center gap-2.5 mt-6 justify-end">
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Save record
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
            await api(`/organization/${type}/${deleting.id}`, { method: 'DELETE' });
            setDeleting(null);
            res.reload();
            toast('Record deleted.');
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
