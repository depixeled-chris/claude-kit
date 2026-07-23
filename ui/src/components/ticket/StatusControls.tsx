// Status controls: a button per legal transition from the current status (lib/status), with the
// forward move on `review` (Accept & close) rendered prominent. A transition confirms through the
// harvested Modal, then POSTs. The server is the guard authority — a 403 (human_only), 422
// (evidence floor) or 409 (not writable here) comes back typed and its message renders INLINE,
// because those are expected outcomes of honoring each project's human_only/uat config, not errors
// to swallow.

import { useState } from 'react';
import { postStatus, ApiError } from '../../services/api';
import { useIdentity } from '../../lib/identity';
import { transitionsFor, statusLabel, type Transition } from '../../lib/status';
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../Modal';

interface Props {
  projectKey: string;
  ticketId: string;
  status: string;
  onChanged: () => void;
}

export function StatusControls({ projectKey, ticketId, status, onChanged }: Props) {
  const { alias } = useIdentity();
  const [pending, setPending] = useState<Transition | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [guard, setGuard] = useState<{ code: string; message: string } | null>(null);

  const transitions = transitionsFor(status);

  async function confirm() {
    if (!pending) return;
    setSubmitting(true);
    setGuard(null);
    try {
      await postStatus(projectKey, ticketId, { status: pending.to, agent: alias });
      setPending(null);
      onChanged();
    } catch (err) {
      if (err instanceof ApiError) setGuard({ code: err.code, message: err.message });
      else setGuard({ code: 'error', message: 'status change failed' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="status-controls">
      <div className="status-current">
        Status: <strong>{statusLabel(status)}</strong>
      </div>
      {transitions.length === 0 ? (
        <p className="muted">No transitions from this status.</p>
      ) : (
        <div className="status-buttons">
          {transitions.map((t) => (
            <button
              key={t.to}
              className={t.primary ? 'btn btn-primary' : 'btn btn-secondary'}
              onClick={() => { setGuard(null); setPending(t); }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {guard && (
        <div className={`inline-guard guard-${guard.code}`}>
          <strong>{guard.code}</strong>: {guard.message}
        </div>
      )}

      <Modal isOpen={pending !== null} onClose={() => !submitting && setPending(null)} size="small">
        <ModalHeader onClose={() => !submitting && setPending(null)}>Confirm status change</ModalHeader>
        <ModalContent>
          Move <strong>{ticketId}</strong> to <strong>{pending ? statusLabel(pending.to) : ''}</strong>?
        </ModalContent>
        <ModalFooter>
          <button className="btn btn-secondary" onClick={() => setPending(null)} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={confirm} disabled={submitting}>
            {submitting ? 'Working…' : 'Confirm'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
