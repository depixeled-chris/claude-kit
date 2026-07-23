// Time formatters. `relativeTime` is lifted from the workflow client (TaskBoard.tsx:55-67): a
// coarse "Nm/Nh/Nd ago" for board cards. Ticket History + comment timestamps are the store's
// `YYYY-MM-DD HH:MM` local strings — `parseStamp` reads them without a timezone surprise, and
// `sortKey` gives a mergeable ordering key for the activity stream.

const MS_PER_MIN = 60000;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;
const MINS_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;

export function relativeTime(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / MS_PER_MIN);
  const hours = Math.floor(diffMs / MS_PER_HOUR);
  const days = Math.floor(diffMs / MS_PER_DAY);
  if (mins < MINS_PER_HOUR) return `${Math.max(mins, 0)}m ago`;
  if (hours < HOURS_PER_DAY) return `${hours}h ago`;
  if (days < DAYS_PER_WEEK) return `${days}d ago`;
  return date.toLocaleDateString();
}

// The store stamps events as `YYYY-MM-DD HH:MM` (local). Reading it as ISO-with-space keeps it in
// local time; the returned string is a stable, lexically-sortable merge key across events + comments.
export function sortKey(stamp: string): string {
  return String(stamp || '').trim();
}
