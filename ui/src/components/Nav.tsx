// The top nav: the brand links home to the waiting board; the project list (from /api/projects)
// gives a direct route to each project's kanban, with the review count surfaced as a badge so the
// projects with work parked for the maintainer stand out. Fetched once at mount; nav is best-effort
// (a fetch failure just hides the project links, never blocks the app).

import { NavLink, Link } from 'react-router-dom';
import { getProjects } from '../services/api';
import { useAsync } from '../lib/useAsync';
import './Nav.css';

export function Nav() {
  const { data } = useAsync(getProjects, []);
  const projects = data ?? [];

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
              title={`${p.openCount} open`}
            >
              {p.key}
              {p.reviewCount > 0 && <span className="nav-review-count">{p.reviewCount}</span>}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
