// The API DTOs, written BY HAND from the real KIT-T131 server services (never generated, never
// lifted from the workflow client's types — that file had a snake_case/camelCase mismatch bug).
// Every field here mirrors a `server/services/*.mjs` shape verbatim: camelCase end to end.

// GET /api/me — the resolved viewer identity (routes/me.mjs). `alias` is the human's configurable
// handle (KIT_USER / registry `user` / 'user'); the UI derives every author/agent/viewer from it.
export interface Me {
  alias: string;
}

// GET /api/projects — one row per adopted project (services/projects.mjs projectSummaries).
export interface ProjectSummary {
  key: string;
  name: string;
  displayName: string; // human tab title (KIT-T137); server defaults it to the key
  openCount: number;
  reviewCount: number;
}

// PATCH /api/projects/:key response (services/writes.mjs setProjectDisplayName).
export interface ProjectPatchResult {
  key: string;
  displayName: string;
}

// GET /api/projects/:key/tickets — board rows (services/projects.mjs ticketListItem).
export interface TicketListItem {
  id: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  milestone: string | null;
}

// GET /api/projects/:key/{questions,decisions,inbox,notes} (services/projects.mjs storeItem).
export interface StoreItem {
  id: string;
  type: string;
  status: string;
  title: string;
}

// One acceptance-criterion checkbox, read-only checked state (ticket-parse.mjs parseAcceptance).
export interface AcceptanceCriterion {
  text: string;
  checked: boolean;
}

// A frontmatter link edge (ticket-detail.mjs mapLinks: { rel, to }).
export interface TicketLink {
  rel: string;
  to: string;
}

// A structured History event line (ticket-detail.mjs: { ts, event, detail }).
export interface HistoryEvent {
  ts: string;
  event: string;
  detail: string;
}

// A durable comment with @mention + per-agent unread state (ticket-detail.mjs mapComments).
export interface TicketComment {
  ref: string;
  ordinal: number;
  ts: string;
  author: string;
  text: string;
  mentions: string[];
  mentionsAgent: boolean;
  unread: boolean;
}

// GET /api/projects/:key/tickets/:id — the full detail DTO (ticket-detail.mjs buildTicketDetail).
export interface TicketDetail {
  id: string;
  scope: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  milestone: string | null;
  parent: string | null;
  archived: boolean;
  links: TicketLink[];
  description: string;
  acceptanceCriteria: AcceptanceCriterion[];
  notes: string;
  history: HistoryEvent[];
  comments: TicketComment[];
}

// A single WAITING-ON-YOU item (services/waiting.mjs). `id`/`title` present on review items.
export type WaitingKind = 'review' | 'question' | 'needs';
export interface WaitingItem {
  kind: WaitingKind;
  id?: string;
  title?: string;
  text: string;
}

// GET /api/waiting — one group per project with waiting items (services/waiting.mjs waitingBoard).
export interface WaitingGroup {
  project: string;
  active: boolean;
  items: WaitingItem[];
}

// POST /api/projects/:key/tickets/:id/comments response (services/writes.mjs postComment).
export interface CommentResult {
  id: string;
  ref: string;
  ordinal: number;
  mentions: string[];
  spilled: boolean;
}

// POST /api/projects/:key/tickets/:id/status response (services/writes.mjs setTicketStatus).
export interface StatusResult {
  id: string;
  from: string;
  to: string;
  archived: boolean;
  warnings: string[];
}

// One cross-project @mention of the resolved user (services/mentions.mjs collectMentions).
export interface Mention {
  projectKey: string;
  projectName: string;
  writable: boolean;
  id: string;        // the ticket id the comment lives on
  ref: string;       // store-wide comment ref, <id>#<ordinal>
  ordinal: number;   // comment ordinal within the ticket (the #comment-<n> anchor)
  author: string;
  ts: string;
  excerpt: string;
  unread: boolean;
}

// GET /api/mentions — the inbox payload (services/mentions.mjs collectMentions).
export interface MentionsResponse {
  agent: string;
  unreadCount: number;
  mentions: Mention[];
}

// POST /api/mentions/ack response (services/mentions.mjs ackMention).
export interface AckResult {
  projectKey: string;
  ref: string;
  agent: string;
  already: boolean;
}

// POST /api/mentions/ack-all response (services/mentions.mjs ackAllMentions).
export interface AckAllResult {
  agent: string;
  acked: number;
  skipped: number;
}
