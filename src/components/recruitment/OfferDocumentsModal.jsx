import { useState } from 'react';
import { Printer } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorState, Modal, Skeleton, useToast } from '../ui';
import { Banner } from './kit';
import { useAuth } from '../../lib/auth';
import { OFFER_DOC_STATUSES, fmtDate, openPrintView, paths, send, titleCase, useList } from '../../lib/recruitmentApi';

/** Whether a document can be generated now: approved or sent offers, and recruitment.offer.manage. */
export const canGenerate = (offer, can) => Boolean(offer) && OFFER_DOC_STATUSES.includes(offer.status) && can('recruitment.offer.manage');

function Body({ offer }) {
  const { can } = useAuth();
  const toast = useToast();
  const list = useList(paths.offerDocuments(offer.uuid));
  const [busy, setBusy] = useState(false);
  const generate = canGenerate(offer, can);
  async function make() {
    setBusy(true);
    try {
      await send('POST', paths.offerDocuments(offer.uuid), {});
      toast('Document generated');
      list.reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  async function open(d) {
    try {
      await openPrintView(offer.uuid, d.version);
    } catch (e) {
      toast(e.message, 'error');
    }
  }
  return (
    <>
      <Banner tone="info">
        Compensation text appears in the letter only for users with payroll.compensation.view; everyone else sees a placeholder. No e-signature or email is sent: record "sent" manually.
      </Banner>
      {generate ? (
        <div className="mb-3">
          <Button loading={busy} onClick={make}>
            Generate document
          </Button>
          <p className="mb-0 mt-1 text-xs text-slate-500 dark:text-slate-400">Creates a new version from the active template. Earlier versions never change.</p>
        </div>
      ) : (
        <p className="mt-0 text-xs text-slate-500 dark:text-slate-400" data-testid="generate-note">
          {can('recruitment.offer.manage') ? 'Documents can be generated once the offer is approved or sent.' : 'You can view documents. Generating needs the offer manage permission.'}
        </p>
      )}
      {list.loading ? (
        <Skeleton rows={2} />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.rows.length === 0 ? (
        <EmptyState title="No documents" description="Documents are created when an offer is approved (if a template is active) or when you generate one." />
      ) : (
        <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800" aria-label="Offer document versions">
          {list.rows.map((d) => (
            <li key={d.uuid ?? d.version} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 text-xs text-slate-500 dark:text-slate-400">
                <Badge>v{d.version}</Badge>{' '}
                <span>
                  Generated {fmtDate(d.generated_at)} · template v{d.template_version} · {titleCase(d.trigger)}
                </span>
              </div>
              {d.available ? (
                <Button variant="secondary" aria-label={`Open print view for version ${d.version}`} onClick={() => open(d)}>
                  <Printer size={16} /> Print view
                </Button>
              ) : (
                <span className="text-xs">Purged</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function OfferDocumentsModal({ offer, onClose }) {
  return (
    <Modal open={Boolean(offer)} onClose={onClose} title={`Offer documents: ${offer?.candidate_name ?? ''}`}>
      {offer && <Body offer={offer} />}
    </Modal>
  );
}
