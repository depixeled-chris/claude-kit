// The primary nav: a tab row. The two cross-project views (Waiting, All) are fixed base tabs; each
// project board is a tab that can be pinned (kept across sessions) or left transient (closes when you
// navigate away). The active tab reflects the current route. Pinning is a per-tab toggle; the review
// count rides as a badge so a project with work parked for the maintainer stands out (KIT-T149).

import { NavLink, Link } from 'react-router-dom';
import type { ProjectTab } from './useTabs';
import './TabBar.css';

interface Props {
  projectTabs: ProjectTab[];
  onTogglePin: (key: string) => void;
}

const baseClass = (isActive: boolean) => (isActive ? 'tab tab--base active' : 'tab tab--base');

export function TabBar({ projectTabs, onTogglePin }: Props) {
  return (
    <div className="tabbar" role="tablist" aria-label="Open views">
      <NavLink to="/" end className={({ isActive }) => baseClass(isActive)}>Waiting</NavLink>
      <NavLink to="/all" className={({ isActive }) => baseClass(isActive)}>All</NavLink>

      {projectTabs.map((t) => (
        <span
          key={t.key}
          className={`tab tab--project${t.active ? ' active' : ''}${t.pinned ? ' pinned' : ' transient'}`}
        >
          <Link to={t.path} className="tab-link" role="tab" aria-selected={t.active} title={t.key}>
            <span className="tab-label">{t.label}</span>
            {t.reviewCount > 0 && <span className="tab-badge">{t.reviewCount}</span>}
          </Link>
          <button
            type="button"
            className="tab-pin"
            aria-label={t.pinned ? `Unpin ${t.label}` : `Pin ${t.label}`}
            aria-pressed={t.pinned}
            title={t.pinned ? 'Pinned — click to unpin' : 'Pin this tab (keeps it across sessions)'}
            onClick={() => onTogglePin(t.key)}
          >
            📌
          </button>
        </span>
      ))}
    </div>
  );
}
