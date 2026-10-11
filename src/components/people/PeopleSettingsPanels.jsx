import { useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
  useToast,
} from '../ui';
import { useDebounced, useResource } from '../../lib/hooks';
import { api } from '../../lib/api';
import Access from '../Access';
import PeopleSettingsCrud, { activeBadge } from './PeopleSettingsCrud';

const SLUG = /^[a-z0-9][a-z0-9_-]*$/;
const yes = (v) => (v ? 'Yes' : 'No');
const activeField = { name: 'active', label: 'Active', type: 'checkbox', default: true };

/* ---------- lookups ---------- */
export const LOOKUP_KINDS = [
  ['employment_status', 'Employment status'],
  ['separation_reason', 'Separation reason'],
  ['relationship_type', 'Relationship type'],
  ['document_category', 'Document category'],
  ['skill_category', 'Skill category'],
  ['termination_reason', 'Termination reason'],
];
const lookupSpec = (kind) => ({
  noun: 'Lookup value',
  intro: 'System values cannot be deleted. Values in use can only be deactivated.',
  listPath: `/v1/people/lookups/${kind}`,
  createPath: `/v1/people/lookups/${kind}`,
  updatePath: (r) => `/v1/people/lookups/${kind}/${r.id}`,
  deletePath: (r) => `/v1/people/lookups/${kind}/${r.id}`,
  canDelete: (r) => r.can_delete !== false && !r.system,
  columns: [
    { key: 'label', label: 'Label' },
    { key: 'code', label: 'Code' },
    { key: 'active', label: 'Status', render: activeBadge },
    { key: 'system', label: 'Type', render: (r) => (r.system ? <Badge>System</Badge> : 'Custom') },
  ],
  fields: [
    { name: 'label', label: 'Label', required: true, maxLength: 120 },
    {
      name: 'code',
      label: 'Code',
      maxLength: 60,
      createOnly: true,
      pattern: SLUG,
      patternMessage: 'Use lowercase letters, numbers, - and _.',
      hint: 'Optional. Cannot be changed later.',
    },
    { name: 'sort', label: 'Sort order', type: 'number', min: 0 },
    activeField,
  ],
});
export function LookupsPanel() {
  const [kind, setKind] = useState('employment_status');
  return (
    <>
      <div className="px-4 pt-4 sm:px-6">
        <Select
          label="Lookup list"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={LOOKUP_KINDS.map(([value, label]) => ({ value, label }))}
        />
      </div>
      <PeopleSettingsCrud key={kind} spec={lookupSpec(kind)} />
    </>
  );
}

/* ---------- document types ---------- */
const docTypes = {
  noun: 'Document type',
  listPath: '/v1/people/document-types',
  createPath: '/v1/people/document-types',
  updatePath: (r) => `/v1/people/document-types/${r.code}`,
  updateMethod: 'PATCH',
  deletePath: (r) => `/v1/people/document-types/${r.code}`,
  canDelete: (r) => !r.builtin && !r.system && !r.in_use,
  rowKey: (r) => r.code,
  intro: 'Built-in or used types cannot be deleted; deactivate them instead.',
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'code', label: 'Code' },
    { key: 'category', label: 'Category' },
    { key: 'requires_expiry', label: 'Expiry', render: (r) => yes(r.requires_expiry) },
    { key: 'mandatory', label: 'Mandatory', render: (r) => yes(r.mandatory) },
    { key: 'active', label: 'Status', render: activeBadge },
  ],
  fields: [
    {
      name: 'code',
      label: 'Code',
      required: true,
      maxLength: 60,
      createOnly: true,
      pattern: SLUG,
      patternMessage: 'Use lowercase letters, numbers, - and _.',
    },
    { name: 'name', label: 'Name', required: true, maxLength: 120 },
    { name: 'category', label: 'Category', maxLength: 60 },
    { name: 'requires_expiry', label: 'Requires an expiry date', type: 'checkbox' },
    { name: 'mandatory', label: 'Mandatory for employees', type: 'checkbox' },
    activeField,
  ],
};
export const DocumentTypesPanel = () => <PeopleSettingsCrud spec={docTypes} />;

