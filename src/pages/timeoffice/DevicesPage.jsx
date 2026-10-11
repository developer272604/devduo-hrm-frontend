import { useState } from 'react';
import { Copy } from 'lucide-react';
import { Button, Card, ErrorState, Input, Modal, Skeleton, Tabs, useToast } from '../../components/ui';
import CrudPanel from '../../components/timeoffice/CrudPanel';
import ResponsiveList from '../../components/ResponsiveList';
import { Banner, Screen, StatusBadge } from '../../components/timeoffice/parts';
import { PreviewConfirm } from '../../components/timeoffice/dialogs';
import { useAuth } from '../../lib/auth';
import { paths, send, time, titleCase, today, toOptions, useList, useLookup } from '../../lib/timeOfficeApi';

const TABS = [
  { value: 'devices', label: 'Devices' },
  { value: 'geofences', label: 'Geofences' },
];
const TYPES = ['biometric', 'rfid', 'face', 'kiosk', 'mobile', 'other'].map((v) => ({ value: v, label: titleCase(v) }));

/** A device token is displayed exactly once. It lives only in this component's state and is cleared on close. */
export function TokenDialog({ token, notice, onClose }) {
  const toast = useToast();
  return (
    <Modal open={Boolean(token)} onClose={onClose} title="Device token">
      <Banner tone="warn" title="Copy this token now">{notice ?? 'It is shown only once. Rotate the token if it is lost.'}</Banner>
      <Input label="Token" readOnly value={token ?? ''} onFocus={(e) => e.target.select()} />
      <div className="flex justify-end gap-2.5">
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(token);
              toast('Token copied');
            } catch {
              toast('Select the token and copy it manually', 'error');
            }
          }}
        >
          <Copy size={14} /> Copy
        </Button>
        <Button onClick={onClose}>I have saved it</Button>
      </div>
    </Modal>
  );
}

function DeviceDetail({ device, onClose }) {
  const [tab, setTab] = useState('runs');
  const base = `${paths.devices}/${device.id}`;
  const runs = useList(`${base}/sync-runs`);
  const maps = useList(`${base}/mappings`);
  const unmapped = useList(`${base}/unmapped`);
  const view = { runs, mappings: maps, unmapped }[tab];
  const defs = {
    runs: {
      columns: [
        { key: 'started_at', label: 'Started', render: (r) => `${String(r.started_at).slice(0, 10)} ${time(r.started_at)}` },
        { key: 'status', label: 'Result', render: (r) => <StatusBadge status={r.status} /> },
        { key: 'fetched', label: 'Fetched', priority: 'md' },
        { key: 'inserted', label: 'Saved', priority: 'md' },
        { key: 'unmapped', label: 'Unmapped', priority: 'lg' },
        { key: 'errors', label: 'Errors', priority: 'lg' },
      ],
      mobile: { title: (r) => `${String(r.started_at).slice(0, 10)} ${time(r.started_at)}`, badge: (r) => <StatusBadge status={r.status} />, subtitle: 'message', facts: [{ label: 'Saved', value: 'inserted' }, { label: 'Errors', value: 'errors' }] },
      empty: { title: 'No sync runs yet', description: 'Runs appear after the first sync.' },
    },
    mappings: {
      columns: [
        { key: 'employee', label: 'Employee', render: (r) => r.employee?.name ?? '—' },
        { key: 'device_employee_id', label: 'Device user ID' },
        { key: 'effective_from', label: 'From', priority: 'md' },
        { key: 'effective_to', label: 'To', priority: 'md', render: (r) => r.effective_to ?? 'Open' },
      ],
      mobile: { title: (r) => r.employee?.name, subtitle: 'device_employee_id', facts: [{ label: 'From', value: 'effective_from' }] },
      empty: { title: 'No employees mapped', description: 'Map device user IDs to employees so punches can be attributed.' },
    },
    unmapped: {
      columns: [
        { key: 'device_employee_id', label: 'Device user ID' },
        { key: 'count', label: 'Punches', priority: 'md' },
        { key: 'last_seen_at', label: 'Last seen', priority: 'md' },
      ],
      mobile: { title: 'device_employee_id', facts: [{ label: 'Punches', value: 'count' }] },
      empty: { title: 'Nothing unmapped', description: 'Every device user ID seen so far is mapped to an employee.' },
    },
  }[tab];
  return (
    <Modal open onClose={onClose} title={device.name}>
      <Tabs items={[{ value: 'runs', label: 'Sync runs' }, { value: 'mappings', label: 'Mappings' }, { value: 'unmapped', label: 'Unmapped IDs' }]} value={tab} onChange={setTab} />
      {tab === 'mappings' && (
        <CrudPanel
          title="Employee mappings"
          noun="mapping"
          listPath={`${base}/mappings`}
          itemPath={(r) => `${base}/mappings/${r.id}`}
          method="PUT"
          fields={[
            { name: 'employee_id', label: 'Employee ID', required: true },
            { name: 'device_employee_id', label: 'User ID on the device', required: true },
            { name: 'effective_from', label: 'Effective from', type: 'date', default: today() },
            { name: 'effective_to', label: 'Effective to', type: 'date' },
          ]}
          columns={defs.columns}
          mobile={defs.mobile}
          empty={defs.empty}
          fromRow={(r) => ({ ...r, employee_id: r.employee?.id })}
        />
      )}
      {tab !== 'mappings' &&
        (view.loading ? <Skeleton rows={2} /> : view.error ? <ErrorState error={view.error} onRetry={view.reload} /> : <ResponsiveList label={tab} columns={defs.columns} rows={view.rows} mobile={defs.mobile} rowKey={(r) => r.id ?? r.device_employee_id} empty={defs.empty} />)}
    </Modal>
  );
}

