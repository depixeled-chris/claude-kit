// The landing page: WAITING ON YOU — the cross-project review board from /api/waiting, the
// clickable form of /prime. Groups by project; each review item links into ticket detail (its key
// derived from the id). This is the maintainer's daily view — what across every project needs them.

import { Link } from 'react-router-dom';
import { getWaiting } from '../services/api';
import { useAsync } from '../lib/useAsync';
import { keyFromId } from '../lib/ids';
import type { WaitingItem } from '../types';
import { Loading, ErrorState } from '../components/AsyncState';
import './WaitingBoard.css';

function Item({ item }: { item: WaitingItem }) {
  if (item.kind === 'review' && item.id) {
    return (
      <Link className="waiting-item review" to={`/p/${keyFromId(item.id)}/t/${item.id}`}>
        <span className="waiting-kind">review</span>
        <span className="waiting-id">{item.id}</span>
        <span className="waiting-text">{item.title ?? item.text}</span>
      </Link>
    );
  }
  return (
    <div className={`waiting-item ${item.kind}`}>
      <span className="waiting-kind">{item.kind}</span>
      <span className="waiting-text">{item.text}</span>
    </div>
  );
}

export default function WaitingBoard() {
  const { data, loading, error, reload } = useAsync(getWaiting, []);

  if (loading) return <Loading label="Loading the review board…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const groups = data ?? [];
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="waiting-board">
      <header className="page-header">
        <h1>Waiting on you</h1>
        <p className="page-sub">{total} item{total === 1 ? '' : 's'} across {groups.length} project{groups.length === 1 ? '' : 's'}</p>
      </header>

      {groups.length === 0 ? (
        <div className="empty-state">Nothing is waiting on you. Inbox zero across every project.</div>
      ) : (
        <div className="waiting-groups">
          {groups.map((g) => (
            <section key={g.project} className="waiting-group">
              <h2 className="waiting-group-head">
                <Link to={`/p/${g.items.find((i) => i.id) ? keyFromId(g.items.find((i) => i.id)!.id!) : g.project}`}>
                  {g.project}
                </Link>
                {g.active && <span className="active-dot" title="active project">active</span>}
                <span className="group-count">{g.items.length}</span>
              </h2>
              <div className="waiting-list">
                {g.items.map((item, i) => <Item key={i} item={item} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
