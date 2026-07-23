// The project-selector dropdown (KIT-T149): jump to any project's board. Replaces the growing row of
// per-project link chips — every project is one click away, each showing its display name, its id
// key, and its review-count badge. The trigger badge sums pending review across all projects.

import { Link } from 'react-router-dom';
import type { ProjectSummary } from '../../types';
import { Dropdown } from './Dropdown';

interface Props {
  projects: ProjectSummary[];
}

export function ProjectSelector({ projects }: Props) {
  const totalReview = projects.reduce((n, p) => n + (p.reviewCount || 0), 0);
  return (
    <Dropdown label="Projects" ariaLabel="Jump to a project" badge={totalReview}>
      {(close) => (
        <ul className="menu-list">
          {projects.length === 0 && <li className="menu-empty">No projects</li>}
          {projects.map((p) => (
            <li key={p.key}>
              <Link to={`/p/${p.key}`} className="menu-item" role="menuitem" onClick={close}>
                <span className="menu-item-name">{p.displayName || p.key}</span>
                <span className="menu-item-key">{p.key}</span>
                {p.reviewCount > 0 && <span className="menu-item-badge" title={`${p.reviewCount} in review`}>{p.reviewCount}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Dropdown>
  );
}
