#!/usr/bin/env node
// Unit test for the chip classifier (KIT-T148): item id vs commit sha vs plain text. Same
// hand-rolled harness as the other kit tests; exit 0 = all pass. Registered in root `npm test`.

import { classifyChip } from './chips.mjs';

let pass = 0;
let fail = 0;
function is(name, got, want) {
  if (got === want) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log(`  FAIL  ${name} (got '${got}', want '${want}')`); }
}

// --- item ids navigate in-app ---
is('ticket id KIT-T148', classifyChip('KIT-T148'), 'item');
is('decision id KIT-D044', classifyChip('KIT-D044'), 'item');
is('question id GG-Q7', classifyChip('GG-Q7'), 'item');
is('note id CRX-N12', classifyChip('CRX-N12'), 'item');
is('request id KIT-R3', classifyChip('KIT-R3'), 'item');
is('epic id KIT-E1', classifyChip('KIT-E1'), 'item');
is('hyphenated key FOO-BAR-T1', classifyChip('FOO-BAR-T1'), 'item');

// --- commit shas are NOT tickets ---
is('short sha fd2f925', classifyChip('fd2f925'), 'commit');
is('10-char sha', classifyChip('deadbeef12'), 'commit');
is('full 40-char sha', classifyChip('0123456789abcdef0123456789abcdef01234567'), 'commit');
is('all-hex word deadbeef', classifyChip('deadbeef'), 'commit');
is('sha with trailing space (trimmed)', classifyChip(' 6c76ce5 '), 'commit');

// --- everything else is inert text ---
is('plain prose', classifyChip('see the notes'), 'text');
is('empty string', classifyChip(''), 'text');
is('null-ish', classifyChip(null), 'text');
is('milestone label M4-web-ui', classifyChip('M4-web-ui'), 'text');
is('6 hex is too short for a sha', classifyChip('abc123'), 'text');
is('41 hex is too long for a sha', classifyChip('0123456789abcdef0123456789abcdef012345678'), 'text');
is('non-hex letters g-z', classifyChip('zzzzzzz'), 'text');

console.log(`\nchips.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
