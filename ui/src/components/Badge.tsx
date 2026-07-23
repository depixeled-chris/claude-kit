// Small pill badges for a ticket's frontmatter facets: status, priority, and type. Each maps to a
// modifier class so the palette lives in Badge.css (one place), not inline styles.

import './Badge.css';

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-status status-${status}`}>{status}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  if (!priority) return null;
  return <span className={`badge badge-priority priority-${priority}`}>{priority}</span>;
}

export function TypeBadge({ type }: { type: string }) {
  if (!type) return null;
  return <span className={`badge badge-type`}>{type}</span>;
}
