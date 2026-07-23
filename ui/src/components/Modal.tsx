// Generic portal modal — lifted as-is from the workflow client (components/modals/Modal.tsx):
// Esc to close, click-outside to close, three size variants, rendered through a portal on
// document.body. ModalHeader / ModalContent / ModalFooter are the composable slots.

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: 'small' | 'medium' | 'large';
}

export function Modal({ isOpen, onClose, children, size = 'medium' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && e.target === modalRef.current) onClose();
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" ref={modalRef}>
      <div className={`modal-container modal-${size}`}>{children}</div>
    </div>,
    document.body,
  );
}

export function ModalHeader({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="modal-header">
      <h2>{children}</h2>
      {onClose && (
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">×</button>
      )}
    </div>
  );
}

export function ModalContent({ children }: { children: ReactNode }) {
  return <div className="modal-content">{children}</div>;
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="modal-footer">{children}</div>;
}
