import { useState } from 'react';
import { Button, Card, FormError, Modal, useToast } from '../../components/ui';
import { Banner } from '../../components/payroll/kit';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { invalid, paths, useAction } from '../../lib/performanceApi';
import { PersonPicker } from './parts';

export const PEER_NOTICE = 'Peer reviewers are anonymous. The employee never sees who wrote what, and peer comments stay hidden until the cycle minimum number of responses is reached.';

function NominateModal({ open, onClose, review, onDone }) {
  const toast = useToast();
  const [chosen, setChosen] = useState([]);
  const [pick, setPick] = useState('');
  const { busy, error, run, clear } = useAction();
  const add = (uuid) => {
    setPick('');
    if (uuid && !chosen.includes(uuid) && chosen.length < 8) setChosen([...chosen, uuid]);
  };
  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(async () => {
      if (!chosen.length) throw invalid('employee_uuids', 'Add at least one peer.');
      await api(paths.peers(review.uuid), { method: 'POST', body: { employee_uuids: chosen } });
    });
    if (ok) { toast('Peers nominated'); setChosen([]); onDone(); onClose(); }
  };
  return (
    <Modal open={open} onClose={() => { clear(); onClose(); }} title="Nominate peer reviewers">
      <form onSubmit={submit}>
        <p className="mt-0 text-sm">{PEER_NOTICE} You can nominate up to 8 colleagues.</p>
        <FormError error={error} />
        <PersonPicker label="Peer" value={pick} onChange={add} hint="Choosing a person adds them to the list below." />
        <p className="text-xs" aria-live="polite">{chosen.length} of 8 peers selected{chosen.length ? '' : ' (none yet)'}</p>
        <ul className="m-0 mb-3 list-none space-y-1 p-0">
          {chosen.map((c, i) => (
            <li key={c} className="flex items-center justify-between gap-2 text-xs">
              <span>Peer {i + 1}</span>
              <Button variant="secondary" aria-label={`Remove peer ${i + 1}`} onClick={() => setChosen(chosen.filter((x) => x !== c))}>Remove</Button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Nominate</Button>
        </div>
      </form>
    </Modal>
  );
}

function ReassignModal({ open, onClose, review, onDone }) {
  const toast = useToast();
  const [manager, setManager] = useState('');
  const { busy, error, run, clear } = useAction();
  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(async () => {
      if (!manager) throw invalid('manager_uuid', 'Choose the new reviewing manager.');
      await api(paths.manager(review.uuid), { method: 'POST', body: { manager_uuid: manager } });
    });
    if (ok) { toast('Reviewing manager reassigned'); onDone(); onClose(); }
  };
  return (
    <Modal open={open} onClose={() => { clear(); onClose(); }} title="Reassign the reviewing manager">
      <form onSubmit={submit}>
        <p className="mt-0 text-sm">Only possible before the manager has submitted their review. The previous manager loses access to this review.</p>
        <FormError error={error} />
        <PersonPicker label="New manager" value={manager} onChange={setManager} />
        <div className="mt-4 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Reassign manager</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Peer nomination (subject, their manager, HR) and manager reassignment (HR). Server rules remain authoritative. */
export function PeerPanel({ review, onChanged }) {
  const { can } = useAuth();
  const [modal, setModal] = useState(null);
  const open = review.cycle?.status === 'open' && !review.result?.finalized_at;
  const mayNominate = open && (['subject', 'manager'].includes(review.role) || can('performance.reviews.manage')) && can('performance.self|performance.reviews.manage');
  const mayReassign = open && can('performance.cycles.manage');
  if (!mayNominate && !mayReassign) return null;
  return (
    <Card title="Reviewers" className="mb-5">
      <div className="px-6 pb-5">
        <Banner tone="info" title="Anonymity">{PEER_NOTICE}</Banner>
        <div className="flex flex-wrap gap-2">
          {mayNominate && <Button variant="secondary" onClick={() => setModal('peers')}>Nominate peers</Button>}
          {mayReassign && <Button variant="secondary" onClick={() => setModal('manager')}>Reassign manager</Button>}
        </div>
      </div>
      <NominateModal open={modal === 'peers'} onClose={() => setModal(null)} review={review} onDone={onChanged} />
      <ReassignModal open={modal === 'manager'} onClose={() => setModal(null)} review={review} onDone={onChanged} />
    </Card>
  );
}
