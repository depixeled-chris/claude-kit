#!/usr/bin/env node
// frontmatter.test.mjs — the two lived failures (KIT-T107 / KIT-T124) plus the KIT-T049
// protections the shared parser must keep.

import assert from 'node:assert/strict';
import { frontmatterBlock, splitFrontmatter, stripComment, field, listField } from './frontmatter.mjs';

const LF = '---\nid: GG-T001\ntitle: A thing\n---\n\nbody';
const CRLF = '---\r\nid: GG-T003\r\ntitle: A thing\r\n---\r\n\r\nbody';

// KIT-T124: a CRLF first line must still yield the frontmatter (LF-only regexes returned
// '' → junk board rows with filename-fallback ids → duplicate-id aborts).
assert.equal(field(frontmatterBlock(LF), 'id'), 'GG-T001');
assert.equal(field(frontmatterBlock(CRLF), 'id'), 'GG-T003');
assert.ok(splitFrontmatter(CRLF), 'splitFrontmatter must parse CRLF');
{
  const p = splitFrontmatter(CRLF);
  assert.equal(p.open + p.fm + p.close + p.rest, CRLF, 'split must reassemble losslessly');
}

// KIT-T107: a template line whose value is ONLY a trailing comment reads as EMPTY —
// reconcile-supersede read it as a real pointer and mass-flipped fresh tickets to
// status: superseded (2026-07-14).
const TEMPLATE_FM = [
  'id: KIT-T999',
  'supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)',
  'superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)',
  'files: []              # repo-root-relative paths this ticket touches',
].join('\n');
assert.equal(field(TEMPLATE_FM, 'supersedes'), '');
assert.equal(field(TEMPLATE_FM, 'superseded_by'), '');
assert.deepEqual(listField(TEMPLATE_FM, 'files'), []);

// A real pointer next to the comment convention still reads.
assert.equal(field('superseded_by: KIT-T042  # retired by the rewrite', 'superseded_by'), 'KIT-T042');

// KIT-T049: a '#' inside brackets or quotes is a value char, not a comment.
assert.equal(stripComment('[a#b, c]'), '[a#b, c]');
assert.equal(stripComment('"a # b"'), '"a # b"');
assert.equal(stripComment('value # comment'), 'value ');
assert.equal(stripComment('# whole-line comment'), '');
assert.deepEqual(listField('labels: [ui, a#b]', 'labels'), ['ui', 'a#b']);

// CRLF interior lines: values must come back clean of \r.
assert.equal(field('title: hello\r\nstatus: todo\r', 'status'), 'todo');

console.log('frontmatter.test: ok');