/* ---------- skills and tags ---------- */
const skills = {
  noun: 'Skill',
  listPath: '/v1/people/skills?include_inactive=1&per_page=100',
  createPath: '/v1/people/skills',
  updatePath: (r) => `/v1/people/skills/${r.id}`,
  updateMethod: 'PATCH',
  paged: false,
  intro: 'Skills are deactivated rather than deleted.',
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'active', label: 'Status', render: activeBadge },
  ],
  fields: [
    { name: 'name', label: 'Name', required: true, maxLength: 120 },
    { name: 'category', label: 'Category', maxLength: 80 },
    activeField,
  ],
};
const COLORS = [
  'slate',
  'gray',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
];
const tags = {
  noun: 'Tag',
  listPath: '/v1/people/tags?include_inactive=1&per_page=100',
  createPath: '/v1/people/tags',
  updatePath: (r) => `/v1/people/tags/${r.id}`,
  updateMethod: 'PATCH',
  intro: 'A required permission limits who can see and assign a tag.',
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'color_token', label: 'Colour' },
    { key: 'required_permission', label: 'Permission' },
    { key: 'active', label: 'Status', render: activeBadge },
  ],
  fields: [
    { name: 'name', label: 'Name', required: true, maxLength: 60 },
    { name: 'color_token', label: 'Colour', type: 'select', default: 'slate', options: COLORS },
    { name: 'description', label: 'Description', type: 'textarea', maxLength: 255 },
    {
      name: 'required_permission',
      label: 'Required permission key',
      maxLength: 80,
      pattern: /^[a-z][a-z0-9_.]*$/,
      patternMessage: 'Use a permission key such as people.notes.private.',
    },
    activeField,
  ],
};
export function SkillsTagsPanel() {
  const [kind, setKind] = useState('skills');
  return (
    <>
      <div className="px-4 pt-4 sm:px-6">
        <Select
          label="Catalogue"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={[
            { value: 'skills', label: 'Skills' },
            { value: 'tags', label: 'Tags' },
          ]}
        />
      </div>
      <PeopleSettingsCrud key={kind} spec={kind === 'skills' ? skills : tags} />
    </>
  );
}

