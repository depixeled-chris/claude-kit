// UserPromptSubmit hook — detects "big asks" and nudges toward the structured
// plan → research → task-loop pipeline instead of a one-shot reply.
//
// ADVISORY ONLY: always exits 0 (never blocks). Conservative bias: a prompt must
// be both long AND contain a scope/risk signal — either alone is NOT a big ask.
// AC4 (routine asks unaffected) is the design invariant; when in doubt, stay silent.

import { gitRoot, adopted, payload } from './lib.mjs';

// Minimum chars before a prompt can qualify — short prompts cannot be big asks.
const MIN_LENGTH = 150;

// Scope/risk signals. A prompt matching ONE of these + the length floor = big ask.
// Kept as a named constant so the threshold is visible, not buried in detection logic.
const SCOPE_SIGNALS = [
  /\bredesign\b/i,
  /\barchitecture\b/i,
  /\bmigrate\b/i,
  /\bnew system\b/i,
  /\bfrom scratch\b/i,
  /\boverhaul\b/i,
  /\brework the\b/i,
  /\bend-?to-?end\b/i,
  /\bacross the (?:whole|entire)\b/i,
  /\bthroughout the (?:whole|entire|codebase|system|app)\b/i,
  /\bevery service\b/i,
  /\bsystem-?wide\b/i,
];

async function main() {
  const root = gitRoot();
  if (!adopted(root)) return; // no-op on unadopted repos

  const p = await payload();
  const prompt = typeof p.prompt === 'string' ? p.prompt : '';

  if (prompt.length < MIN_LENGTH) return;
  if (!SCOPE_SIGNALS.some((re) => re.test(prompt))) return;

  // Advisory nudge — stderr, never stdout (which would pollute the hook response).
  process.stderr.write(
    'big ask detected — engage plan → research (docs/research/) → task-loop before implementing (see /drain, /work); don\'t one-shot it.\n'
  );
}

main().catch(() => process.exit(0));
