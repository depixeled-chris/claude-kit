// One collapsible project swimlane on the /all view: a tinted heading (full name + key + open/review
// counts) over that project's KanbanBoard. Each section owns its ticket fetch so a slow project never
// blocks the rest of the page, and defers the fetch until first expand — the body mounts on the first
// open and then stays mounted (hidden while collapsed) so re-expanding is instant, no refetch. Collapse
// state is remembered per project in localStorage; the default is collapsed for every section
// (KIT-T139, amending KIT-T144's review-expanded default) — the stored toggle wins thereafter.

import { useCallback, useState } from 'react';
import { getTickets } from '../services/api';
import { useAsync } from '../lib/useAsync';
import type { ProjectSummary } from '../types';
import { KanbanBoard } from './KanbanBoard';
import { Loading, ErrorState } from './AsyncState';
import './ProjectSection.css';

const COLLAPSE_PREFIX = 'ck.all.collapsed.';

function readCollapsed(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(COLLAPSE_PREFIX + key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback; // storage blocked (private mode) — fall back to the default, never throw
  }
}

function writeCollapsed(key: string, collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSE_PREFIX + key, collapsed ? '1' : '0');
  } catch {
    // storage unavailable (quota / private mode) — collapse just won't persist this session
  }
}

export function ProjectSection({ project }: { project: ProjectSummary }) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(project.key, true));
  const [mounted, setMounted] = useState(() => !readCollapsed(project.key, true));

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      writeCollapsed(project.key, next);
      if (!next) setMounted(true); // first expand mounts the body; it then stays mounted
      return next;
    });
  };

  return (
    <section className={`project-section${collapsed ? ' is-collapsed' : ''}`}>
      <button className="project-section-head" onClick={toggle} aria-expanded={!collapsed}>
        <span className="project-section-caret" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
        <span className="project-section-title">
          <span className="project-section-name">{project.name}</span>
          <span className="project-section-key">({project.key})</span>
        </span>
        <span className="project-section-counts">
          <span className="project-section-open">{project.openCount} open</span>
          {project.reviewCount > 0 && (
            <span className="project-section-review">{project.reviewCount} review</span>
          )}
        </span>
      </button>
      {mounted && (
        <div className="project-section-body" hidden={collapsed}>
          <ProjectSectionBody projectKey={project.key} />
        </div>
      )}
    </section>
  );
}

function ProjectSectionBody({ projectKey }: { projectKey: string }) {
  const fetchTickets = useCallback(() => getTickets(projectKey), [projectKey]);
  const { data, loading, error, reload } = useAsync(fetchTickets, [projectKey]);

  if (loading) return <Loading label={`Loading ${projectKey}…`} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return <KanbanBoard tickets={data ?? []} projectKey={projectKey} />;
}
