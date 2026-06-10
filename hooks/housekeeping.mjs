#!/usr/bin/env node
// SessionStart + Stop — weekly review nags, driven by file mtime (no state of
// their own). Informational, never blocks. Node port of session-start.sh +
// housekeeping-reminder.sh, merged: one "housekeeping reviews" concern, one file.
//
// The harness memory dir is ~/.claude/projects/<encoded-home>/memory, where the
// encoding replaces :, \, /, and spaces with '-'. Derived from $HOME so nothing
// machine-specific is hardcoded (this kit is public).

import { statSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { payload, MAINT_LOG, git, gitRoot, adopted, wipSummary, scanInbox, scanReviewQueue, readTurnState, writeTurnState } from './lib.mjs';

const REVIEW_DAYS = 7;
const MISSING_AGE = 999;
const MS_PER_DAY = 86400000;
const PROJECT_TAIL = 20;
// KIT-T054: "push at every task boundary" is contract; nag (never block) when local-only
// commits pile up at end of turn. Threshold > 1 so a single mid-task commit stays quiet.
const UNPUSHED_NAG = 3;
// KIT-T062 — closure nags. The intake side is loud; make the CLOSURE side just as loud.
const INBOX_STALE_DAYS = 2; // an inbox capture older than this is un-triaged debt
const REVIEW_LIST_MAX = 6; // list review tickets individually below this; else count + oldest

const claudeDir = join(homedir(), '.claude');
const encodedHome = homedir().replace(/[:\\/ ]/g, '-');
const memTs = join(claudeDir, 'projects', encodedHome, 'memory', '.last-reviewed');
const maintTs = join(claudeDir, '.maintenance-last-reviewed');

function daysSince(f) {
  try {
    return Math.floor((Date.now() - statSync(f).mtimeMs) / MS_PER_DAY);
  } catch {
    return MISSING_AGE;
  }
}

// Render the review queue: the FULL short list (ids) when small enough to be useful, else a
// count + oldest age so a large backlog stays one line. Keeps the SessionStart nag scannable.
function reviewQueueLine(rq) {
  if (rq.count <= REVIEW_LIST_MAX && rq.ids.length) {
    return `${rq.count} in review (${rq.ids.join(', ')})`;
  }
  return `${rq.count} in review, oldest ${rq.oldestDays}d`;
}

const memAge = daysSince(memTs);
const maintAge = daysSince(maintTs);
const p = await payload();
const isStop = p.hook_event_name === 'Stop';

if (isStop) {
  const msgs = [];
  if (memAge >= REVIEW_DAYS) msgs.push(`Memory review is still overdue (${memAge}d). Present the rundown before ending.`);
  if (maintAge >= REVIEW_DAYS) msgs.push(`Maintenance review is still overdue (${maintAge}d). Present the gaps summary before ending.`);
  try {
    const root = gitRoot();
    if (adopted(root)) {
      // remote-less repos have nothing to push to — every commit would count, all noise
      if (git(['-C', root, 'remote']).trim()) {
        const unpushed = wipSummary(root).unpushed.length;
        if (unpushed >= UNPUSHED_NAG) {
          msgs.push(`${unpushed} unpushed commit(s) on this repo — push at the task boundary (cross-machine rewind point).`);
        }
      }
      // KIT-T062: surface the review/UAT queue FREQUENTLY — at Stop, one line ONLY when it
      // GREW this turn (the snapshot was written at SessionStart). uat=none projects accrue
      // no queue, so this is naturally silent there. A null snapshot can't prove growth → quiet.
      const rq = scanReviewQueue(root);
      const prev = readTurnState(root);
      if (prev && typeof prev.review === 'number' && rq.count > prev.review) {
        msgs.push(`Review queue GREW this turn (${prev.review} → ${rq.count}) — these wait on YOUR \`/done\`, not on me.`);
      }
      writeTurnState(root, { review: rq.count });
    }
  } catch {
    /* fail-open — a git hiccup never blocks a stop */
  }
  if (msgs.length) {
    process.stdout.write('[housekeeping] pending before end-of-session:\n' + msgs.map((m) => '  - ' + m).join('\n') + '\n');
  }
  process.exit(0);
}

// SessionStart: surface due reviews + any gaps logged for the current project.
const reminders = [];
if (memAge >= REVIEW_DAYS) {
  reminders.push(
    `MEMORY REVIEW DUE (${memAge}d since last review). Before ending this session, present the current ` +
      `MEMORY.md index and ask the user what to prune, merge, or keep. After review, touch ${memTs}.`,
  );
}
if (maintAge >= REVIEW_DAYS) {
  let gapCount = 0;
  try {
    gapCount = readFileSync(MAINT_LOG, 'utf8').split('\n').filter(Boolean).length;
  } catch {
    /* no log yet */
  }
  reminders.push(
    `MAINTENANCE REVIEW DUE (${maintAge}d since last review, ${gapCount} entries in maintenance-gaps.log). ` +
      `Before ending this session, show the user a grouped summary of gaps and ask what to act on. ` +
      `After review, touch ${maintTs}.`,
  );
}

const cwd = process.cwd();
if (existsSync(MAINT_LOG)) {
  try {
    const hits = readFileSync(MAINT_LOG, 'utf8').split('\n').filter((l) => l.includes(cwd)).slice(-PROJECT_TAIL);
    if (hits.length) {
      reminders.push(`Current project has ${hits.length} pending gap(s) in maintenance-gaps.log. Mention early if relevant.`);
    }
  } catch {
    /* best-effort */
  }
}

// KIT-T062 — closure nags for the active project (no-op unless it has adopted .ai/). Each is
// ONE capped line, silent when clean. Also snapshot the review count so Stop can detect growth.
try {
  const root = gitRoot();
  if (adopted(root)) {
    const inbox = scanInbox(root, INBOX_STALE_DAYS);
    if (inbox.stale) {
      reminders.push(
        `INBOX UN-TRIAGED: ${inbox.stale} item(s) ≥ ${INBOX_STALE_DAYS}d (oldest ${inbox.oldestDays}d) sitting in .ai/inbox/. ` +
          `Drain it (\`/triage\`) — un-triaged capture rots silently.`,
      );
    }
    // The review/UAT queue waits on the HUMAN (KIT-D033: review IS the UAT stage). Surface it
    // every SessionStart where uat resolves `required`; uat=none accrues no queue → silent.
    const rq = scanReviewQueue(root);
    if (rq.count) {
      reminders.push(`REVIEW QUEUE: ${reviewQueueLine(rq)} — waiting on YOUR \`/done\`, not on me.`);
    }
    writeTurnState(root, { review: rq.count });
  }
} catch {
  /* closure nags are best-effort — never break orientation */
}

if (reminders.length) {
  process.stdout.write(
    '=== Claude housekeeping reminders ===\n' + reminders.map((r) => '- ' + r).join('\n') + '\n====================================\n',
  );
}
process.exit(0);
