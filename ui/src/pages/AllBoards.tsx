// The /all view (KIT-T144): every adopted project stacked as a collapsible swimlane board, so the
// whole portfolio is scannable on one page without hopping /p/:key routes. The project list loads
// once; each ProjectSection then fetches its own tickets independently (a slow project never blocks
// the rest) and remembers its collapse state per project in localStorage.

import { getProjects } from '../services/api';
import { useAsync } from '../lib/useAsync';
import { ProjectSection } from '../components/ProjectSection';
import { Loading, ErrorState } from '../components/AsyncState';
import './AllBoards.css';

export default function AllBoards() {
  const { data, loading, error, reload } = useAsync(getProjects, []);

  if (loading) return <Loading label="Loading all boards…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const projects = data ?? [];
  const totalOpen = projects.reduce((n, p) => n + p.openCount, 0);
  const totalReview = projects.reduce((n, p) => n + p.reviewCount, 0);

  return (
    <div className="all-boards">
      <header className="page-header">
        <h1>All boards</h1>
        <p className="page-sub">
          {projects.length} project{projects.length === 1 ? '' : 's'} · {totalOpen} open · {totalReview} in review
        </p>
      </header>

      {projects.length === 0 ? (
        <div className="empty-state">No projects adopted yet.</div>
      ) : (
        <div className="all-boards-stack">
          {projects.map((p) => <ProjectSection key={p.key} project={p} />)}
        </div>
      )}
    </div>
  );
}
