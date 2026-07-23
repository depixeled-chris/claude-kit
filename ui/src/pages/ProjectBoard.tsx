// Per-project kanban (/p/:key): the reusable KanbanBoard over /api/projects/:key/tickets, with a
// ?status= filter that narrows to one column. The page owns the header (title + filter); the column
// grid + cards are the shared component. Cards link into detail.

import { useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getTickets } from '../services/api';
import { useAsync } from '../lib/useAsync';
import { STATUS_FLOW, statusLabel } from '../lib/status';
import { KanbanBoard } from '../components/KanbanBoard';
import { Loading, ErrorState } from '../components/AsyncState';
import './ProjectBoard.css';

export default function ProjectBoard() {
  const { key = '' } = useParams<{ key: string }>();
  const [params, setParams] = useSearchParams();
  const statusFilter = params.get('status') ?? '';

  const fetchTickets = useCallback(() => getTickets(key, statusFilter || undefined), [key, statusFilter]);
  const { data, loading, error, reload } = useAsync(fetchTickets, [key, statusFilter]);

  if (loading) return <Loading label={`Loading ${key} board…`} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const tickets = data ?? [];
  const columns = statusFilter ? [statusFilter] : [...STATUS_FLOW];

  return (
    <div className="project-board">
      <header className="page-header board-header">
        <div>
          <h1>{key} board</h1>
          <p className="page-sub">{tickets.length} ticket{tickets.length === 1 ? '' : 's'}{statusFilter ? ` in ${statusLabel(statusFilter)}` : ''}</p>
        </div>
        <select
          className="input status-filter"
          value={statusFilter}
          onChange={(e) => {
            const v = e.target.value;
            setParams(v ? { status: v } : {});
          }}
        >
          <option value="">All statuses</option>
          {STATUS_FLOW.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </header>

      <KanbanBoard tickets={tickets} projectKey={key} columns={columns} />
    </div>
  );
}
