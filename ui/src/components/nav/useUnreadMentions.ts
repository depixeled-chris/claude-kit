// The live unread-mention count behind the nav badge (KIT-T146). Fetches /api/mentions once, then
// refetches on the MENTIONS_CHANGED_EVENT (an ack from the /mentions page) and on window focus, so
// the badge stays current without a manual reload. Best-effort — a failed fetch reads as 0.

import { useEffect } from 'react';
import { getMentions, MENTIONS_CHANGED_EVENT } from '../../services/api';
import { useAsync } from '../../lib/useAsync';

export function useUnreadMentions(): number {
  const { data, reload } = useAsync(getMentions, []);
  useEffect(() => {
    window.addEventListener(MENTIONS_CHANGED_EVENT, reload);
    window.addEventListener('focus', reload);
    return () => {
      window.removeEventListener(MENTIONS_CHANGED_EVENT, reload);
      window.removeEventListener('focus', reload);
    };
  }, [reload]);
  return data?.unreadCount ?? 0;
}
