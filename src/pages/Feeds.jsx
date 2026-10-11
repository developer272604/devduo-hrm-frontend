import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, ArrowRight } from 'lucide-react';
import { api, query, localAction } from '../lib/api';
import { useResource, useDebounced } from '../lib/hooks';
import {
  PageHeader,
  Button,
  Card,
  Resource,
  Tabs,
  Select,
  FilterBar,
  EmptyState,
  Badge,
  Pagination,
  DataTable,
  Input,
  DateRange,
  Modal,
  ActivityTimeline,
  useToast,
} from '../components/ui';
export function NotificationsPage() {
  const [filter, setFilter] = useState('all'),
    [category, setCategory] = useState(''),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    toast = useToast(),
    res = useResource(`/notifications?${query({ filter, category, page })}`);
  async function read(id) {
    setBusy(true);
    try {
      await api(id ? `/notifications/${id}/read` : '/notifications/read-all', { method: 'POST' });
      res.reload();
      toast(id ? 'Marked as read.' : 'All notifications marked as read.');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="YOUR WORKSPACE"
        title="Notifications"
        description="The updates that keep your day moving."
        action={
          <Button variant="secondary" loading={busy} onClick={() => read()}>
            <Check size={17} />
            Mark all as read
          </Button>
        }
      />
      <Card>
        <Tabs
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          items={[
            { value: 'all', label: 'All updates' },
            { value: 'unread', label: 'Unread' },
            { value: 'read', label: 'Read' },
          ]}
        />
        <FilterBar>
          <Select
            label="Category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All categories' },
              { value: 'work', label: 'My Work' },
              { value: 'security', label: 'Security' },
              { value: 'company', label: 'Company' },
            ]}
          />
        </FilterBar>
        <Resource resource={res}>
          {(data) => (
            <>
              {data.data.length ? (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {data.data.map((n) => (
                    <article
                      key={n.id}
                      className={`flex gap-4 p-6 ${!n.read_at ? 'bg-brand-50/50 dark:bg-brand-950/50' : 'bg-white dark:bg-slate-900'}`}
                    >
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-500">
                        <Bell size={20} />
                      </span>
                      <div className="min-w-0 flex-1 [&_strong]:text-sm [&>p]:mb-3 [&>p]:mt-2 [&>p]:text-xs">
                        <div className="flex items-center gap-2.5">
                          <strong>{n.title}</strong>
                          {!n.read_at && <span className="size-1.5 rounded-full bg-brand-600" />}
                        </div>
                        <p>{n.body}</p>
                        <div className="mb-3 flex flex-wrap items-center gap-3 [&>time]:text-xs [&>time]:text-slate-500 dark:[&>time]:text-slate-400">
                          <Badge>{n.category}</Badge>
                          <time dateTime={n.created_at}>
                            {new Date(n.created_at).toLocaleString()}
                          </time>
                        </div>
                        <div className="flex items-center gap-2.5">
                          {localAction(n.action) && (
                            <Link
                              className="inline-flex items-center gap-2 p-0 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline"
                              to={localAction(n.action)}
                            >
                              View task <ArrowRight size={14} />
                            </Link>
                          )}
                          {!n.read_at && (
                            <Button variant="ghost" disabled={busy} onClick={() => read(n.id)}>
                              Mark as read
                            </Button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="You’re up to date"
                  description="New updates will be waiting here when they arrive."
                />
              )}
              <Pagination data={data} onChange={setPage} />
            </>
          )}
        </Resource>
      </Card>
    </>
  );
}
export function AuditPage() {
  const [filters, setFilters] = useState({
      actor: '',
      action: '',
      module: '',
      resource: '',
      ip_address: '',
      from: '',
      to: '',
    }),
    [page, setPage] = useState(1),
    [detail, setDetail] = useState(null);
  const delayed = useDebounced(JSON.stringify(filters)),
    res = useResource(`/audit?${query({ ...JSON.parse(delayed), page })}`);
  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Audit log"
        description="A reliable record of the changes in your workspace."
      />
      <Card>
        <div className="grid grid-cols-1 gap-x-4 px-6 pt-5 sm:grid-cols-2 lg:grid-cols-3 [&>div:last-child]:sm:col-span-2">
          {[
            ['actor', 'Person'],
            ['action', 'Action'],
            ['module', 'Module'],
            ['resource', 'Resource'],
            ['ip_address', 'IP address'],
          ].map(([k, label]) => (
            <Input
              key={k}
              label={label}
              placeholder={`Filter ${label.toLowerCase()}`}
              value={filters[k]}
              onChange={(e) => {
                setFilters({ ...filters, [k]: e.target.value });
                setPage(1);
              }}
            />
          ))}
          <DateRange
            from={filters.from}
            to={filters.to}
            onChange={(v) => {
              setFilters({ ...filters, ...v });
              setPage(1);
            }}
          />
        </div>
        <Resource resource={res}>
          {(data) => (
            <>
              <DataTable
                rows={data.data}
                columns={[
                  {
                    key: 'created_at',
                    label: 'When',
                    render: (r) => new Date(r.created_at).toLocaleString(),
                  },
                  { key: 'actor', label: 'Person' },
                  {
                    key: 'action',
                    label: 'Action',
                    render: (r) => <Badge tone="purple">{r.action.replaceAll('_', ' ')}</Badge>,
                  },
                  { key: 'module', label: 'Module' },
                  {
                    key: 'resource',
                    label: 'Resource',
                    render: (r) => (
                      <button
                        className="inline-flex items-center gap-2 p-0 text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline"
                        onClick={() => setDetail(r)}
                      >
                        {r.resource}
                      </button>
                    ),
                  },
                  { key: 'ip_address', label: 'IP address' },
                ]}
                empty={{
                  title: 'No matching activity',
                  description:
                    'Try adjusting your filters. New activity is recorded automatically.',
                }}
              />
              <Pagination data={data} onChange={setPage} />
            </>
          )}
        </Resource>
      </Card>
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Activity details">
        {detail && (
          <>
            <ActivityTimeline
              items={[
                {
                  title: detail.action.replaceAll('_', ' '),
                  description: `${detail.actor} · ${detail.resource}`,
                  time: new Date(detail.created_at).toLocaleString(),
                },
              ]}
            />
            <p>Module: {detail.module}</p>
            <p>IP address: {detail.ip_address || 'Not stored'}</p>
            <pre>{JSON.stringify(detail.context || {}, null, 2)}</pre>
          </>
        )}
      </Modal>
    </>
  );
}
