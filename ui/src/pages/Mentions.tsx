// /mentions (KIT-T146): the cross-project @mention inbox for the resolved user. Grouped by project
// (groups with unread work first), unread mentions above read ones, each linking through to its
// ticket detail anchored at the comment. Per-mention ack + mark-all-read write durable receipts via
// the API, then re-fetch (and announce, so the nav badge updates) — a settled mention drops out of
// the unread count and sinks below the still-unread ones.

import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMentions, ackMention, ackAllMentions, announceMentionsChanged } from '../services/api';
import { useAsync } from '../lib/useAsync';
import { Loading, ErrorState } from '../components/AsyncState';
import type { Mention } from '../types';
import './Mentions.css';

interface Group {
  key: string;
  name: string;
  items: Mention[];
  unread: number;
}

// Bucket the (already unread-first, newest-first) mentions by project, preserving that order within
// each group; groups with unread work sort ahead, then alphabetically by name.
function groupByProject(mentions: Mention[]): Group[] {
  const map = new Map<string, Group>();
  for (const m of mentions) {
    let g = map.get(m.projectKey);
    if (!g) { g = { key: m.projectKey, name: m.projectName, items: [], unread: 0 }; map.set(m.projectKey, g); }
    g.items.push(m);
    if (m.unread) g.unread += 1;
  }
  return [...map.values()].sort((a, b) =>
    (b.unread > 0 ? 1 : 0) - (a.unread > 0 ? 1 : 0) || a.name.localeCompare(b.name));
}

export default function Mentions() {
  const { data, loading, error, reload } = useAsync(getMentions, []);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const settle = useCallback(() => { announceMentionsChanged(); reload(); }, [reload]);

  const ackOne = useCallback(async (m: Mention) => {
    setBusy((s) => new Set(s).add(m.ref));
    try {
      await ackMention({ projectKey: m.projectKey, ref: m.ref });
      settle();
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(m.ref); return n; });
    }
  }, [settle]);

  const [ackingAll, setAckingAll] = useState(false);
  const ackAll = useCallback(async () => {
    setAckingAll(true);
    try { await ackAllMentions(); settle(); } finally { setAckingAll(false); }
  }, [settle]);

  if (loading) return <Loading label="Loading mentions…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <ErrorState message="No mentions data" />;

  const groups = groupByProject(data.mentions);

  return (
    <div className="mentions-page">
      <header className="mentions-header">
        <div>
          <h1>Mentions</h1>
          <p className="muted">
            @{data.agent} · {data.unreadCount} unread of {data.mentions.length}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={ackAll}
          disabled={ackingAll || data.unreadCount === 0}
        >
          {ackingAll ? 'Marking…' : 'Mark all read'}
        </button>
      </header>

      {groups.length === 0 && <p className="muted mentions-empty">No @mentions across your projects.</p>}

      {groups.map((g) => (
        <section key={g.key} className="mentions-group">
          <h2 className="mentions-group-head">
            <span className="mentions-group-name">{g.name}</span>
            <span className="mentions-group-key">{g.key}</span>
            {g.unread > 0 && <span className="mentions-group-badge">{g.unread}</span>}
          </h2>
          <ul className="mentions-list">
            {g.items.map((m) => (
              <li key={m.ref} className={m.unread ? 'mention-card unread' : 'mention-card'}>
                <Link className="mention-main" to={`/p/${m.projectKey}/t/${m.id}#comment-${m.ordinal}`}>
                  <div className="mention-meta">
                    <span className="mention-id">{m.id}</span>
                    <span className="mention-author">@{m.author}</span>
                    <span className="mention-time">{m.ts}</span>
                    {m.unread && <span className="mention-unread-dot" aria-label="unread" />}
                  </div>
                  <div className="mention-excerpt">{m.excerpt}</div>
                </Link>
                {m.unread && (
                  m.writable ? (
                    <button
                      className="btn btn-secondary mention-ack"
                      onClick={() => ackOne(m)}
                      disabled={busy.has(m.ref)}
                    >
                      {busy.has(m.ref) ? 'Acking…' : 'Mark read'}
                    </button>
                  ) : (
                    <span className="mention-ack muted" title="No local repo on this host">read-only</span>
                  )
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
