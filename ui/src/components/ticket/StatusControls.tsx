// Status controls: a button per legal transition from the current status (lib/status). A FORWARD
// move confirms through the harvested Modal; a SEND-BACK (a backward move) instead reveals an inline
// reason box beneath the controls (KIT-T147) — the server rejects a backward transition without a
// comment (422), so the box's submit is disabled until non-empty and any guard 422 surfaces inline.
// The server is the guard authority — 403 (human_only), 422 (evidence floor / send-back), 409 (not
// writable) all come back typed and render INLINE rather than being swallowed.

import { useState } from 'react';
import { postStatus, ApiError } from '../../services/api';
import { useIdentity } from '../../lib/identity';
import { transitionsFor, statusLabel, isSendBack, type Transition } from '../../lib/status';
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../Modal';

interface Props {
  projectKey: string;
  ticketId: string;
  status: string;
  onChanged: () => void;
}

export function StatusControls({ projectKey, ticketId, status, onChanged }: Props) {
  const { alias } = useIdentity();
  const [pending, setPending] = useState<Transition | null>(null); // forward move → modal confirm
  const [sendBack, setSendBack] = useState<Transition | null>(null); // backward move → inline reason box
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [guard, setGuard] = useState<{ code: string; message: string } | null>(null);

  const transitions = transitionsFor(status);

  function surfaceGuard(err: unknown) {
    if (err instanceof ApiError) setGuard({ code: err.code, message: err.message });
    else setGuard({ code: 'error', message: 'status change failed' });
  }

  function choose(t: Transition) {
    setGuard(null);
    if (isSendBack(status, t.to)) { setPending(null); setReason(''); setSendBack(t); }
    else { setSendBack(null); setPending(t); }
  }

  async function confirmForward() {
    if (!pending) return;
    setSubmitting(true);
    setGuard(null);
    try {
      await postStatus(projectKey, ticketId, { status: pending.to, agent: alias });
      setPending(null);
      onChanged();
    } catch (err) {
      surfaceGuard(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSendBack(e: React.FormEvent) {
    e.preventDefault();
    if (!sendBack || !reason.trim()) return;
    setSubmitting(true);
    setGuard(null);
    try {
      await postStatus(projectKey, ticketId, { status: sendBack.to, agent: alias, comment: { text: reason.trim() } });
      setSendBack(null);
      setReason('');
      onChanged();
    } catch (err) {
      surfaceGuard(err);
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
              aria-expanded={sendBack?.to === t.to || undefined}
              onClick={() => choose(t)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {sendBack && (
        <form className="send-back-form" onSubmit={submitSendBack}>
          <label className="send-back-label" htmlFor="send-back-reason">
            Reason for “{sendBack.label}” → {statusLabel(sendBack.to)}
          </label>
          <textarea
            id="send-back-reason"
            className="input send-back-textarea"
            rows={3}
            autoFocus
            placeholder="What needs to change? The agent who submitted this gets @mentioned."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="send-back-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setSendBack(null); setReason(''); setGuard(null); }}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !reason.trim()}>
              {submitting ? 'Sending…' : sendBack.label}
            </button>
          </div>
        </form>
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
          <button className="btn btn-primary" onClick={confirmForward} disabled={submitting}>
            {submitting ? 'Working…' : 'Confirm'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
