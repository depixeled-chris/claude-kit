// The Mentions base tab (KIT-T146): a cross-project "what's addressed to me" view sitting beside
// Waiting/All, carrying a live unread-count badge. Self-contained — it owns its own count fetch so
// the tab strip stays declarative.

import { NavLink } from 'react-router-dom';
import { useUnreadMentions } from './useUnreadMentions';

export function MentionsTab() {
  const unread = useUnreadMentions();
  return (
    <NavLink to="/mentions" className={({ isActive }) => (isActive ? 'tab tab--base active' : 'tab tab--base')}>
      Mentions
      {unread > 0 && <span className="tab-badge" aria-label={`${unread} unread`}>{unread}</span>}
    </NavLink>
  );
}
