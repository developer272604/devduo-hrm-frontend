import { useState } from 'react';
import { FileText } from 'lucide-react';
import { api, download } from '../../lib/api';
import { useResource } from '../../lib/hooks';
import { currencyOptions } from '../../lib/operationsApi';
import { Button, Card, DataTable, Pagination, Resource, useToast } from '../ui';
import { FormModal } from '../payroll/kit';

const templatePath = '/v1/people/letter-templates';
const apiBase = import.meta.env.VITE_API_BASE || '/api';
const kinds = [
  { value: 'appointment', label: 'Appointment letter' },
  { value: 'experience', label: 'Experience letter' },
  { value: 'relieving', label: 'Relieving letter' },
  { value: 'salary_certificate', label: 'Salary certificate' },
];

const templateFields = [
  { name: 'kind', label: 'Letter type', options: kinds },
  { name: 'title', label: 'Template title' },
  { name: 'body', label: 'Letter text', textarea: true },
];

const salaryFields = [
  { name: 'salary_amount', label: 'Verified salary amount' },
  { name: 'salary_currency', label: 'Currency', options: currencyOptions },
  {
    name: 'salary_period',
    label: 'Pay period',
    options: [
      { value: 'monthly', label: 'Monthly' },
      { value: 'annual', label: 'Annual' },
    ],
  },
];
const signatureRequestField = {
  name: 'signature_requested',
  label: 'Request employee signature',
  type: 'checkbox',
};
const signatureFields = [
  { name: 'signer_name', label: 'Full name as shown in your employee record' },
  {
    name: 'consent',
    label: 'I have reviewed this letter and agree to sign it electronically.',
    type: 'checkbox',
  },
];

const fieldHelp =
  'Use {{employee_name}}, {{employee_number}}, {{workspace_name}}, {{joined_on}}, {{separated_on}} or {{issued_on}}. Salary certificate templates must also include {{salary_amount}}, {{salary_currency}} and {{salary_period}}.';

