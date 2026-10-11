import { useState } from 'react';
import { Button, Card } from '../../components/ui';
import { FormModal, ListCard, Page, StatusBadge } from '../../components/payroll/kit';
import { api } from '../../lib/api';
import { paths, titleCase, useList } from '../../lib/payrollApi';

const categories = ['insurance', 'meal', 'transport', 'housing', 'wellness', 'retirement', 'flexible', 'custom'];

export default function BenefitsAdminPage() {
  const plans = useList(paths.benefitPlans);
  const enrollments = useList(paths.benefitEnrollments);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const refresh = () => { plans.reload(); enrollments.reload(); };

  async function submit(values) {
    if (modal === 'plan') {
      await api(paths.benefitPlans, { method: 'POST', body: {
        code: values.code.toUpperCase(), name: values.name, category: values.category,
        country: values.country || null, currency: values.currency || null,
        effective_from: values.effective_from, effective_to: values.effective_to || null,
        contributions: { employee_fixed: values.employee_fixed || '0', employer_fixed: values.employer_fixed || '0' },
      } });
    } else if (modal === 'window') {
      await api(paths.benefitPlan(selected.uuid, 'windows'), { method: 'POST', body: values });
    }
    refresh();
  }

  return <Page permission="payroll.benefits.manage" title="Benefits administration" description="Configure plans and enrollment windows, then review employee enrollment requests.">
    <Card title="Benefit plans" action={<Button onClick={() => setModal('plan')}>Create plan</Button>}>
      <ListCard list={plans} columns={[
        { key: 'name', label: 'Plan' }, { key: 'code', label: 'Code' }, { key: 'category', label: 'Category', render: (r) => titleCase(r.category) },
        { key: 'effective', label: 'Effective', render: (r) => `${r.effective_from} – ${r.effective_to ?? 'Open'}` },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
        { key: 'windows', label: 'Windows', render: (r) => r.windows?.length ?? 0 },
        { key: 'actions', label: '', render: (r) => <div className="flex flex-wrap gap-2">
          {r.status === 'draft' && <Button variant="secondary" onClick={async () => { await api(paths.benefitPlan(r.uuid, 'activate'), { method: 'POST' }); refresh(); }}>Activate</Button>}
          {r.status === 'active' && <Button variant="secondary" onClick={() => { setSelected(r); setModal('window'); }}>Add window</Button>}
        </div> },
      ]} empty={{ title: 'No benefit plans', description: 'Create a plan to configure employee enrollment.' }} />
    </Card>
    <ListCard title="Enrollment requests" list={enrollments} columns={[
      { key: 'employee', label: 'Employee' }, { key: 'plan', label: 'Plan' }, { key: 'effective_from', label: 'Effective' },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
      { key: 'actions', label: '', render: (r) => ['pending', 'termination_pending'].includes(r.status) ? <div className="flex gap-2">
        <Button onClick={async () => { await api(r.status === 'termination_pending' ? paths.benefitTerminationDecision(r.uuid) : paths.benefitEnrollmentDecision(r.uuid), { method: 'POST', body: { decision: 'approved' } }); refresh(); }}>Approve</Button>
        <Button variant="secondary" onClick={async () => { await api(r.status === 'termination_pending' ? paths.benefitTerminationDecision(r.uuid) : paths.benefitEnrollmentDecision(r.uuid), { method: 'POST', body: { decision: 'rejected' } }); refresh(); }}>Decline</Button>
      </div> : null },
    ]} empty={{ title: 'No enrollment requests', description: 'Employee requests will appear here for independent review.' }} />
    <FormModal open={modal === 'plan'} onClose={() => setModal(null)} title="Create benefit plan" intro="Plans start as drafts. Activate a plan before adding an enrollment window." initial={{ category: 'insurance', employee_fixed: '0', employer_fixed: '0' }} fields={[
      { name: 'code', label: 'Plan code' }, { name: 'name', label: 'Plan name' }, { name: 'category', label: 'Category', options: categories.map((x) => ({ value: x, label: titleCase(x) })) },
      { name: 'country', label: 'Country code (optional)', required: false }, { name: 'currency', label: 'Currency code (optional)', required: false },
      { name: 'effective_from', label: 'Effective from', type: 'date' }, { name: 'effective_to', label: 'Effective to', type: 'date', required: false },
      { name: 'employee_fixed', label: 'Employee contribution', required: false }, { name: 'employer_fixed', label: 'Employer contribution', required: false },
    ]} onSubmit={submit} success="Plan created" />
    <FormModal open={modal === 'window'} onClose={() => setModal(null)} title={`Enrollment window · ${selected?.name ?? ''}`} initial={{}} fields={[
      { name: 'name', label: 'Window name' }, { name: 'opens_on', label: 'Opens on', type: 'date' },
      { name: 'closes_on', label: 'Closes on', type: 'date' }, { name: 'effective_on', label: 'Coverage effective on', type: 'date' },
    ]} onSubmit={submit} success="Enrollment window added" />
  </Page>;
}
