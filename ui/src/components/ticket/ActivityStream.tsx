// The time-merged activity stream: a switch over entry kinds (the workflow renderer shape,
// TaskDetail.tsx:80-189) rendering the merge of History events and durable comments oldest-first.
// Comments show author + @mention highlights; an unread mention (mentionsAgent && !acked) gets a
// visible marker so the acting agent sees what is addressed to them.

import type { TicketComment } from '../../types';
import type { ActivityEntry } from '../../lib/activity';
import './ActivityStream.css';

const MENTION_SPLIT = /(@[\w-]+)/g;
const IS_MENTION = /^@[\w-]+$/; // non-global: a stateless per-part test (no lastIndex surprises)

// Split comment text so each @handle renders as a highlighted span (the ones addressed at the
// viewing agent are already surfaced via the unread marker on the whole comment).
function renderText(text: string) {
  return text.split(MENTION_SPLIT).map((part, i) =>
    IS_MENTION.test(part)
      ? <span key={i} className="mention">{part}</span>
      : <span key={i}>{part}</span>,
  );
}

function CommentEntry({ c }: { c: TicketComment }) {
  return (
    <div id={`comment-${c.ordinal}`} className={c.unread ? 'activity-item activity-comment unread' : 'activity-item activity-comment'}>
      <div className="activity-head">
        <span className="activity-kind">comment</span>
        <span className="activity-author">{c.author}</span>
        {c.unread && <span className="unread-badge">unread @mention</span>}
        <span className="activity-time">{c.ts}</span>
      </div>
      <div className="activity-body">{renderText(c.text)}</div>
    </div>
  );
}

function HistoryEntry({ event, detail, ts }: { event: string; detail: string; ts: string }) {
  return (
    <div className={`activity-item activity-history event-${event}`}>
      <div className="activity-head">
        <span className="activity-kind">{event}</span>
        <span className="activity-time">{ts}</span>
      </div>
      {detail && <div className="activity-body">{detail}</div>}
    </div>
  );
}

export function ActivityStream({ entries }: { entries: ActivityEntry[] }) {
  if (!entries.length) return <p className="muted">No activity yet.</p>;
  return (
    <div className="activity-stream">
      {entries.map((e, i) =>
        e.kind === 'comment'
          ? <CommentEntry key={`c-${e.comment.ref}`} c={e.comment} />
          : <HistoryEntry key={`h-${i}`} event={e.event} detail={e.detail} ts={e.ts} />,
      )}
    </div>
  );
}