/* ---------- groups ---------- */
const groups = {
  noun: 'Group',
  listPath: '/v1/people/groups?per_page=50',
  paged: true,
  createPath: '/v1/people/groups',
  updatePath: (r) => `/v1/people/groups/${r.id}`,
  deletePath: (r) => `/v1/people/groups/${r.id}`,
  intro:
    'A group cannot be deleted while it has members or data-scope grants; deactivate it instead.',
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'code', label: 'Code' },
    { key: 'members_count', label: 'Members' },
    { key: 'active', label: 'Status', render: activeBadge },
  ],
  fields: [
    { name: 'name', label: 'Name', required: true, maxLength: 120 },
    { name: 'code', label: 'Code', maxLength: 60 },
    { name: 'description', label: 'Description', type: 'textarea', maxLength: 500 },
    activeField,
  ],
};
export function GroupsPanel() {
  const [selected, setSelected] = useState(null);
  return (
    <>
      <PeopleSettingsCrud
        spec={{
          ...groups,
          extraActions: (row) => (
            <Button key="members" variant="secondary" onClick={() => setSelected(row)}>
              Members
            </Button>
          ),
        }}
      />
      {selected && <GroupMembersDialog group={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function GroupMembersDialog({ group, onClose }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim(), 250);
  const members = useResource(`/v1/people/groups/${group.id}/members?per_page=50`);
  const employees = useResource(
    query ? `/v1/employees?q=${encodeURIComponent(query)}&per_page=10` : '',
  );
  const [selected, setSelected] = useState([]);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const employeeRows = employees.data?.data || [];

  async function addMembers(event) {
    event.preventDefault();
    if (!selected.length) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api(`/v1/people/groups/${group.id}/members`, {
        method: 'POST',
        body: {
          employees: selected,
          effective_from: effectiveFrom || null,
          effective_to: effectiveTo || null,
        },
      });
      toast(`${result.added} member(s) added; ${result.updated} existing membership(s) updated.`);
      setSelected([]);
      setSearch('');
      setEffectiveFrom('');
      setEffectiveTo('');
      members.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(employee) {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/people/groups/${group.id}/members/${employee.employee_uuid}`, {
        method: 'DELETE',
      });
      toast(`${employee.display_name} removed from ${group.name}.`);
      members.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`${group.name} members`}>
      <div className="space-y-5">
        {error && <ErrorState error={error} />}
        <form
          className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
          onSubmit={addMembers}
        >
          <Input
            label="Find employees"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            hint="Search uses your permitted employee scope."
          />
          {query &&
            (employees.loading ? (
              <Skeleton rows={1} />
            ) : employees.error ? (
              <ErrorState error={employees.error} onRetry={employees.reload} />
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {employeeRows.length ? (
                  employeeRows.map((employee) => (
                    <Checkbox
                      key={employee.uuid}
                      label={`${employee.display_name} · ${employee.employee_number || employee.status}`}
                      checked={selected.includes(employee.uuid)}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? [...selected, employee.uuid]
                            : selected.filter((uuid) => uuid !== employee.uuid),
                        )
                      }
                    />
                  ))
                ) : (
                  <p className="text-xs text-slate-500">
                    No employees found in your permitted scope.
                  </p>
                )}
              </div>
            ))}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Membership starts"
              type="date"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
            <Input
              label="Membership ends"
              type="date"
              min={effectiveFrom || undefined}
              value={effectiveTo}
              onChange={(event) => setEffectiveTo(event.target.value)}
            />
          </div>
          <Button type="submit" loading={busy} disabled={!selected.length}>
            Add selected employees
          </Button>
        </form>
        <section aria-label="Current group members">
          <h3 className="mb-3 text-sm font-semibold">Current members</h3>
          {members.loading ? (
            <Skeleton rows={2} />
          ) : members.error ? (
            <ErrorState error={members.error} onRetry={members.reload} />
          ) : members.data?.data?.length ? (
            <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {members.data.data.map((employee) => (
                <div
                  key={employee.employee_uuid}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div>
                    <strong className="block text-xs">{employee.display_name}</strong>
                    <span className="text-xs text-slate-500">
                      {employee.employee_number || employee.status} ·{' '}
                      {employee.effective_from || 'no start'} – {employee.effective_to || 'no end'}
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => removeMember(employee)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">This group has no visible members.</p>
          )}
        </section>
      </div>
    </Modal>
  );
}

/* ---------- custom sections and fields ---------- */
const FIELD_TYPES = [
  'text',
  'long_text',
  'number',
  'currency',
  'date',
  'datetime',
  'boolean',
  'single_select',
  'multi_select',
  'email',
  'phone',
  'url',
  'employee_ref',
  'department_ref',
  'location_ref',
  'country',
  'attachment_ref',
];
const sections = {
  noun: 'Section',
  listPath: '/v1/people/custom-sections',
  createPath: '/v1/people/custom-sections',
  updatePath: (r) => `/v1/people/custom-sections/${r.id}`,
  deletePath: (r) => `/v1/people/custom-sections/${r.id}`,
  columns: [
    { key: 'label', label: 'Label' },
    { key: 'key', label: 'Key' },
    { key: 'classification', label: 'Classification' },
    { key: 'active', label: 'Status', render: activeBadge },
  ],
  fields: [
    {
      name: 'key',
      label: 'Key',
      required: true,
      maxLength: 60,
      createOnly: true,
      pattern: /^[a-z][a-z0-9_]*$/,
      patternMessage: 'Use lowercase letters, numbers and underscores.',
    },
    { name: 'label', label: 'Label', required: true, maxLength: 120 },
    { name: 'description', label: 'Description', type: 'textarea', maxLength: 500 },
    { name: 'sort', label: 'Sort order', type: 'number', min: 0 },
    activeField,
  ],
};
const customFields = {
  noun: 'Field',
  intro:
    'Fields with stored values cannot be deleted; deactivate them to hide the field and keep the data.',
  listPath: '/v1/people/custom-fields',
  createPath: '/v1/people/custom-fields',
  updatePath: (r) => `/v1/people/custom-fields/${r.id}`,
  deletePath: (r) => `/v1/people/custom-fields/${r.id}`,
  columns: [
    { key: 'label', label: 'Label' },
    { key: 'key', label: 'Key' },
    { key: 'type', label: 'Type' },
    { key: 'required', label: 'Required', render: (r) => yes(r.required) },
    { key: 'active', label: 'Status', render: activeBadge },
  ],
  fields: [
    {
      name: 'entity',
      label: 'Applies to',
      type: 'select',
      createOnly: true,
      default: 'employee',
      options: [
        { value: 'employee', label: 'Employee record' },
        { value: 'person', label: 'Person (personal data)' },
      ],
    },
    {
      name: 'key',
      label: 'Key',
      required: true,
      maxLength: 60,
      createOnly: true,
      pattern: /^[a-z][a-z0-9_]*$/,
      patternMessage: 'Use lowercase letters, numbers and underscores.',
    },
    {
      name: 'type',
      label: 'Type',
      type: 'select',
      createOnly: true,
      default: 'text',
      options: FIELD_TYPES,
    },
    { name: 'label', label: 'Label', required: true, maxLength: 120 },
    { name: 'section_id', label: 'Section ID', type: 'number', min: 1 },
    { name: 'required', label: 'Required', type: 'checkbox' },
    { name: 'employee_editable', label: 'Employee can edit', type: 'checkbox' },
    activeField,
  ],
};
export function CustomFieldsPanel() {
  const [kind, setKind] = useState('fields');
  return (
    <>
      <div className="px-4 pt-4 sm:px-6">
        <Select
          label="Manage"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={[
            { value: 'fields', label: 'Custom fields' },
            { value: 'sections', label: 'Sections' },
            { value: 'options', label: 'Choice options' },
          ]}
        />
      </div>
      {kind === 'options' ? (
        <CustomFieldOptionsPanel />
      ) : (
        <PeopleSettingsCrud key={kind} spec={kind === 'fields' ? customFields : sections} />
      )}
    </>
  );
}

function CustomFieldOptionsPanel() {
  const resource = useResource('/v1/people/custom-fields');
  const toast = useToast();
  const [selected, setSelected] = useState('');
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fields = (resource.data?.data || []).filter((field) =>
    ['single_select', 'multi_select'].includes(field.type),
  );
  const field = fields.find((entry) => String(entry.id) === String(selected));

  async function changeOption(option, active) {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/people/custom-fields/${field.id}/options/${option.id}`, {
        method: 'PUT',
        body: { active },
      });
      toast(active ? 'Choice option activated.' : 'Choice option deactivated.');
      resource.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function addOption(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/people/custom-fields/${field.id}/options`, {
        method: 'POST',
        body: {
          label: label.trim(),
          ...(value.trim() ? { value: value.trim().toLowerCase() } : {}),
        },
      });
      setLabel('');
      setValue('');
      toast('Choice option added.');
      resource.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <p className="m-0 max-w-2xl text-xs text-slate-500 dark:text-slate-400">
        Configure choices for single-select and multi-select fields. Existing stored values are
        preserved; deactivate an option to stop offering it for new profile edits.
      </p>
      {resource.loading ? (
        <Skeleton rows={2} />
      ) : resource.error ? (
        <ErrorState error={resource.error} onRetry={resource.reload} />
      ) : (
        <>
          <Select
            label="Choice field"
            value={selected}
            onChange={(event) => {
              setSelected(event.target.value);
              setError(null);
            }}
            options={[
              { value: '', label: 'Choose a custom field' },
              ...fields.map((item) => ({
                value: String(item.id),
                label: `${item.label} (${item.type.replace('_', ' ')})`,
              })),
            ]}
          />
          {!fields.length && (
            <p className="text-xs text-slate-500">
              Create a single-select or multi-select custom field first.
            </p>
          )}
          {field && (
            <>
              {error && <ErrorState error={error} />}
              <form
                className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                onSubmit={addOption}
              >
                <Input
                  label="Option label"
                  required
                  maxLength={150}
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                />
                <Input
                  label="Stored value (optional)"
                  maxLength={120}
                  pattern="[a-z0-9][a-z0-9_-]*"
                  hint="Lowercase letters, digits, _ or -. Defaults from the label."
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
                <Button type="submit" loading={busy}>
                  Add option
                </Button>
              </form>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950">
                    <tr>
                      <th className="p-3">Label</th>
                      <th className="p-3">Stored value</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(field.options || []).map((option) => (
                      <tr
                        key={option.id}
                        className="border-t border-slate-100 dark:border-slate-800"
                      >
                        <td className="p-3">{option.label}</td>
                        <td className="p-3 font-mono">{option.value}</td>
                        <td className="p-3">
                          <Badge tone={option.active ? 'green' : 'neutral'}>
                            {option.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => changeOption(option, !option.active)}
                          >
                            {option.active ? 'Deactivate' : 'Reactivate'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!field.options?.length && (
                      <tr>
                        <td className="p-4 text-slate-500" colSpan={4}>
                          No options yet. Add the first choice above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- country configs ---------- */
const countries = {
  noun: 'Country',
  intro:
    'Overrides change the shipped country pack for this workspace. Reset removes the override.',
  listPath: '/v1/people/countries',
  createPath: '/v1/people/countries/__new__',
  updatePath: (r) => `/v1/people/countries/${r.code}`,
  deletePath: (r) => `/v1/people/countries/${r.code}`,
  deleteLabel: 'reset',
  canDelete: (r) => r.source === 'override' || r.source === 'custom',
  rowKey: (r) => r.code,
  columns: [
    { key: 'name', label: 'Country' },
    { key: 'code', label: 'Code' },
    { key: 'currency', label: 'Currency' },
    { key: 'timezone', label: 'Time zone' },
    {
      key: 'source',
      label: 'Source',
      render: (r) => <Badge tone={r.source === 'default' ? 'neutral' : 'purple'}>{r.source}</Badge>,
    },
  ],
  fields: [
    { name: 'name', label: 'Name', required: true, maxLength: 80 },
    {
      name: 'currency',
      label: 'Currency (ISO)',
      maxLength: 3,
      pattern: /^[A-Za-z]{3}$/,
      patternMessage: 'Use a 3-letter currency code.',
    },
    { name: 'timezone', label: 'Time zone', maxLength: 64 },
    { name: 'locale', label: 'Locale', maxLength: 20 },
    { name: 'date_format', label: 'Date format', maxLength: 20 },
    { name: 'phone_code', label: 'Phone code', maxLength: 6 },
  ],
};
export const CountriesPanel = () => (
  <PeopleSettingsCrud spec={{ ...countries, createPath: undefined }} />
);

/* ---------- data-scope grants ---------- */
const scopes = {
  noun: 'Grant',
  paged: true,
  intro:
    'Grants extend which employees a user can see beyond their role. Employee grants use the employee UUID.',
  listPath: '/access/data-scopes',
  createPath: '/access/data-scopes',
  deletePath: (r) => `/access/data-scopes/${r.id}`,
  columns: [
    { key: 'user', label: 'User', render: (r) => r.user?.name || r.user?.email || '—' },
    { key: 'kind', label: 'Scope', render: (r) => String(r.kind).replaceAll('_', ' ') },
    { key: 'reference_label', label: 'Applies to' },
  ],
  fields: [
    { name: 'user_id', label: 'User ID', type: 'number', required: true, min: 1 },
    {
      name: 'kind',
      label: 'Scope',
      type: 'select',
      default: 'department',
      options: [
        'department',
        'business_unit',
        'location',
        'legal_entity',
        'employee_group',
        'employee',
      ],
    },
    {
      name: 'reference_id',
      label: 'Reference ID (employee UUID for employee scope)',
      required: true,
      maxLength: 64,
    },
  ],
  toBody: (b) => ({
    ...b,
    reference_id:
      b.kind === 'employee' || !/^\d+$/.test(String(b.reference_id))
        ? b.reference_id
        : Number(b.reference_id),
  }),
};
export const DataScopesPanel = () => (
  <Access permission="users.manage" module="people">
    <PeopleSettingsCrud spec={scopes} />
  </Access>
);
