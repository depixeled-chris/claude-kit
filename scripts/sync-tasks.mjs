#!/usr/bin/env node
// Emit the native-task spec for the active tickets, so a session can hydrate the
// native task list from the durable .ai/ tickets (D-005). Read-only — prints JSON;
// it does not touch the native list (only Claude's Task tools can), it tells Claude
// what to create.
//
//   node scripts/sync-tasks.mjs [repoRoot]   # defaults to cwd
//
// Each acceptance criterion (- [ ] / - [x]) becomes one task titled "<id> <criterion>"
// — the id prefix marks it ticket-backed. A ticket with no criteria yields one task
// from its title, carrying the ticket's mapped status. Checked criteria -> completed,
// unchecked -> pending; the lockstep rules flip the active one to in_progress.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_MAP = { todo: 'pending', doing: 'in_progress', review: 'completed', done: 'completed' };

const root = process.argv[2] || process.cwd();
const ticketsDir = join(root, '.ai', 'tickets');
const configPath = join(root, '.ai', 'config.yml');

// Light, dependency-free read of the two config bits we need (no YAML lib).
function loadConfig() {
  let prefix = 'T-';
  const map = { ...DEFAULT_MAP };
  try {
    const cfg = readFileSync(configPath, 'utf8');
    const pm = cfg.match(/prefix:\s*"([^"]+)"/);
    if (pm) prefix = pm[1];
    const block = cfg.match(/status_map:\s*\n((?:[ \t]+\w+:[ \t]*\w+\n?)+)/);
    if (block) {
      for (const line of block[1].split('\n')) {
        const m = line.match(/\s+(\w+):\s*(\w+)/);
        if (m) map[m[1]] = m[2];
      }
    }
  } catch {
    /* fall back to defaults */
  }
  return { prefix, map };
}

function field(fmText, key) {
  const m = fmText.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

const { prefix, map } = loadConfig();
const files = existsSync(ticketsDir) ? readdirSync(ticketsDir).filter((f) => f.endsWith('.md')) : [];
const tasks = [];

for (const f of files) {
  const text = readFileSync(join(ticketsDir, f), 'utf8');
  const fm = (text.match(/^---\n([\s\S]*?)\n---/) || [null, ''])[1];
  const id = field(fm, 'id') || (f.match(/[A-Za-z]+-\d+/) || [])[0] || f.replace(/\.md$/, '');
  const status = field(fm, 'status') || 'todo';
  const title = field(fm, 'title') || (text.match(/^#\s+(.+)$/m) || [])[1] || id;
  const mapped = map[status] || 'pending';
  const criteria = [...text.matchAll(/^\s*-\s*\[([ xX])\]\s*(.+)$/gm)];

  if (criteria.length) {
    for (const c of criteria) {
      const done = c[1].toLowerCase() === 'x';
      tasks.push({ ticket: id, ticketStatus: status, subject: `${id} ${c[2].trim()}`, status: done ? 'completed' : 'pending' });
    }
  } else {
    tasks.push({ ticket: id, ticketStatus: status, subject: `${id} ${title}`, status: mapped });
  }
}

process.stdout.write(JSON.stringify({ prefix, count: tasks.length, tasks }, null, 2) + '\n');
