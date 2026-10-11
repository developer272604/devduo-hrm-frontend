import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { PageHeader, Card, Tabs } from '../../components/ui';
import ImportExportWizard from '../../components/people/ImportExportWizard';
import ImportExportHistory from '../../components/people/ImportExportHistory';
import ImportExportExport from '../../components/people/ImportExportExport';
import ImportExportBulk from '../../components/people/ImportExportBulk';

export default function ImportExport() {
  const { can } = useAuth(),
    items = [
      ...(can('people.import')
        ? [
            { value: 'import', label: 'Import' },
            { value: 'history', label: 'Import history' },
          ]
        : []),
      ...(can('people.export') ? [{ value: 'export', label: 'Export' }] : []),
      ...(can('people.bulk') ? [{ value: 'bulk', label: 'Bulk runs' }] : []),
    ],
    [tab, setTab] = useState(items[0]?.value);
  return (
    <>
      <PageHeader
        title="Import and export"
        description="Validate and review employee spreadsheets before importing. Export only the records you may access."
      />
      <Card>
        <Tabs value={tab} onChange={setTab} items={items} />
        {tab === 'import' && <ImportExportWizard onFinished={() => setTab('history')} />}
        {tab === 'history' && <ImportExportHistory />}
        {tab === 'export' && <ImportExportExport />}
        {tab === 'bulk' && <ImportExportBulk />}
      </Card>
    </>
  );
}
