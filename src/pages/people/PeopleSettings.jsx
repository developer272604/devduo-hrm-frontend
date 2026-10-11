import { useState } from 'react';
import { PageHeader, Card, Tabs } from '../../components/ui';
import { SettingsSection } from '../../components/people/PeopleSettingsForms';
import {
  LookupsPanel,
  DocumentTypesPanel,
  SkillsTagsPanel,
  GroupsPanel,
  CustomFieldsPanel,
  CountriesPanel,
  DataScopesPanel,
} from '../../components/people/PeopleSettingsPanels';

const TABS = [
  ['general', 'General', () => <SettingsSection section="general" />],
  ['numbering', 'Numbering', () => <SettingsSection section="numbering" />],
  ['edit_rules', 'Edit rules', () => <SettingsSection section="edit_rules" />],
  ['directory_privacy', 'Directory privacy', () => <SettingsSection section="directory_privacy" />],
  ['field_policies', 'Data classification', () => <SettingsSection section="field_policies" />],
  ['completeness', 'Completeness', () => <SettingsSection section="completeness" />],
  ['lookups', 'Lookups', LookupsPanel],
  ['custom', 'Custom fields', CustomFieldsPanel],
  ['documents', 'Document types', DocumentTypesPanel],
  ['skills', 'Skills & tags', SkillsTagsPanel],
  ['countries', 'Countries', CountriesPanel],
  ['groups', 'Groups', GroupsPanel],
  ['scopes', 'Data scopes', DataScopesPanel],
];

export default function PeopleSettings() {
  const [tab, setTab] = useState('general'),
    Panel = TABS.find(([value]) => value === tab)[2];
  return (
    <>
      <PageHeader
        title="People settings"
        description="Configure employee numbering, profile rules, catalogues and access scope."
      />
      <Card>
        <Tabs value={tab} onChange={setTab} items={TABS.map(([value, label]) => ({ value, label }))} />
        <Panel key={tab} />
      </Card>
    </>
  );
}
