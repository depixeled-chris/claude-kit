// The top nav: the brand links home to the waiting board; the project list (from /api/projects)
// gives a direct route to each project's kanban, with the review count surfaced as a badge so the
// projects with work parked for the maintainer stand out. Tabs show the editable display title
// (KIT-T137), not the id prefix, and refetch on the projects-changed event so a settings save
// shows without a reload. Nav is best-effort (a fetch failure just hides the project links).

import { useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { getProjects, PROJECTS_CHANGED_EVENT } from '../services/api';
import { useAsync } from '../lib/useAsync';
import './Nav.css';

export function Nav() {
  const { data, reload } = useAsync(getProjects, []);
  const projects = data ?? [];

  useEffect(() => {
    window.addEventListener(PROJECTS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, reload);
  }, [reload]);

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-brand">claude-kit</Link>
        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Waiting
          </NavLink>
          <NavLink to="/all" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            All
          </NavLink>
          {projects.map((p) => (
            <NavLink
              key={p.key}
              to={`/p/${p.key}`}
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              title={`${p.key} — ${p.openCount} open`}
            >
              {p.displayName || p.key}
              {p.reviewCount > 0 && <span className="nav-review-count">{p.reviewCount}</span>}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
