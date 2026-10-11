import { useState } from 'react';
import { Button, Drawer, ErrorState, Skeleton, useToast } from '../../components/ui';
import { Banner, ConfirmDialog, ConfirmPreview, FormModal, Impact, KeyValues, ListCard, Page, StatusBadge } from '../../components/payroll/kit';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import { paths, send, titleCase, unwrap, useList } from '../../lib/payrollApi';

const ACCESS = 'payroll.configure|payroll.country_pack.manage|payroll.country_pack.publish';
const EXPERT = 'Country pack content is data, not legal advice. Rates, slabs and rules must be validated by a qualified payroll or tax professional for your country before they are verified, enabled or used for real pay.';

function PackDrawer({ uuid, onClose, onChanged }) {
  const { can } = useAuth();
  const toast = useToast();
  const res = useResource(uuid ? paths.countryPack(uuid) : '/v1/payroll/country-packs/none');
  const [action, setAction] = useState(null);
  const pack = res.data ? unwrap(res.data) : null;
  const versions = pack?.versions ?? [];
  const manage = can('payroll.country_pack.manage') || can('payroll.configure');
  const publish = can('payroll.country_pack.publish');
  const refresh = () => {
    res.reload();
    onChanged();
  };
  return (
    <Drawer open={Boolean(uuid)} onClose={onClose} title={pack?.name ?? 'Country pack'}>
      <Banner tone="warn" title="Needs expert validation">
        {EXPERT}
      </Banner>
      {res.loading ? (
        <Skeleton rows={2} />
      ) : res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : (
        <div className="space-y-4">
          <KeyValues data={{ code: pack.code, country: pack.country, handler: pack.handler, enabled: pack.enabled ? 'Yes' : 'No' }} />
          {publish && (
            <Button variant={pack.enabled ? 'secondary' : 'primary'} onClick={() => setAction({ type: pack.enabled ? 'disable' : 'enable' })}>
              {pack.enabled ? 'Disable pack' : 'Enable pack'}
            </Button>
          )}
          <ListCard
            title="Versions"
            list={{ loading: false, error: null, rows: versions }}
            columns={[
              { key: 'version', label: 'Version' },
              { key: 'effective_from', label: 'Effective from' },
              { key: 'state', label: 'State', render: (r) => <StatusBadge value={r.status ?? r.state} /> },
              { key: 'verified', label: 'Verified', render: (r) => (r.verified_at || r.verified ? 'Yes' : 'No') },
              {
                key: 'act',
                label: '',
                render: (r) => <VersionActions v={r} manage={manage} publish={publish} onAction={(type) => setAction({ type, v: r })} />,
              },
            ]}
            card={(r) => (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <strong className="text-sm">Version {r.version}</strong>
                  <StatusBadge value={r.status ?? r.state} />
                </div>
                <p className="m-0 text-xs text-slate-500">From {r.effective_from} · {r.verified_at || r.verified ? 'Verified' : 'Not verified'}</p>
                <div className="mt-2">
                  <VersionActions v={r} manage={manage} publish={publish} onAction={(type) => setAction({ type, v: r })} />
                </div>
              </div>
            )}
            empty={{ title: 'No versions', description: 'Add a version with rules before publishing.' }}
          />
        </div>
      )}
      <ConfirmPreview
        open={action?.type === 'publish'}
        onClose={() => setAction(null)}
        title={`Publish version ${action?.v?.version ?? ''}`}
        intro="Publishing makes the rules immutable. This runs the validity check first."
        notice={EXPERT}
        load={() => send('POST', paths.packVersion(action.v.uuid, 'check'), {})}
        blocked={(d) => (d.problems?.length ? `Fix ${d.problems.length} problem(s) first: ${d.problems.map((p) => (typeof p === 'string' ? p : p.message)).join('; ')}` : null)}
        ack={() => 'I understand the rules must be validated by a qualified expert before they are used for real pay'}
        confirmLabel="Publish version"
        onConfirm={async () => {
          await send('POST', paths.packVersion(action.v.uuid, 'publish'), {});
          toast('Version published');
          refresh();
        }}
      >
        {(d) => <Impact data={d} />}
      </ConfirmPreview>
      <FormModal
        open={action?.type === 'verify'}
        onClose={() => setAction(null)}
        title={`Verify version ${action?.v?.version ?? ''}`}
        intro="Verification confirms the content was reviewed by an expert. It must be done by someone other than the publisher."
        fields={[{ name: 'note', label: 'Verification note (at least 10 characters)', textarea: true }]}
        submitLabel="Verify"
        onSubmit={async (v) => {
          await send('POST', paths.packVersion(action.v.uuid, 'verify'), { note: v.note });
          refresh();
        }}
        success="Version verified"
      />
      <FormModal
        open={action?.type === 'retire'}
        onClose={() => setAction(null)}
        title={`Retire version ${action?.v?.version ?? ''}`}
        fields={[{ name: 'effective_to', label: 'Effective to', type: 'date' }]}
        submitLabel="Retire"
        onSubmit={async (v) => {
          await send('POST', paths.packVersion(action.v.uuid, 'retire'), { effective_to: v.effective_to });
          refresh();
        }}
        success="Version retired"
      />
      <ConfirmDialog
        open={action?.type === 'enable' || action?.type === 'disable'}
        onClose={() => setAction(null)}
        title={`${titleCase(action?.type ?? '')} ${pack?.name ?? 'pack'}?`}
        intro={action?.type === 'enable' ? `Payroll groups in this country will use the verified rules for statutory lines. ${EXPERT}` : 'New calculations will stop producing statutory lines from this pack.'}
        confirmLabel={titleCase(action?.type ?? 'Confirm')}
        onConfirm={async () => {
          await send('POST', paths.countryPack(uuid, action.type), {});
          toast(`Pack ${action.type}d`);
          refresh();
        }}
      />
    </Drawer>
  );
}

