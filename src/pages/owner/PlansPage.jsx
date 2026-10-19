import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useResource } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Badge, Button, Card, DataTable, ErrorState, Input, Modal, PageHeader, Resource, Textarea, FormError, useToast } from '../../components/ui';
import { money } from '../../components/PlanCards';

const blank = { code: '', name: '', description: '', monthly_price: '', currency: 'INR', modules: [], active: true, sort: 0 };

function PlanForm({ plan, modules, onClose, onSaved }) {
  const editing = Boolean(plan.id);
  const [form, setForm] = useState({ ...blank, ...plan }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggle = (m) => setForm({ ...form, modules: form.modules.includes(m) ? form.modules.filter((x) => x !== m) : [...form.modules, m] });
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { name: form.name, description: form.description || null, monthly_price: Number(form.monthly_price), currency: form.currency, modules: form.modules, active: form.active, sort: Number(form.sort) || 0 };
      if (editing) await api(`/owner/plans/${plan.id}`, { method: 'PUT', body });
      else await api('/owner/plans', { method: 'POST', body: { ...body, code: form.code } });
      onSaved();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }
  const err = (k) => error?.errors?.[k]?.[0];
  return (
    <Modal open onClose={onClose} title={editing ? `Edit ${plan.name}` : 'New plan'}>
      <form onSubmit={save}>
        <FormError error={error} />
        {!editing && <Input label="Code (short, no spaces)" required value={form.code} onChange={set('code')} error={err('code')} hint="Example: starter, pro" />}
        <Input label="Plan name" required value={form.name} onChange={set('name')} error={err('name')} />
        <Textarea label="Description" value={form.description || ''} onChange={set('description')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Price per month" type="number" min={0} step="0.01" required value={form.monthly_price} onChange={set('monthly_price')} error={err('monthly_price')} />
          <Input label="Currency" maxLength={3} value={form.currency} onChange={set('currency')} />
        </div>
        <span className="mb-2 block text-sm font-semibold">Features (modules) included</span>
        <div className="mb-5 flex flex-wrap gap-2">
          {modules.map((m) => (
            <button key={m} type="button" aria-pressed={form.modules.includes(m)} onClick={() => toggle(m)} className={`rounded-md border px-3 py-1.5 text-sm capitalize ${form.modules.includes(m) ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}>
              {m}
            </button>
          ))}
        </div>
        {err('modules') && <p className="mb-3 text-sm text-rose-700">{err('modules')}</p>}
        <label className="mb-5 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          Show on the public price list
        </label>
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Save plan</Button>
        </div>
      </form>
    </Modal>
  );
}

export function OwnerPlansPage() {
  const { session } = useAuth(),
    toast = useToast(),
    res = useResource('/owner/plans'),
    [editing, setEditing] = useState(null);
  if (!session.account?.is_owner) return <ErrorState error={{ status: 403, message: 'This area is only for the HRMS owner.' }} />;
  return (
    <>
      <PageHeader
        eyebrow="HRMS OWNER"
        title="Plans & pricing"
        description="Set the monthly price of each plan and the features it unlocks. Approve a company on a plan to switch those features on."
        action={<Button onClick={() => setEditing(blank)}><Plus size={16} />New plan</Button>}
      />
      <p className="mb-4 text-sm"><Link className="text-brand-700 dark:text-brand-300" to="/owner">← Back to companies</Link></p>
      <Resource resource={res}>
        {(d) => (
          <Card>
            <DataTable
              rows={d.plans}
              empty={{ title: 'No plans yet', description: 'Create a plan to start selling.' }}
              columns={[
                { key: 'name', label: 'Plan', render: (p) => <>{p.name}<small className="block">{p.code}</small></> },
                { key: 'monthly_price', label: 'Monthly price', render: (p) => <strong>{money(p.monthly_price, p.currency)}</strong> },
                { key: 'modules', label: 'Features', render: (p) => <span className="capitalize">{p.modules.filter((m) => !['work', 'notifications'].includes(m)).join(', ')}</span> },
                { key: 'companies', label: 'Companies' },
                { key: 'active', label: 'Listed', render: (p) => <Badge tone={p.active ? 'green' : 'neutral'}>{p.active ? 'public' : 'hidden'}</Badge> },
                { key: 'actions', label: '', render: (p) => (
                  <div className="flex gap-2">
                    <Button variant="secondary" className="min-h-8 px-3 py-1.5" onClick={() => setEditing(p)}>Edit</Button>
                    <Button variant="secondary" className="min-h-8 px-3 py-1.5" onClick={async () => {
                      try {
                        const r = await api(`/owner/plans/${p.id}`, { method: 'DELETE' });
                        toast(r.retired ? 'Plan is in use, so it was hidden instead of deleted.' : 'Plan deleted.');
                        res.reload();
                      } catch (e) {
                        toast(e.message, 'error');
                      }
                    }}>Remove</Button>
                  </div>
                ) },
              ]}
            />
            {editing && <PlanForm plan={editing} modules={d.available_modules} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); toast('Plan saved.'); res.reload(); }} />}
          </Card>
        )}
      </Resource>
    </>
  );
}
