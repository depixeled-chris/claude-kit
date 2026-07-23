// A reusable dropdown shell for the secondary nav (KIT-T149). Owns the open/close behavior every
// menu needs: a trigger button (aria-haspopup/expanded), Escape closes AND returns focus to the
// trigger, a click outside closes, and the menu is exposed as role="menu". Content is a render-prop
// receiving `close` so an item (e.g. a project link) can dismiss the menu on activation.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import './Dropdown.css';

interface Props {
  label: ReactNode;
  ariaLabel: string;
  align?: 'left' | 'right';
  badge?: number;
  children: (close: () => void) => ReactNode;
}

export function Dropdown({ label, ariaLabel, align = 'left', badge, children }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
    };
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  return (
    <div className="dropdown" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className={`dropdown-trigger${open ? ' open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dropdown-label">{label}</span>
        {badge && badge > 0 ? <span className="dropdown-badge">{badge}</span> : null}
        <span className="dropdown-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <div className={`dropdown-menu dropdown-menu--${align}`} id={menuId} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
