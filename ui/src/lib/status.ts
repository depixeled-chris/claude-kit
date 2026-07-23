// The status model for the board + detail controls. The kit flow is todo → doing → review → done
// (config.yml statuses.flow). The API is the enforcement point for per-project human_only/uat
// config: the UI offers the flow transitions and the server's guards (403 human_only, 422 evidence
// floor) decide what actually lands — surfaced inline. `transitionsFor` is the honest set of moves
// to offer from a given status; on `review`, the forward move (accept/close → done) is primary.

export const STATUS_FLOW = ['todo', 'doing', 'review', 'done'] as const;
export type FlowStatus = (typeof STATUS_FLOW)[number];

export const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  doing: 'Doing',
  review: 'Review',
  done: 'Done',
};

export interface Transition {
  to: string;
  label: string;
  primary: boolean;
}

// The moves offered from each status. On review, → done is the prominent accept/close; the
// backward move is a secondary "send back". Unknown/off-board statuses offer no transitions.
const TRANSITIONS: Record<string, Transition[]> = {
  todo: [{ to: 'doing', label: 'Start', primary: true }],
  doing: [
    { to: 'review', label: 'Submit for review', primary: true },
    { to: 'todo', label: 'Back to To Do', primary: false },
  ],
  review: [
    { to: 'done', label: 'Accept & close', primary: true },
    { to: 'doing', label: 'Send back', primary: false },
  ],
  done: [{ to: 'doing', label: 'Reopen', primary: false }],
};

export function transitionsFor(status: string): Transition[] {
  return TRANSITIONS[status] ?? [];
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
