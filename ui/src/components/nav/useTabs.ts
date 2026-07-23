// The tab model behind the primary nav (KIT-T149). The open project tabs are DERIVED, never stored
// as a list: pinned keys (localStorage) are always shown; the current project route is materialized
// as a transient tab so a deep link (/p/:key or /p/:key/t/:id) gets its own tab. An unpinned tab
// therefore "closes" simply by no longer being the active route. Labels/badges come from the live
// /api/projects data, so a renamed project or a changed review count updates without extra plumbing.

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { ProjectSummary } from '../../types';
import { loadPinned, savePinned } from './pinnedStore';

export interface ProjectTab {
  key: string;
  path: string;
  label: string;
  reviewCount: number;
  pinned: boolean;
  active: boolean;
}

const PROJECT_ROUTE = /^\/p\/([^/]+)/;

// The project key a path belongs to (board, settings, or a ticket detail all map to their project),
// or null for the cross-project routes (/, /all, /mentions).
export function projectKeyFromPath(pathname: string): string | null {
  const m = pathname.match(PROJECT_ROUTE);
  return m ? decodeURIComponent(m[1]) : null;
}

export function useTabs(projects: ProjectSummary[]) {
  const { pathname } = useLocation();
  const [pinned, setPinned] = useState<string[]>(loadPinned);
  useEffect(() => { savePinned(pinned); }, [pinned]);

  const activeKey = projectKeyFromPath(pathname);

  // Shown keys: every pinned project, plus the current route's project (once) so it materializes.
  const keys = [...pinned];
  if (activeKey && !keys.includes(activeKey)) keys.push(activeKey);

  const byKey = new Map(projects.map((p) => [p.key, p]));
  const projectTabs: ProjectTab[] = keys.map((key) => {
    const p = byKey.get(key);
    return {
      key,
      path: `/p/${key}`,
      label: p?.displayName || key,
      reviewCount: p?.reviewCount ?? 0,
      pinned: pinned.includes(key),
      active: key === activeKey,
    };
  });

  const togglePin = (key: string) =>
    setPinned((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return { projectTabs, activeKey, togglePin };
}