function LetterLibrary({ uuid }) {
  const [page, setPage] = useState(1);
  const [newTemplate, setNewTemplate] = useState(false);
  const [template, setTemplate] = useState(null);
  const [acknowledging, setAcknowledging] = useState(null);
  const [signing, setSigning] = useState(null);
  const path = '/v1/employees/' + uuid + '/letters';
  const resource = useResource(path + '?page=' + page);
  const toast = useToast();
  const columns = [
    { key: 'title', label: 'Letter' },
    { key: 'version', label: 'Template version' },
    { key: 'created_at', label: 'Issued on', render: (row) => row.created_at.slice(0, 10) },
    {
      key: 'acknowledged_at',
      label: 'Acknowledgment',
      render: (row) =>
        row.acknowledged_at ? 'Received ' + row.acknowledged_at.slice(0, 10) : 'Pending',
    },
    {
      key: 'signed_at',
      label: 'Signature',
      render: (row) => {
        if (row.signed_at) return 'Signed ' + row.signed_at.slice(0, 10);
        return row.signature_requested ? 'Awaiting signature' : 'Not requested';
      },
    },
    {
      key: 'download',
      label: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-2">
          <a
            className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-brand-700 dark:border-slate-700 dark:text-brand-300"
            href={apiBase + path + '/' + row.uuid + '/download?format=print'}
            target="_blank"
            rel="noopener noreferrer"
          >
            Print
          </a>
          <a
            className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-brand-700 dark:border-slate-700 dark:text-brand-300"
            href={apiBase + path + '/' + row.uuid + '/download?format=pdf'}
          >
            Download PDF
          </a>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await download(path + '/' + row.uuid + '/download', row.kind + '.txt');
              } catch (error) {
                toast(error.message, 'error');
              }
            }}
          >
            Download text
          </Button>
          {row.canAcknowledge && !row.acknowledged_at && (
            <Button variant="secondary" onClick={() => setAcknowledging(row)}>
              Acknowledge receipt
            </Button>
          )}
          {row.canAcknowledge && row.signature_requested && !row.signed_at && (
            <Button onClick={() => setSigning(row)}>Sign letter</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <Card title="HR letters">
        <Resource resource={resource}>
          {({ issued, templates, can_manage_templates, can_acknowledge }) => (
            <>
              {(can_manage_templates || templates.length > 0) && (
                <div className="flex flex-wrap gap-2 px-4 pb-4">
                  {can_manage_templates && (
                    <Button variant="secondary" onClick={() => setNewTemplate(true)}>
                      Create template version
                    </Button>
                  )}
                  {templates.map((entry) => (
                    <Button key={entry.uuid} variant="secondary" onClick={() => setTemplate(entry)}>
                      Issue {kinds.find((kind) => kind.value === entry.kind)?.label.toLowerCase()}
                    </Button>
                  ))}
                </div>
              )}
              <DataTable
                columns={columns}
                rows={issued.data.map((row) => ({
                  ...row,
                  id: row.uuid,
                  canAcknowledge: can_acknowledge,
                }))}
                empty={{
                  title: 'No issued letters',
                  description: 'Letters issued for this employee appear here.',
                }}
              />
              <Pagination data={issued} onChange={setPage} />
            </>
          )}
        </Resource>
      </Card>
      {acknowledging && (
        <FormModal
          open
          title="Acknowledge letter receipt"
          intro={'Confirm that you received "' + acknowledging.title + '".'}
          fields={[]}
          submitLabel="Confirm receipt"
          success="Receipt acknowledged."
          onClose={() => setAcknowledging(null)}
          onSubmit={async () => {
            const result = await api(path + '/' + acknowledging.uuid + '/acknowledge', {
              method: 'POST',
              body: { acknowledged: true },
            });
            resource.reload();
            return result;
          }}
        />
      )}
      {newTemplate && (
        <FormModal
          open
          title="Create letter template version"
          intro={fieldHelp}
          fields={templateFields}
          onClose={() => setNewTemplate(false)}
          success="Letter template saved."
          onSubmit={async (body) => {
            const result = await api(templatePath, { method: 'POST', body });
            resource.reload();
            return result;
          }}
        />
      )}
      {signing && (
        <FormModal
          open
          title={'Sign ' + signing.title}
          fields={signatureFields}
          submitLabel="Sign electronically"
          success="Letter signed."
          onClose={() => setSigning(null)}
          onSubmit={async (body) => {
            const result = await api(path + '/' + signing.uuid + '/sign', { method: 'POST', body });
            resource.reload();
            return result;
          }}
        >
          <a
            className="text-sm font-semibold text-brand-700 underline dark:text-brand-300"
            href={apiBase + path + '/' + signing.uuid + '/download?format=print'}
            target="_blank"
            rel="noopener noreferrer"
          >
            Review letter in a new tab
          </a>
        </FormModal>
      )}
      {template && (
        <FormModal
          open
          title={'Issue ' + template.title}
          fields={
            template.kind === 'salary_certificate'
              ? [...salaryFields, signatureRequestField]
              : [signatureRequestField]
          }
          intro={
            template.kind === 'salary_certificate'
              ? 'Enter the amount verified by payroll for the selected pay period.'
              : 'Issue this letter using the saved employee record and template version.'
          }
          submitLabel="Issue letter"
          onClose={() => setTemplate(null)}
          success="Letter issued."
          onSubmit={async (details) => {
            const result = await api(path, {
              method: 'POST',
              body: { template: template.uuid, ...details },
            });
            setPage(1);
            resource.reload();
            return result;
          }}
        />
      )}
    </>
  );
}

export default function EmployeeLetters({ uuid, initiallyExpanded = false }) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  return (
    <div className="mt-4 space-y-3">
      <Button variant="secondary" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        <FileText size={16} aria-hidden="true" /> HR letters
      </Button>
      {expanded && <LetterLibrary uuid={uuid} />}
    </div>
  );
}
