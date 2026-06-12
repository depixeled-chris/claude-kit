// Tests for KIT-T014 — /clear-anywhere durability: the durable agent roster + the SESSION
// anchor ratchet. Three concerns, all driving the hooks the way the harness does (spawnSync,
// JSON payload on stdin) over throwaway adopted repos:
//   1. agent-roster.mjs auto-captures a delegation (PostToolUse Task) + its completion
//      (SubagentStop) into .ai/agents.jsonl; readAgents/partitionAgents collapse it correctly.
//   2. THE RESUME DRILL — delegate → /clear → orient. Asserts ZERO loss: the in-flight agent
//      survives on disk AND orient's "In-flight agents" section surfaces it (and flags an
//      uncollected/stale one). This is the proof KIT-D015 demands, not an assertion.
//   3. flush.mjs Stop-anchor nudge thresholds: fresh anchor = silent, stale-anchor-with-work =
//      nag (exit 2), no-work = silent, stop_hook_active = loop-proof, fail-open on bad input.
// Run: node hooks/agent-roster.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, utimesSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { recordAgent, updateAgent, readAgents, partitionAgents, agentsPath, AGENT_STALE_MS } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROSTER_HOOK = join(HERE, 'agent-roster.mjs');
const FLUSH_HOOK = join(HERE, 'flush.mjs');
const SEC = 1000;
const fixtures = [];
let pass = 0;
let fail = 0;

function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}

// Isolate every spawned hook from the real ~/.claude registry (orient self-heals it).
const TMP_REG = join(mkdtempSync(join(tmpdir(), 'kit-ar-reg-')), 'registry.json');
fixtures.push(dirname(TMP_REG));
const ENV = { ...process.env, CLAUDE_KIT_REGISTRY: TMP_REG };

function makeRepo({ adopt = true, commit = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'kit-ar-'));
  fixtures.push(dir);
  execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 't@t'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: dir, stdio: 'ignore' });
  if (adopt) {
    for (const s of ['inbox', 'tickets', 'decisions', 'notes', 'questions']) mkdirSync(join(dir, '.ai', s), { recursive: true });
  }
  if (commit) {
    writeFileSync(join(dir, 'seed.txt'), 'x\n');
    execFileSync('git', ['add', '-A'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: dir, stdio: 'ignore' });
  }
  return dir;
}

function hook(hookPath, payload, cwd) {
  const r = spawnSync(process.execPath, [hookPath], { input: JSON.stringify(payload), cwd, encoding: 'utf8', env: ENV });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

// A transcript whose last user message carries `userTs` — the turn-start the anchor nudge
// bounds work against. (Same shape request-gate.test.mjs uses.)
function writeTranscript(dir, userText, userTs) {
  const file = join(dir, 'transcript.jsonl');
  writeFileSync(file, [
    JSON.stringify({ type: 'user', message: { role: 'user', content: userText }, timestamp: userTs }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'working on it' }] } }),
  ].join('\n') + '\n');
  return file;
}
const ageFile = (p, secsAgo) => { const t = Date.now() / SEC - secsAgo; utimesSync(p, t, t); };

