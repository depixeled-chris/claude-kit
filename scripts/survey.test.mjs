#!/usr/bin/env node
// survey.test.mjs — unit tests for LAB-scope discovery + rendering in survey.mjs.
//
// Verifies:
//   (a) a project with `lab: true` in its config.yml is discovered
//   (b) it renders the NEUTRAL lab label, NOT "no local repo … notebook only"
//   (c) git-state block is absent / not flagged as missing clone
//   (d) a repo:null project WITHOUT lab:true still gets the missing-clone flag
//
// Also exercises init-project's --lab helpers without spawning a full process.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { deriveKey, seedProjectKey, stampLabFlag } from './init-project.mjs';

// Resolve script paths — handle Windows drive-letter prefix from file: URL.
function urlToPath(u) {
  return fileURLToPath(u);
}
const SURVEY = urlToPath(new URL('./survey.mjs', import.meta.url));
const INIT   = urlToPath(new URL('./init-project.mjs', import.meta.url));

let pass = 0;
let fail = 0;
const fixtures = [];

function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else       { fail++; console.log('  FAIL  ' + name); }
}

// ---- helpers ----------------------------------------------------------------

function tmpDir() {
  const d = mkdtempSync(join(tmpdir(), 'kit-survey-'));
  fixtures.push(d);
  return d;
}

// Scaffold a minimal notebook dir (mirrors what the central data store looks like).
// `labFlag` controls whether config.yml contains `lab: true`.
function makeNotebook(dataRoot, name, labFlag = false) {
  const nb = join(dataRoot, 'projects', name);
  mkdirSync(join(nb, 'tickets'), { recursive: true });
  const labLine = labFlag ? 'lab: true\n' : '';
  writeFileSync(join(nb, 'config.yml'), `${labLine}ids:\n  key: "TST"\n  prefix: "TST-T"\n  pad: 3\n`);
  writeFileSync(
    join(nb, 'tickets', 'TST-T001-sample.md'),
    '---\nid: TST-T001\ntitle: Sample ticket\nstatus: todo\n---\n',
  );
  return nb;
}

// Write a minimal registry JSON file so lib.mjs readRegistry() returns our test dataRoot
// and an empty projects map. Returns the path to the registry file.
function writeRegistry(base, dataRoot) {
  const regPath = join(base, 'registry.json');
  writeFileSync(regPath, JSON.stringify({ dataRoot, projects: {} }));
  return regPath;
}

// Run survey.mjs with a synthetic registry pointing at dataRoot.
// Returns stdout as a string.
function runSurvey(dataRoot, extraArgs = []) {
  const base = tmpDir();
  const regPath = writeRegistry(base, dataRoot);
  const result = spawnSync(
    process.execPath,
    [SURVEY, ...extraArgs],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        // Override the registry path so lib.mjs reads our synthetic one.
        CLAUDE_KIT_REGISTRY: regPath,
        // Ensure no real cwd-git detection bleeds in (survey calls gitRoot()).
        // We can't easily suppress it but we can verify against the specific labels
        // our test projects get rather than needing a clean slate.
      },
    },
  );
  return result.stdout || '';
}

// ---- survey rendering tests ------------------------------------------------

const dataRoot = tmpDir();
makeNotebook(dataRoot, 'my-lab', true);      // lab: true
makeNotebook(dataRoot, 'my-notebook', false); // repo:null, no lab flag

const out = runSurvey(dataRoot);

// (a) LAB project is discovered (appears in output)
ok('survey: lab project my-lab appears in output', out.includes('my-lab'));

// (b) LAB project renders neutral label
ok(
  'survey: lab project shows neutral lab label',
  out.includes('lab — repo-less by design') || out.includes('lab — no repo'),
);

