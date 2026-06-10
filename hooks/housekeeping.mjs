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
import { payload, MAINT_LOG, git, gitRoot, adopted, wipSummary } from './lib.mjs';

const REVIEW_DAYS = 7;
const MISSING_AGE = 999;
const MS_PER_DAY = 86400000;
const PROJECT_TAIL = 20;
// KIT-T054: "push at every task boundary" is contract; nag (never block) when local-only
// commits pile up at end of turn. Threshold > 1 so a single mid-task commit stays quiet.
const UNPUSHED_NAG = 3;

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
    // remote-less repos have nothing to push to — every commit would count, all noise
    if (adopted(root) && git(['-C', root, 'remote']).trim()) {
      const unpushed = wipSummary(root).unpushed.length;
      if (unpushed >= UNPUSHED_NAG) {
        msgs.push(`${unpushed} unpushed commit(s) on this repo — push at the task boundary (cross-machine rewind point).`);
      }
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

if (reminders.length) {
  process.stdout.write(
    '=== Claude housekeeping reminders ===\n' + reminders.map((r) => '- ' + r).join('\n') + '\n====================================\n',
  );
}
process.exit(0);