try {
  // ===== 1. lib roster semantics ==============================================
  {
    const d = makeRepo();
    recordAgent(d, { id: 'a1', status: 'in-flight', task: 'fix 3 sim regressions', scope: 'general' });
    recordAgent(d, { id: 'a2', status: 'in-flight', task: 'audit roads', scope: 'researcher' });
    updateAgent(d, 'a1', { status: 'done', summary: 'all green' });
    const rows = readAgents(d);
    ok('lib: roster collapses to one row per id', rows.length === 2);
    const a1 = rows.find((r) => r.id === 'a1');
    ok('lib: latest status per id wins (in-flight -> done)', a1.status === 'done' && a1.summary === 'all green');
    ok('lib: firstSeen carried from the earliest row', !!a1.firstSeen);

    const { inFlight, finished } = partitionAgents(rows);
    ok('lib: partition splits in-flight vs finished', inFlight.length === 1 && inFlight[0].id === 'a2' && finished.length === 1 && finished[0].id === 'a1');

    // staleness: an in-flight row older than the window is uncollected/orphaned. firstSeen is
    // ~now, so with a real "now" it's NOT stale yet; evaluated from a future "now" it IS flagged.
    const old = makeRepo();
    recordAgent(old, { id: 'orph', status: 'in-flight', task: 'long job', scope: 'general' });
    ok('lib: a just-recorded in-flight agent is NOT stale', partitionAgents(readAgents(old)).stale.length === 0);
    const future = Date.now() + AGENT_STALE_MS + 60 * SEC;
    ok('lib: an in-flight agent past the stale window is flagged uncollected', partitionAgents(readAgents(old), future).stale.length === 1);

    // tolerant of a malformed line (concurrent-writer corruption) — never throws, skips the bad row
    writeFileSync(agentsPath(d), readFileSync(agentsPath(d), 'utf8') + 'not json at all\n' + JSON.stringify({ id: 'a3', status: 'in-flight', task: 't', ts: new Date().toISOString() }) + '\n');
    const rows2 = readAgents(d);
    ok('lib: a malformed roster line is skipped, valid rows survive', rows2.some((r) => r.id === 'a3') && rows2.length === 3);

    ok('lib: readAgents on a repo with no roster returns []', readAgents(makeRepo()).length === 0);
  }

  // ===== 2. agent-roster.mjs auto-capture (the harness path) ==================
  {
    // PostToolUse(Task) with a background run — the orphan-prone case from the cap.
    const d = makeRepo();
    const r = hook(ROSTER_HOOK, {
      hook_event_name: 'PostToolUse', tool_name: 'Task',
      tool_input: { description: 'fix 3 sim regressions', subagent_type: 'general-purpose', run_in_background: true },
      tool_response: { agent_id: 'a55317e42f51677c0' },
    }, d);
    ok('hook: PostToolUse(Task) exits 0 (never blocks a delegation)', r.code === 0);
    let rows = readAgents(d);
    ok('hook: a delegation is recorded in-flight with its task + scope + bg flag',
      rows.length === 1 && rows[0].id === 'a55317e42f51677c0' && rows[0].status === 'in-flight' &&
      rows[0].task === 'fix 3 sim regressions' && rows[0].scope === 'general-purpose' && rows[0].background === true);

    // SubagentStop closes it out by agent_id.
    const rs = hook(ROSTER_HOOK, { hook_event_name: 'SubagentStop', agent_id: 'a55317e42f51677c0', agent_type: 'general-purpose' }, d);
    ok('hook: SubagentStop exits 0', rs.code === 0);
    rows = readAgents(d);
    ok('hook: SubagentStop marks the matching agent done', rows.length === 1 && rows[0].status === 'done');

    // No handle anywhere -> still recorded (minted id) so the row is trackable, not dropped.
    const d2 = makeRepo();
    hook(ROSTER_HOOK, { hook_event_name: 'PostToolUse', tool_name: 'Task', tool_input: { prompt: 'a foreground task with no id' } }, d2);
    const r2 = readAgents(d2);
    ok('hook: a delegation with no returned handle still records a trackable row', r2.length === 1 && r2[0].status === 'in-flight' && /^agent-/.test(r2[0].id));

    // Fail-open: unadopted repo is a silent no-op; a garbage payload never wedges.
    ok('hook: unadopted repo no-ops', hook(ROSTER_HOOK, { hook_event_name: 'PostToolUse', tool_name: 'Task', tool_input: {} }, makeRepo({ adopt: false })).code === 0);
    const bad = spawnSync(process.execPath, [ROSTER_HOOK], { input: 'not json', cwd: makeRepo(), encoding: 'utf8', env: ENV });
    ok('hook: malformed payload fails open (exit 0)', bad.status === 0);

    // Ticket-citation lint (KIT-T018 criterion 3): advisory warn, never block.
    // A Task whose description has no id matching the project pattern gets a warning on stderr.
    {
      const dl = makeRepo();
      const rNoId = hook(ROSTER_HOOK, {
        hook_event_name: 'PostToolUse', tool_name: 'Task',
        tool_input: { description: 'do some refactoring without citing any ticket', subagent_type: 'general-purpose' },
        tool_response: { agent_id: 'warn-test-01' },
      }, dl);
      ok('lint: ticket-less Task exits 0 (advisory, not a block)', rNoId.code === 0);
      ok('lint: ticket-less Task emits a warning on stderr', rNoId.out.includes('delegation cites no ticket'));
    }
    // A Task that cites a real ticket id produces NO warning.
    {
      const dl2 = makeRepo();
      const rWithId = hook(ROSTER_HOOK, {
        hook_event_name: 'PostToolUse', tool_name: 'Task',
        tool_input: { description: 'fix the collision bug — implements KIT-T001', subagent_type: 'general-purpose' },
        tool_response: { agent_id: 'warn-test-02' },
      }, dl2);
      ok('lint: Task citing KIT-T001 exits 0', rWithId.code === 0);
      ok('lint: Task citing KIT-T001 emits no warning', !rWithId.out.includes('delegation cites no ticket'));
    }
  }

  // ===== 3. THE RESUME DRILL — delegate -> /clear -> orient, assert ZERO loss =
  {
    // Adopt + commit so orient has a HEAD to anchor on; this repo IS the "before /clear" world.
    const d = makeRepo({ commit: true });
    // Two background delegations land (captured automatically, exactly as in a live session)…
    hook(ROSTER_HOOK, {
      hook_event_name: 'PostToolUse', tool_name: 'Task',
      tool_input: { description: 'fix 3 sim regressions', subagent_type: 'general-purpose', run_in_background: true },
      tool_response: { agent_id: 'live01' },
    }, d);
    hook(ROSTER_HOOK, {
      hook_event_name: 'PostToolUse', tool_name: 'Task',
      tool_input: { description: 'audit road topology', subagent_type: 'researcher', run_in_background: true },
      tool_response: { agent_id: 'live02' },
    }, d);
    // …one finishes before the clear, one is still running (the lose-able case).
    hook(ROSTER_HOOK, { hook_event_name: 'SubagentStop', agent_id: 'live02', agent_type: 'researcher' }, d);

    // --- /clear happens here: all in-context state is gone. The ONLY survivor is disk. ---
    ok('drill: the roster persisted on disk across the (simulated) clear', existsSync(agentsPath(d)));

    // The cold resume: orient runs at SessionStart with an empty context.
    const resume = hook(join(HERE, 'orient.mjs'), { hook_event_name: 'SessionStart' }, d);
    ok('drill: orient emits the In-flight agents section', resume.out.includes('In-flight agents'));
    ok('drill: the still-running delegation is surfaced (ZERO loss)', /\[in-flight\] live01 .*fix 3 sim regressions/.test(resume.out));
    ok('drill: the finished delegation is shown so its output gets collected', /\[done\] live02/.test(resume.out));

    // An UNCOLLECTED (stale) in-flight agent must be flagged loudly, not silently assumed done.
    const d2 = makeRepo({ commit: true });
    recordAgent(d2, { id: 'stuck', status: 'in-flight', task: 'a job nobody collected', scope: 'general' });
    // Backdate the roster's only row well past the stale window by rewriting its ts.
    const rec = JSON.parse(readFileSync(agentsPath(d2), 'utf8').trim());
    rec.ts = new Date(Date.now() - AGENT_STALE_MS - 5 * 60 * SEC).toISOString();
    writeFileSync(agentsPath(d2), JSON.stringify(rec) + '\n');
    const resume2 = hook(join(HERE, 'orient.mjs'), { hook_event_name: 'SessionStart' }, d2);
    ok('drill: an uncollected/stale in-flight agent is flagged UNCOLLECTED on resume',
      /\[in-flight\] stuck .*!! UNCOLLECTED/.test(resume2.out));

    // No roster -> orient stays silent about agents (no empty section noise).
    const d3 = makeRepo({ commit: true });
    const resume3 = hook(join(HERE, 'orient.mjs'), { hook_event_name: 'SessionStart' }, d3);
    ok('drill: a repo with no delegations shows no In-flight agents section', !resume3.out.includes('In-flight agents'));
  }

  // ===== 4. flush.mjs Stop-anchor nudge thresholds ===========================
  {
    // (a) FRESH anchor: SESSION.md written this turn -> silent. Turn started 60s ago; SESSION
    //     touched just now (default mtime) is newer than the turn start.
    {
      const d = makeRepo({ commit: true });
      writeFileSync(join(d, '.ai', 'SESSION.md'), '# fresh\n'); // touched now (after the turn start below)
      const tx = writeTranscript(d, 'do the thing', new Date(Date.now() - 60 * SEC).toISOString());
      // also make work present, so the ONLY reason for silence is the fresh anchor
      writeFileSync(join(d, '.ai', 'tickets', 'KIT-T001-x.md'), '---\nid: KIT-T001\n---\n');
      const r = hook(FLUSH_HOOK, { hook_event_name: 'Stop', transcript_path: tx }, d);
      ok('anchor: fresh SESSION (touched this turn) stays silent', r.code === 0 && !r.out.includes('resume anchor'));
    }

    // (b) STALE anchor + work landed this turn -> NAG (exit 2). SESSION backdated before the
    //     turn start; a ticket edited this turn.
    {
      const d = makeRepo({ commit: true });
      const sess = join(d, '.ai', 'SESSION.md');
      writeFileSync(sess, '# stale\n');
      ageFile(sess, 10 * 60); // 10 min old — older than the turn start
      const tx = writeTranscript(d, 'make a change', new Date(Date.now() - 60 * SEC).toISOString());
      writeFileSync(join(d, '.ai', 'tickets', 'KIT-T002-x.md'), '---\nid: KIT-T002\n---\n'); // work, now
      const r = hook(FLUSH_HOOK, { hook_event_name: 'Stop', transcript_path: tx }, d);
      ok('anchor: stale SESSION + work-this-turn nags once (exit 2)', r.code === 2 && r.out.includes('resume anchor'));
    }

    // (c) STALE anchor but NO work this turn -> silent (don't nag a no-op turn). The HEAD commit
      //     must predate the turn start (committed in a prior turn), so set its committer+author
      //     date an hour back; no store file is written this turn.
    {
      const d = makeRepo({ commit: true });
      const sess = join(d, '.ai', 'SESSION.md');
      writeFileSync(sess, '# stale\n');
      ageFile(sess, 10 * 60);
      const oldIso = new Date(Date.now() - 3600 * SEC).toISOString();
      execFileSync('git', ['commit', '-q', '--amend', '--no-edit', '--date', oldIso], {
        cwd: d, stdio: 'ignore', env: { ...process.env, GIT_COMMITTER_DATE: oldIso, GIT_AUTHOR_DATE: oldIso },
      });
      const tx = writeTranscript(d, 'just a question, no work', new Date().toISOString());
      const r = hook(FLUSH_HOOK, { hook_event_name: 'Stop', transcript_path: tx }, d);
      ok('anchor: stale SESSION but no work this turn stays silent', r.code === 0 && !r.out.includes('resume anchor'));
    }

    // (d) loop-proof: stop_hook_active -> always allow.
    {
      const d = makeRepo({ commit: true });
      const sess = join(d, '.ai', 'SESSION.md');
      writeFileSync(sess, '# stale\n'); ageFile(sess, 10 * 60);
      const tx = writeTranscript(d, 'change it', new Date(Date.now() - 60 * SEC).toISOString());
      writeFileSync(join(d, '.ai', 'tickets', 'KIT-T003-x.md'), '---\nid: KIT-T003\n---\n');
      const r = hook(FLUSH_HOOK, { hook_event_name: 'Stop', transcript_path: tx, stop_hook_active: true }, d);
      ok('anchor: stop_hook_active never loops (allow)', r.code === 0 && !r.out.includes('resume anchor'));
    }

    // (e) fail-open: missing transcript -> allow; unadopted -> allow.
    {
      const d = makeRepo({ commit: true });
      ok('anchor: missing transcript fails open', hook(FLUSH_HOOK, { hook_event_name: 'Stop', transcript_path: join(d, 'nope.jsonl') }, d).code === 0);
      ok('anchor: unadopted repo no-ops at Stop', hook(FLUSH_HOOK, { hook_event_name: 'Stop', transcript_path: writeTranscript(makeRepo({ adopt: false }), 'x', new Date().toISOString()) }, makeRepo({ adopt: false })).code === 0);
    }

    // (f) PreCompact branch still emits the flush reminder (and now names the agent roster).
    {
      const d = makeRepo({ commit: true });
      const r = hook(FLUSH_HOOK, { hook_event_name: 'PreCompact' }, d);
      ok('flush: PreCompact still emits the flush reminder', r.code === 0 && /COMPACTION IMMINENT/.test(r.out));
      ok('flush: PreCompact reminder points at the agent roster', r.out.includes('agents.jsonl'));
    }
  }
} finally {
  for (const d of fixtures) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
