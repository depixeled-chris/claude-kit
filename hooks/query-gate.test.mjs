// Automated test for the retrieval gate (hooks/query-gate.mjs). Spins up throwaway
// adopted repos and asserts: BLOCK on store search + tree-wide source discovery;
// ALLOW on targeted single-file grep, piped output filtering, q/code-graph calls,
// non-search commands, and unadopted repos. Run: node hooks/query-gate.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./query-gate.mjs', import.meta.url));
let failures = 0;

function makeRepo({ adopt = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'qg-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  if (adopt) mkdirSync(join(dir, '.ai', 'decisions'), { recursive: true });
  return dir;
}

function run(dir, command) {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: dir, input: JSON.stringify({ tool_input: { command } }), encoding: 'utf8',
  });
  return { code: r.status, err: r.stderr || '' };
}

function expect(name, actual, wanted) {
  const ok = actual === wanted;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (exit=${actual}, want=${wanted})`);
  if (!ok) failures++;
}

const d = makeRepo();
const un = makeRepo({ adopt: false });

// BLOCK — searching/reading the .ai work store.
expect('blocks grep over .ai store', run(d, 'grep -rn "physics" .ai/decisions/').code, 2);
expect('blocks cat of a store file', run(d, 'cat .ai/decisions/HOD-D004.md').code, 2);
expect('blocks find over the store', run(d, 'find .ai/tickets -name "*.md"').code, 2);

// BLOCK — tree-wide source discovery.
expect('blocks recursive grep of source', run(d, 'grep -rn "PhysicsSim" src/').code, 2);
expect('blocks bare rg (recursive by default)', run(d, 'rg PhysicsSim').code, 2);
expect('blocks git grep discovery', run(d, 'git grep usePhysics').code, 2);
expect('blocks find -name file location', run(d, 'find . -name "*.rs"').code, 2);

// ALLOW — the maintainer's rule: grep is fine for a SPECIFIC known file, and a pipe
// only filters a command's OUTPUT (not a file search).
expect('allows targeted grep of one file', run(d, 'grep usePhysics src/main.ts').code, 0);
expect('allows rg on one specific file', run(d, 'rg usePhysics src/main.ts').code, 0);
expect('allows piped output filter', run(d, 'git log --oneline | grep physics').code, 0);
expect('allows q output piped to grep', run(d, 'node scripts/q.mjs sql "select 1" | grep x').code, 0);

// KIT-T056 — chain/pipe escapes are judged; legit user dirs named like stores pass.
expect('blocks ||-chained store grep (leader-split escape)', run(d, 'true || grep -rn x .ai/decisions/').code, 2);
expect('blocks ;-chained store grep after a pipe', run(d, 'git log | grep x; cat .ai/decisions/D-001.md').code, 2);
expect('blocks piped grep that names a store PATH', run(d, 'echo x | grep y .ai/tickets/T-1.md').code, 2);
expect('blocks find|xargs grep discovery', run(d, 'git ls-files | xargs grep -r usePhysics src/').code, 2);
expect('allows grep of src/notes/ (user dir, not the store)', run(d, 'grep todo src/notes/api.md').code, 0);
expect('allows cat of src/tickets/ file (user dir)', run(d, 'cat src/tickets/parser.ts').code, 0);
expect('blocks centralized store path (projects/<name>/tickets)', run(d, 'grep x D:/data/projects/foo/tickets/T-1.md').code, 2);
expect('still blocks bare store dir at token start', run(d, 'grep -rn x tickets/').code, 2);
expect('allows piped grep with pattern containing no path', run(d, 'git log --oneline | grep -i decisions').code, 0);
expect('allows piped filter whose quoted PATTERN has regex slashes', run(d, "npm test | select-string -pattern '^(all pass|\\d+ FAIL)'").code, 0);
expect('allows piped grep with unquoted slashed PATTERN (no file arg)', run(d, 'git log | grep src/notes').code, 0);

// ALLOW — the query tools themselves, ordinary commands, and unadopted repos.
expect('allows q governing', run(d, 'node scripts/q.mjs governing src/main.ts').code, 0);
expect('allows code-graph query', run(d, 'node scripts/code-graph.mjs --query defines PhysicsSim').code, 0);
expect('allows a build command', run(d, 'npm run build').code, 0);
expect('no-ops on unadopted repo', run(un, 'grep -rn secret .ai/').code, 0);

console.log(failures ? `\n${failures} FAIL` : '\nall pass');
process.exit(failures ? 1 : 0);
