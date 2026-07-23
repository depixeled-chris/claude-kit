// Ticket detail (/p/:key/t/:id): title + frontmatter badges, description, the read-only AC
// checklist, the time-merged activity stream (History + comments, unread @mentions marked), the
// comment form, and the status controls. Fetched as the resolved viewer identity (/api/me) so
// unread-mention state is computed for them. A comment or status write re-fetches, so the durable
// change shows immediately. Each block is its own component — this file just orchestrates + lays out.

import { useCallback, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { getTicket } from '../services/api';
import { useAsync } from '../lib/useAsync';
import { useIdentity } from '../lib/identity';
import { mergeActivity } from '../lib/activity';
import { StatusBadge, PriorityBadge, TypeBadge } from '../components/Badge';
import { Loading, ErrorState } from '../components/AsyncState';
import { AcceptanceList } from '../components/ticket/AcceptanceList';
import { ActivityStream } from '../components/ticket/ActivityStream';
import { CommentForm } from '../components/ticket/CommentForm';
import { StatusControls } from '../components/ticket/StatusControls';
import './TicketDetail.css';

export default function TicketDetail() {
  const { key = '', id = '' } = useParams<{ key: string; id: string }>();
  const { hash } = useLocation();
  const { alias: viewer } = useIdentity(); // the viewer whose unread @mentions are computed

  const fetchDetail = useCallback(() => getTicket(key, id, viewer), [key, id, viewer]);
  const { data, loading, error, reload } = useAsync(fetchDetail, [key, id, viewer]);

  // A mention click-through (/…#comment-<n>, KIT-T146) scrolls to that comment once it renders,
  // with a brief flash so the anchored comment is unmistakable.
  useEffect(() => {
    if (!data || !hash) return;
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('anchor-flash');
    const t = window.setTimeout(() => el.classList.remove('anchor-flash'), 1600);
    return () => window.clearTimeout(t);
  }, [data, hash]);

  if (loading) return <Loading label={`Loading ${id}…`} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <ErrorState message="Ticket not found" />;

  const activity = mergeActivity(data.history, data.comments);

  return (
    <div className="ticket-detail">
      <nav className="crumbs">
        <Link to="/">Waiting</Link>
        <span>›</span>
        <Link to={`/p/${key}`}>{key}</Link>
        <span>›</span>
        <span className="crumb-current">{id}</span>
      </nav>

      <header className="detail-header">
        <div className="detail-badges">
          <StatusBadge status={data.status} />
          <PriorityBadge priority={data.priority} />
          <TypeBadge type={data.type} />
          {data.milestone && <span className="detail-milestone">{data.milestone}</span>}
        </div>
        <h1>{data.title}</h1>
        <div className="detail-id">{data.id}</div>
      </header>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="detail-section">
            <h2>Description</h2>
            <div className="prose">{data.description || <span className="muted">No description.</span>}</div>
          </section>

          <section className="detail-section">
            <h2>Acceptance criteria</h2>
            <AcceptanceList items={data.acceptanceCriteria} />
          </section>

          <section className="detail-section">
            <h2>Activity</h2>
            <ActivityStream entries={activity} />
            <CommentForm projectKey={key} ticketId={id} onPosted={reload} />
          </section>
        </div>

        <aside className="detail-side">
          <section className="detail-section">
            <StatusControls projectKey={key} ticketId={id} status={data.status} onChanged={reload} />
          </section>

          {data.links.length > 0 && (
            <section className="detail-section">
              <h2>Links</h2>
              <ul className="link-list">
                {data.links.map((l, i) => (
                  <li key={i}>
                    <span className="link-rel">{l.rel}</span>
                    <Link to={`/p/${key}/t/${l.to}`}>{l.to}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.notes && (
            <section className="detail-section">
              <h2>Notes</h2>
              <div className="prose notes">{data.notes}</div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
