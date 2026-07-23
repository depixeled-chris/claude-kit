// Per-project kanban (/p/:key): columns in flow order (todo/doing/review/done) over
// /api/projects/:key/tickets, with a ?status= filter that narrows to one column and each card
// carrying priority + type badges. Column layout + the relative-time footer are the workflow
// TaskBoard harvest, re-shaped for our TicketListItem DTO. Cards link into detail.

import { useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { getTickets } from '../services/api';
import { useAsync } from '../lib/useAsync';
import { STATUS_FLOW, statusLabel } from '../lib/status';
import type { TicketListItem } from '../types';
import { PriorityBadge, TypeBadge } from '../components/Badge';
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
  const byStatus = (s: string) => tickets.filter((t) => t.status === s);

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

      <div className="board-columns">
        {columns.map((status) => {
          const col = byStatus(status);
          return (
            <div key={status} className={`board-column column-${status}`}>
              <div className="column-header">
                <h2>{statusLabel(status)}</h2>
                <span className="column-count">{col.length}</span>
              </div>
              <div className="column-content">
                {col.length === 0
                  ? <div className="empty-column">No tickets</div>
                  : col.map((t) => <Card key={t.id} ticket={t} projectKey={key} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({ ticket, projectKey }: { ticket: TicketListItem; projectKey: string }) {
  return (
    <Link className="ticket-card" to={`/p/${projectKey}/t/${ticket.id}`}>
      <div className="ticket-card-head">
        <span className="ticket-card-id">{ticket.id}</span>
        <div className="ticket-card-badges">
          <PriorityBadge priority={ticket.priority} />
          <TypeBadge type={ticket.type} />
        </div>
      </div>
      <h3 className="ticket-card-title">{ticket.title}</h3>
      {ticket.milestone && <span className="ticket-card-milestone">{ticket.milestone}</span>}
    </Link>
  );
}