// (c) LAB project NOT flagged as missing clone
// The missing-clone markers are "no local repo on this machine — notebook only" (heading)
// and "no local repo here" (one-liner). Neither should appear on the my-lab line.
const labLines = out.split('\n').filter((l) => l.includes('my-lab'));
const labMissingClone = labLines.some(
  (l) => l.includes('notebook only') || l.includes('no local repo here'),
);
ok('survey: lab project NOT flagged as missing clone', !labMissingClone);

// (d) notebook-only project still shows missing-clone signal somewhere in output
ok(
  'survey: notebook-only project shows missing-clone flag',
  out.includes('no local repo on this machine — notebook only') || out.includes('no local repo here'),
);

// notebook-only project must NOT be mislabelled as lab
const notebookLabLine = out.split('\n').some(
  (l) => l.includes('my-notebook') && (l.includes('lab — repo-less') || l.includes('lab — no repo')),
);
ok('survey: notebook-only project NOT mislabelled as lab', !notebookLabLine);

// ---- deep-view lab rendering (via named arg) --------------------------------
const deepOut = runSurvey(dataRoot, ['my-lab']);
ok(
  'survey deep view: my-lab heading has lab label',
  deepOut.includes('lab — repo-less by design'),
);
ok(
  'survey deep view: my-lab heading does NOT say "notebook only"',
  !deepOut.includes('notebook only'),
);

// ---- init-project --lab helpers (unit tests, no process spawn) --------------

const labBase = tmpDir();
const labDataDir = join(labBase, 'projects', 'cross-cutting');
mkdirSync(join(labDataDir, 'tickets'), { recursive: true });
// Seed a config.yml that looks like it came from the template (key placeholder present).
writeFileSync(
  join(labDataDir, 'config.yml'),
  'ids:\n  key: "KEY"\n  prefix: "KEY-T"\n  pad: 3\n',
);

// seedProjectKey should replace KEY with the derived key.
seedProjectKey(labDataDir, 'cross-cutting');
const cfgAfterSeed = readFileSync(join(labDataDir, 'config.yml'), 'utf8');
ok('init-project --lab: seedProjectKey replaces KEY placeholder', /key:\s*"CC"/.test(cfgAfterSeed));

// stampLabFlag should add `lab: true`.
stampLabFlag(join(labDataDir, 'config.yml'));
const cfgAfterStamp = readFileSync(join(labDataDir, 'config.yml'), 'utf8');
ok('init-project --lab: stampLabFlag adds lab: true', /^lab:\s*true\s*$/m.test(cfgAfterStamp));

// stampLabFlag is idempotent.
stampLabFlag(join(labDataDir, 'config.yml'));
const cfgAfterStamp2 = readFileSync(join(labDataDir, 'config.yml'), 'utf8');
const labCount = (cfgAfterStamp2.match(/^lab:\s*true\s*$/mg) || []).length;
ok('init-project --lab: stampLabFlag is idempotent (not duplicated)', labCount === 1);

// ---- init-project --lab full spawn test ------------------------------------
// Requires CLAUDE_DATA; uses a temp dir so nothing real is affected.
const labSpawnBase = tmpDir();
const spawnResult = spawnSync(
  process.execPath,
  [INIT, '--lab', 'test-lab-scope'],
  {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_DATA: labSpawnBase },
  },
);
ok('init-project --lab: exits 0', spawnResult.status === 0);

const labDir = join(labSpawnBase, 'projects', 'test-lab-scope');
ok('init-project --lab: data dir created', existsSync(labDir));
ok('init-project --lab: no junction created in the data root itself', !existsSync(join(labSpawnBase, '.ai')));
const labCfg = readFileSync(join(labDir, 'config.yml'), 'utf8');
ok('init-project --lab: config.yml has lab: true', /^lab:\s*true\s*$/m.test(labCfg));
ok('init-project --lab: config.yml has a real key (not KEY placeholder)', !labCfg.includes('"KEY"'));

// ---- cleanup ----------------------------------------------------------------
for (const d of fixtures) {
  try { rmSync(d, { recursive: true, force: true }); } catch {}
}

console.log(`\nsurvey: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
