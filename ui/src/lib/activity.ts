// Merge a ticket's History events and its comments into one time-ordered stream (the workflow
// activity-merge idea, TaskDetail.tsx:80-189, re-shaped for our DTOs). A durable comment writes
// BOTH a truncated `(comment)` History line AND the full comment; we render the rich comment and
// drop the History `comment` duplicate, so each comment appears exactly once. Everything else in
// History (created, status, fixed, blocker, …) merges in by timestamp, oldest first.

import type { HistoryEvent, TicketComment } from '../types';
import { sortKey } from './time';

export type ActivityEntry =
  | { kind: 'history'; ts: string; event: string; detail: string }
  | { kind: 'comment'; ts: string; comment: TicketComment };

export function mergeActivity(history: HistoryEvent[], comments: TicketComment[]): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  for (const h of history) {
    if (h.event === 'comment') continue; // the rich comment below is the same event, un-truncated
    entries.push({ kind: 'history', ts: h.ts, event: h.event, detail: h.detail });
  }
  for (const c of comments) {
    entries.push({ kind: 'comment', ts: c.ts, comment: c });
  }
  return entries.sort((a, b) => sortKey(a.ts).localeCompare(sortKey(b.ts)));
}