function Devices({ canEdit }) {
  const toast = useToast();
  const locations = useLookup('/organization/locations?per_page=100');
  const providers = useLookup(paths.deviceProviders);
  const [token, setToken] = useState(null);
  const [rotate, setRotate] = useState(null);
  const [detail, setDetail] = useState(null);
  const [result, setResult] = useState(null);
  const fields = [
    { name: 'name', label: 'Name', required: true },
    { name: 'type', label: 'Type', type: 'select', required: true, default: 'biometric', options: TYPES },
    { name: 'provider_key', label: 'Integration', type: 'select', default: 'generic', options: providers.length ? providers.map((p) => ({ value: p.key, label: p.label })) : [{ value: 'generic', label: 'Generic' }] },
    { name: 'vendor', label: 'Vendor' },
    { name: 'device_identifier', label: 'Device serial or ID', required: true },
    { name: 'location_id', label: 'Location', type: 'select', options: toOptions(locations, 'None') },
    { name: 'timezone', label: 'Time zone', required: true, default: 'Asia/Kolkata' },
    { name: 'sync_interval_minutes', label: 'Sync every (minutes)', type: 'number', default: 15, min: 1, max: 1440 },
    { name: 'status', label: 'Status', type: 'select', default: 'active', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
  ];
  async function quick(device, action, label) {
    try {
      const r = await send('POST', `${paths.devices}/${device.id}/${action}`);
      const d = r?.data ?? r;
      setResult({ label, device: device.name, ok: d?.ok !== false, message: d?.message });
      toast(`${label} finished for ${device.name}`);
    } catch (e) {
      setResult({ label, device: device.name, ok: false, message: e.message });
    }
  }
  return (
    <>
      {result && (
        <Banner tone={result.ok ? 'success' : 'error'} title={`${result.label}: ${result.device}`}>
          {result.message ?? (result.ok ? 'Completed.' : 'Failed.')}
        </Banner>
      )}
      <CrudPanel
        title="Devices"
        noun="device"
        listPath={paths.devices}
        itemPath={(r) => `${paths.devices}/${r.id}`}
        method="PUT"
        canEdit={canEdit}
        fields={fields}
        onSaved={(r) => r?.token && setToken({ value: r.token, notice: r.token_notice })}
        columns={[
          { key: 'name', label: 'Device' },
          { key: 'type', label: 'Type', priority: 'md', render: (r) => titleCase(r.type) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'last_sync_at', label: 'Last sync', priority: 'md', render: (r) => (r.last_sync_at ? `${String(r.last_sync_at).slice(0, 10)} ${time(r.last_sync_at)}` : 'Never') },
          { key: 'token_hint', label: 'Token', priority: 'lg', render: (r) => r.token_hint ?? 'None' },
        ]}
        mobile={{ title: 'name', subtitle: (r) => titleCase(r.type), badge: (r) => <StatusBadge status={r.status} />, facts: [{ label: 'Last sync', value: (r) => (r.last_sync_at ? time(r.last_sync_at) : 'Never') }, { label: 'Token', value: (r) => r.token_hint ?? 'None' }] }}
        rowActions={(r) =>
          canEdit ? (
            <span className="flex flex-wrap gap-1.5">
              <Button variant="secondary" onClick={() => setDetail(r)}>Details</Button>
              <Button variant="secondary" onClick={() => quick(r, 'test', 'Connection test')}>Test</Button>
              {r.pulls && <Button variant="secondary" onClick={() => quick(r, 'sync', 'Sync')}>Sync now</Button>}
              <Button variant="secondary" onClick={() => setRotate(r)}>Rotate token</Button>
            </span>
          ) : (
            <Button variant="secondary" onClick={() => setDetail(r)}>Details</Button>
          )
        }
      />
      <PreviewConfirm
        open={Boolean(rotate)}
        onClose={() => setRotate(null)}
        title={`Rotate token: ${rotate?.name}`}
        intro="The current token stops working immediately. Update the device or integration with the new token, or it will stop sending punches."
        danger
        load={async () => ({ device: rotate.name, current_token: rotate.token_hint ?? 'none', effect: 'Punches from the device are rejected until it uses the new token.' })}
        onConfirm={async () => {
          const r = await send('POST', `${paths.devices}/${rotate.id}/rotate-token`);
          setToken({ value: r.token, notice: r.token_notice });
        }}
        confirmLabel="Rotate and show new token"
      />
      <TokenDialog token={token?.value} notice={token?.notice} onClose={() => setToken(null)} />
      {detail && <DeviceDetail device={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

export default function DevicesPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState('devices');
  const locations = useLookup('/organization/locations?per_page=100');
  return (
    <Screen title="Devices" description="Biometric and kiosk devices, their tokens, user mappings and geofences." permission="attendance.devices.manage">
      <Card className="mb-5">
        <Tabs items={TABS} value={tab} onChange={setTab} />
      </Card>
      {tab === 'devices' && <Devices canEdit={can('attendance.devices.manage')} />}
      {tab === 'geofences' && (
        <CrudPanel
          title="Geofences"
          noun="geofence"
          listPath={paths.geofences}
          itemPath={(r) => `${paths.geofences}/${r.id}`}
          method="PUT"
          fields={[
            { name: 'name', label: 'Name', required: true },
            { name: 'location_id', label: 'Location', type: 'select', options: toOptions(locations, 'None') },
            { name: 'latitude', label: 'Latitude', type: 'number', required: true, min: -90, max: 90 },
            { name: 'longitude', label: 'Longitude', type: 'number', required: true, min: -180, max: 180 },
            { name: 'radius_meters', label: 'Radius (metres)', type: 'number', required: true, min: 10, max: 50000 },
            { name: 'active', label: 'Active', type: 'checkbox', default: true },
          ]}
          columns={[
            { key: 'name', label: 'Geofence' },
            { key: 'radius_meters', label: 'Radius (m)' },
            { key: 'latitude', label: 'Latitude', priority: 'lg' },
            { key: 'longitude', label: 'Longitude', priority: 'lg' },
            { key: 'active', label: 'Status', render: (r) => <StatusBadge status={r.active === false ? 'inactive' : 'active'} /> },
          ]}
          mobile={{ title: 'name', subtitle: (r) => `${r.radius_meters} m radius`, badge: (r) => <StatusBadge status={r.active === false ? 'inactive' : 'active'} /> }}
        />
      )}
    </Screen>
  );
}
