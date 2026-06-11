#!/usr/bin/env node
// PostToolUse(Task) + SubagentStop — record every delegated subagent into the durable on-disk
// roster (.ai/agents.jsonl), so a /clear can never orphan delegated work (KIT-T014 / KIT-D015).
//
// This is the AUTOMATIC capture the ticket prefers: the orchestrator doesn't have to remember
// to log a delegation — the harness fires PostToolUse on the Task tool, and this appends a row
// THEN. SubagentStop appends the terminal row when the agent finishes, so orient's "In-flight
// agents" view collapses to the truth without a round-trip. (When the harness can't supply a
// signal — e.g. a fire-and-forget background handle it never reports back — the row simply stays
// in-flight and orient flags it as uncollected after the stale window: visible, never silent.)
//
// FAIL-OPEN on EVERYTHING (try/catch, exit 0). A durability hook must never wedge a session or
// block a delegation; the worst case is a missing/extra roster row the orchestrator reconciles.

import { gitRoot, adopted, payload, recordAgent, updateAgent } from './lib.mjs';

const TASK_LABEL_MAX = 140; // clip a pasted brief to a scannable one-liner in the roster

main().catch(() => process.exit(0));

async function main() {
  const p = await payload();
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);

  const event = p.hook_event_name || '';
  if (event === 'SubagentStop') {
    recordStop(root, p);
  } else {
    // PostToolUse(Task) (the default wiring) — a delegation just dispatched.
    recordDispatch(root, p);
  }
  process.exit(0);
}

// A delegation dispatched. The Task tool_input carries the brief; the exact key names aren't
// contractually frozen, so read defensively across the plausible shapes (description/prompt,
// subagent_type/agent type, run_in_background) rather than hard-coding one. The id we key on is
// whatever handle the response/input exposes (background runs return one); absent that we mint a
// time-based id so the row is still trackable + reconcilable.
function recordDispatch(root, p) {
  try {
    const inp = p.tool_input || {};
    const resp = p.tool_response || p.tool_result || {};
    const id = firstString(
      resp.agent_id, resp.agentId, resp.task_id, resp.taskId, resp.id,
      inp.agent_id, inp.task_id,
    ) || `agent-${Date.now().toString(36)}`;
    const task = clip(firstString(inp.description, inp.task, inp.title, inp.prompt) || '(no description)', TASK_LABEL_MAX);
    const scope = firstString(inp.subagent_type, inp.agent_type, inp.subagentType, inp.type) || 'general';
    const background = isBackground(inp);
    recordAgent(root, { id, status: 'in-flight', task, scope, background, source: 'posttooluse' });
  } catch {
    /* fail-open — a roster miss is reconciled by the orchestrator, never a wedged tool call */
  }
}

// A subagent finished. Append the terminal row keyed by agent_id so readAgents collapses the
// in-flight row to done. We do NOT store the full result text (the roster is an index, not a
// transcript — KIT-D024); just enough to know the work landed and can be collected.
function recordStop(root, p) {
  try {
    const id = firstString(p.agent_id, p.agentId, p.task_id, p.id);
    if (!id) return; // no handle to reconcile against — leave the in-flight row for the stale-age flag
    const scope = firstString(p.agent_type, p.agentType);
    updateAgent(root, id, { status: 'done', ...(scope ? { scope } : {}), source: 'subagentstop' });
  } catch {
    /* fail-open */
  }
}

function isBackground(inp) {
  for (const k of ['run_in_background', 'runInBackground', 'background']) {
    if (inp[k] === true || inp[k] === 'true') return true;
  }
  return false;
}

function firstString(...vals) {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function clip(s, n) {
  const one = String(s).replace(/\s+/g, ' ').trim();
  return one.length > n ? one.slice(0, n - 1) + '…' : one;
}
