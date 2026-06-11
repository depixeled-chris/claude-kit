// Automated test for the questionnaire gate (hooks/question-gate.mjs). Feeds an
// AskUserQuestion tool_input on stdin and asserts: a compliant single-select PASSES;
// the marker hiding in a DESCRIPTION, a missing recommendation, and a not-first
// recommendation each BLOCK; a compliant multiSelect PASSES; malformed/empty payloads
// FAIL OPEN. No repo fixture — this is an agent-discipline rule, repo-agnostic.
// Run: node hooks/question-gate.test.mjs

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./question-gate.mjs', import.meta.url));
let failures = 0;

// Run the hook with a raw stdin string (so we can also send non-JSON for the fail-open case).
function runRaw(input) {
  const r = spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8' });
  return { code: r.status, err: r.stderr || '' };
}
function run(toolInput, toolName = 'AskUserQuestion') {
  return runRaw(JSON.stringify({ tool_name: toolName, tool_input: toolInput }));
}

function expect(name, actual, wanted) {
  const ok = actual === wanted;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (exit=${actual}, want=${wanted})`);
  if (!ok) failures++;
}
function expectIncludes(name, hay, needle) {
  const ok = hay.includes(needle);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) { failures++; console.log(`        wanted substring: ${needle}\n        in: ${hay.slice(0, 200)}`); }
}

// Reusable option shapes.
const recFirst = {
  question: 'Persist the plan now?',
  header: 'Persist plan',
  multiSelect: false,
  options: [
    { label: '(Recommended) Tickets + milestones', description: 'Create the tickets and sequence them.' },
    { label: 'Tickets only', description: 'Backlog only; sequence later.' },
    { label: 'Keep in chat', description: 'No file changes now.' },
  ],
};

// 1) compliant single-select PASSES
expect('compliant single-select passes', run({ questions: [recFirst] }).code, 0);

// 2) the lived bug — marker in the DESCRIPTION, never on a label → BLOCK, with the right diagnosis
{
  const r = run({
    questions: [{
      question: 'Which status command survives?',
      header: 'Status cmds',
      multiSelect: false,
      options: [
        { label: 'Keep /status', description: 'Recommended — clearer, more discoverable name.' },
        { label: 'Keep /standup', description: 'Evokes the briefing framing.' },
      ],
    }],
  });
  expect('marker-in-description blocks', r.code, 2);
  expectIncludes('marker-in-description names the bug (DESCRIPTION)', r.err, 'DESCRIPTION');
  expectIncludes('marker-in-description quotes the rule', r.err, 'must start with `(Recommended)`');
  expectIncludes('marker-in-description names the offending question', r.err, 'Status cmds');
}

// 3) no recommendation anywhere → BLOCK
{
  const r = run({
    questions: [{
      question: 'Pick a path.',
      header: 'Pick path',
      multiSelect: false,
      options: [
        { label: 'Option A', description: 'does A' },
        { label: 'Option B', description: 'does B' },
      ],
    }],
  });
  expect('no-recommendation blocks', r.code, 2);
  expectIncludes('no-recommendation message asks for a recommendation', r.err, 'No option carries a recommendation');
}

// 4) recommendation present but NOT first (single-select) → BLOCK
{
  const r = run({
    questions: [{
      question: 'Pick a path.',
      header: 'Order check',
      multiSelect: false,
      options: [
        { label: 'Option A', description: 'does A' },
        { label: '(Recommended) Option B', description: 'does B, the recommendation' },
      ],
    }],
  });
  expect('rec-not-first blocks', r.code, 2);
  expectIncludes('rec-not-first message flags ordering', r.err, 'not FIRST');
}

// 5) compliant multiSelect PASSES — each recommended option marked on its LABEL, order relaxed
{
  const r = run({
    questions: [{
      question: 'Select all that apply.',
      header: 'Multi ok',
      multiSelect: true,
      options: [
        { label: 'Alpha', description: 'not recommended' },
        { label: '(Recommended) Beta', description: 'recommended one' },
        { label: '(Recommended) Gamma', description: 'recommended two' },
      ],
    }],
  });
  expect('compliant multiSelect (rec not first) passes', r.code, 0);
}

// 5b) multiSelect with NO recommendation still BLOCKS (criterion (a) holds for multi too)
expect('multiSelect with no recommendation blocks', run({
  questions: [{ header: 'Multi none', multiSelect: true, options: [
    { label: 'Alpha', description: 'a' }, { label: 'Beta', description: 'b' },
  ] }],
}).code, 2);

// 6) a SECOND question being non-compliant blocks even when the first is fine
expect('any non-compliant question in a multi-question set blocks', run({
  questions: [recFirst, { header: 'Bad one', multiSelect: false, options: [
    { label: 'X', description: 'x' }, { label: 'Y', description: 'y' },
  ] }],
}).code, 2);

// 7) FAIL-OPEN cases — a broken gate must never wedge the tool call.
expect('non-JSON stdin fails open', runRaw('not json at all {{{').code, 0);
expect('empty stdin fails open', runRaw('').code, 0);
expect('payload with no questions fails open', run({}).code, 0);
expect('empty questions array fails open', run({ questions: [] }).code, 0);
expect('question with no options is skipped (fail open)', run({ questions: [{ header: 'empty', options: [] }] }).code, 0);

// 8) defensive: a mis-wired call for a DIFFERENT tool is ignored (never act outside scope)
expect('different tool_name is a no-op', run({ questions: [recFirst.options ? recFirst : {} ] }, 'Bash').code, 0);

// 9) marker matching is case-insensitive on the label and tolerant of surrounding space
expect('lowercase/padded marker on the first label passes', run({
  questions: [{ header: 'Case', multiSelect: false, options: [
    { label: '  (recommended) Do X', description: 'why' }, { label: 'Do Y', description: 'alt' },
  ] }],
}).code, 0);

console.log(failures ? `\n${failures} FAIL` : '\nall pass');
process.exit(failures ? 1 : 0);
