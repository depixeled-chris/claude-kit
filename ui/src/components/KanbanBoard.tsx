// The kanban column grid (todo/doing/review/done) over one project's tickets, extracted from
// ProjectBoard so both the /p/:key page and the stacked /all view render the identical column
// markup. Cards link into ticket detail; `columns` narrows to a single status when a filter is
// active (the page owns the filter UI), otherwise the full flow is shown.

import { Link } from 'react-router-dom';
import { STATUS_FLOW, statusLabel } from '../lib/status';
import type { TicketListItem } from '../types';
import { PriorityBadge, TypeBadge } from './Badge';
import './KanbanBoard.css';

interface KanbanBoardProps {
  tickets: TicketListItem[];
  projectKey: string;
  columns?: string[];
}

export function KanbanBoard({ tickets, projectKey, columns = [...STATUS_FLOW] }: KanbanBoardProps) {
  const byStatus = (s: string) => tickets.filter((t) => t.status === s);

  return (
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
                : col.map((t) => <Card key={t.id} ticket={t} projectKey={projectKey} />)}
            </div>
          </div>
        );
      })}
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
