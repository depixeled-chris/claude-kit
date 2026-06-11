#!/usr/bin/env node
// PreToolUse (AskUserQuestion) — enforce the recommendation-placement contract on a
// questionnaire BEFORE it reaches the maintainer (KIT-T086). exit 2 = block, 0 = allow.
//
// WHY: the contract already says "the recommended option goes FIRST and its LABEL is
// prefixed `(Recommended)`" (CLAUDE.md DECISIONS), and the agent still shipped the marker
// in the option DESCRIPTION — where the UI never renders it, so the recommendation is
// invisible. A re-violated written rule is the textbook case for ENFORCEMENT, not a louder
// note ("enforcement is hooks, not judgment"). This closes the path so a non-compliant
// questionnaire can't be sent, rather than merely discouraging it.
//
// HOOKABILITY (verified KIT-T086, the way KIT-T014 verified `Task`): `AskUserQuestion` is a
// real harness tool name (a valid PreToolUse matcher — confirmed against live transcripts),
// and the PreToolUse payload carries `tool_input.questions[]`, each question an `options[]`
// of `{ label, description }`. PreToolUse blocks on exit 2 (hooks docs), feeding stderr back.
//
// BLOCKS a questionnaire if, for ANY question:
//   (a) NO option's label starts with `(Recommended)`  — no recommendation at all; and the
//       message escalates when the word appears in a DESCRIPTION instead (the lived bug).
//   (b) single-select: the `(Recommended)` option is not the FIRST option.
//   multiSelect relaxes (b) only — every recommended option is marked on its LABEL, but they
//   need not be first (the contract: "prepend it to each recommended option"); (a) still holds.
//
// This is an AGENT-DISCIPLINE rule, not a store rule — it fires regardless of `.ai/` adoption
// (a bad questionnaire is wrong in any repo). But it still FAILS OPEN on any error: a broken
// gate must never wedge the tool call (HOOK CONTRACT).

import { payload } from './lib.mjs';

const TOOL = 'AskUserQuestion';
const MARKER = '(Recommended)';
const RULE = 'recommended option FIRST; its LABEL must start with `(Recommended)`, not the description';
// Matches the marker word in a description even when spelled/cased loosely, so the
// "marker in the wrong field" diagnosis catches the real miss (e.g. "recommended:" prose).
const DESC_MENTION = /\brecommended\b/i;

const label = (opt) => String((opt && opt.label) || '').trim();
const startsWithMarker = (opt) => label(opt).toLowerCase().startsWith(MARKER.toLowerCase());

try {
  const p = await payload();
  // Defensive: the matcher already scopes us, but never act on another tool if mis-wired.
  if (p.tool_name && p.tool_name !== TOOL) process.exit(0);

  const questions = (p.tool_input && p.tool_input.questions) || [];
  if (!Array.isArray(questions) || questions.length === 0) process.exit(0); // nothing to judge → allow

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i] || {};
    const options = Array.isArray(q.options) ? q.options : [];
    if (options.length === 0) continue; // malformed/empty question — fail open on this one

    const name = q.header || q.question || `question #${i + 1}`;
    const recIndexes = options.map((o, idx) => (startsWithMarker(o) ? idx : -1)).filter((idx) => idx !== -1);

    // (a) no recommendation on any LABEL — the marker is absent or hiding in a description.
    if (recIndexes.length === 0) {
      const inDescription = options.some((o) => DESC_MENTION.test(String((o && o.description) || '')));
      block(name, inDescription ? markerInDescriptionMsg(name) : noRecommendationMsg(name));
    }

    // (b) the recommended option must be FIRST — single-select only. multiSelect may carry
    // several recommended options anywhere (the contract marks each LABEL, not their order).
    if (!q.multiSelect && recIndexes[0] !== 0) {
      block(name, recNotFirstMsg(name, options[0]));
    }
  }

  process.exit(0); // every question compliant
} catch {
  process.exit(0); // fail-open per HOOK CONTRACT
}

function block(name, body) {
  process.stderr.write(body);
  process.exit(2);
}

function header(name) {
  return ['', `BLOCKED: non-compliant AskUserQuestion (KIT-T086) — "${name}".`, `  Rule: ${RULE}.`, ''];
}

function markerInDescriptionMsg(name) {
  return [
    ...header(name),
    'The word "Recommended" appears in an option DESCRIPTION, but no option LABEL starts with',
    `"${MARKER}" — so the marker renders nowhere and the recommendation is invisible. Move it to`,
    'the LABEL of the option you recommend, and put that option FIRST:',
    ...example(),
  ].join('\n');
}

function noRecommendationMsg(name) {
  return [
    ...header(name),
    `No option carries a recommendation. EVERY question needs one: prefix the recommended`,
    `option's LABEL with "${MARKER}" and list it FIRST.`,
    ...example(),
  ].join('\n');
}

function recNotFirstMsg(name, firstOpt) {
  return [
    ...header(name),
    `An option is marked "${MARKER}" but it is not FIRST (first is "${label(firstOpt)}").`,
    'Reorder so the recommended option leads.',
    ...example(),
  ].join('\n');
}

function example() {
  return [
    '',
    '  options: [',
    `    { label: "${MARKER} Do X", description: "why X is the recommendation" },  // FIRST`,
    '    { label: "Do Y",                 description: "the alternative" },',
    '  ]',
    '',
    'For multiSelect, prepend the marker to EACH recommended option\'s label (order relaxed).',
    '',
  ];
}
