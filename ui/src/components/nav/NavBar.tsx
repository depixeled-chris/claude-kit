// The app nav (KIT-T149) — replaces the flat link bar. A PRIMARY row (brand + the pinnable TabBar)
// over a SECONDARY row (project selector + settings dropdowns). Projects are fetched once and shared
// by both rows; a PROJECTS_CHANGED_EVENT (e.g. a display-name save, KIT-T137) triggers a refetch so
// tab labels and badges update without a reload. Best-effort — a failed fetch just yields no project
// tabs, never blocks the app.

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProjects, PROJECTS_CHANGED_EVENT } from '../../services/api';
import { useAsync } from '../../lib/useAsync';
import { useTabs } from './useTabs';
import { TabBar } from './TabBar';
import { SecondaryNav } from './SecondaryNav';
import './NavBar.css';

export function NavBar() {
  const { data, reload } = useAsync(getProjects, []);
  const projects = data ?? [];

  useEffect(() => {
    window.addEventListener(PROJECTS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(PROJECTS_CHANGED_EVENT, reload);
  }, [reload]);

  const { projectTabs, togglePin } = useTabs(projects);

  return (
    <header className="navbar">
      <div className="navbar-primary">
        <Link to="/" className="navbar-brand">claude-kit</Link>
        <TabBar projectTabs={projectTabs} onTogglePin={togglePin} />
      </div>
      <SecondaryNav projects={projects} />
    </header>
  );
}