function VersionActions({ v, manage, publish, onAction }) {
  const state = v.status ?? v.state;
  return (
    <span className="flex flex-wrap gap-1">
      {state === 'draft' && publish && <Button variant="secondary" className="min-h-8! px-2! py-1!" onClick={() => onAction('publish')}>Publish</Button>}
      {state === 'published' && !(v.verified_at || v.verified) && publish && <Button variant="secondary" className="min-h-8! px-2! py-1!" onClick={() => onAction('verify')}>Verify</Button>}
      {state === 'published' && publish && <Button variant="secondary" className="min-h-8! px-2! py-1!" onClick={() => onAction('retire')}>Retire</Button>}
      {!publish && manage && state === 'draft' && <span className="text-xs text-slate-500">Publishing needs the publish permission</span>}
    </span>
  );
}

export default function CountryPacksPage() {
  const { can } = useAuth();
  const toast = useToast();
  const list = useList(paths.countryPacks);
  const [open, setOpen] = useState(null);
  const [sample, setSample] = useState(false);
  const manage = can('payroll.country_pack.manage') || can('payroll.configure');
  return (
    <Page permission={ACCESS} title="Country packs" description="Statutory rules as versioned data." action={manage && <Button variant="secondary" onClick={() => setSample(true)}>Install sample pack</Button>}>
      <Banner tone="warn" title="Needs expert validation">
        {EXPERT}
      </Banner>
      <ListCard
        title="Packs"
        list={list}
        onRowClick={(r) => setOpen(r.uuid)}
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          { key: 'country', label: 'Country' },
          { key: 'enabled', label: 'Status', render: (r) => <StatusBadge value={r.enabled ? 'enabled' : 'disabled'} /> },
        ]}
        mobile={{ title: 'name', subtitle: 'code', badge: (r) => <StatusBadge value={r.enabled ? 'enabled' : 'disabled'} />, facts: [{ label: 'Country', value: 'country' }] }}
        empty={{ title: 'No country packs', description: 'Install the illustrative sample pack to explore, or create a pack.' }}
      />
      <ConfirmDialog
        open={sample}
        onClose={() => setSample(false)}
        title="Install the sample pack?"
        intro="The sample pack (SAMPLE-ZZ) uses invented numbers for a fictional country. It is not real law and must never be used for real pay."
        confirmLabel="Install sample"
        onConfirm={async () => {
          await send('POST', paths.packSample, {});
          toast('Sample pack installed');
          list.reload();
        }}
      />
      <PackDrawer uuid={open} onClose={() => setOpen(null)} onChanged={list.reload} />
    </Page>
  );
}

