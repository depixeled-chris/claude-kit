// Markdown-WRITE layer (KIT-D044): mutations call the SAME code paths as the `t` CLI — the
// evidence-floor + human_only guards stay INTACT — land in the markdown truth, then the view
// regen runs and the cache is re-hydrated so the next READ reflects the write (the
// bidirectional round-trip). The API never writes the cache directly.
//
// A guard rejection surfaces as a typed 4xx (never a 500): an unknown id → 404, a human_only
// transition → 403, an evidence-floor miss → 422, any other write refusal → 400.

import {
  comment as tComment, setStatus, readConfig, findTicket,
  EVIDENCE_PATTERNS, NO_TEST_ESCAPE,
} from '../../scripts/t.mjs';
import { regenerateIndexes } from '../../scripts/index-tickets.mjs';
import { hydrate } from '../../scripts/hydrate-db.mjs';
import { ApiError, notFound } from '../lib/errors.mjs';
import { STATUS } from '../lib/status.mjs';

function requireWritableRoot(project) {
  if (!project.root) {
    throw new ApiError(
      STATUS.CONFLICT,
      `project '${project.key}' has no local repo on this host — its store is not writable here`,
      'not_writable',
    );
  }
  return project.root;
}

function mapWriteError(e) {
  if (e instanceof ApiError) return e;
  const msg = (e && e.message) ? e.message : String(e);
  if (/unknown id/i.test(msg)) return notFound(msg);
  if (/human_only|--human|maintainer's call|uat=required/i.test(msg)) {
    return new ApiError(STATUS.FORBIDDEN, msg, 'human_only');
  }
  return new ApiError(STATUS.BAD_REQUEST, msg, 'write_failed');
}

// Re-run the derived board regen (best-effort, like t.mjs's own refresh) then hydrate the
// cache from the just-written markdown, so an immediate GET reads the fresh row.
async function afterWrite(config, root) {
  try {
    await regenerateIndexes(root);
  } catch (e) {
    process.stderr.write(`[api] view regen failed for ${root}: ${(e && e.message) || e}\n`);
  }
  await hydrate({ root, dbPath: config.dbPath });
}

export async function postComment(config, project, id, { text, author }) {
  const root = requireWritableRoot(project);
  if (!author || !String(author).trim()) throw new ApiError(STATUS.BAD_REQUEST, 'author is required', 'bad_request');
  if (text === undefined || !String(text).trim()) throw new ApiError(STATUS.BAD_REQUEST, 'text is required', 'bad_request');
  let result;
  try {
    result = tComment(root, id, text, { author });
  } catch (e) {
    throw mapWriteError(e);
  }
  await afterWrite(config, root);
  return { id, ref: result.ref, ordinal: result.ordinal, mentions: result.mentions, spilled: result.spilled };
}

const UAT_LINE = /^uat:\s*(\w+)/m;

// The evidence floor keyed on the TARGET status (t.mjs's evidenceFloor keys on the file's
// CURRENT status; here we gate the transition BEFORE it lands). Reuses t.mjs's exported
// EVIDENCE_PATTERNS / NO_TEST_ESCAPE so the grammar is defined in exactly one place.
function assertEvidenceFloor(text, uatDefault, target, id) {
  const uat = (text.match(UAT_LINE) || [])[1] || uatDefault;
  const closing = uat === 'required' ? 'review' : 'done';
  if (target !== closing) return;
  const hasEvidence = EVIDENCE_PATTERNS.some((re) => re.test(text));
  const hasEscape = NO_TEST_ESCAPE.test(text);
  if (!hasEvidence && !hasEscape) {
    throw new ApiError(
      STATUS.UNPROCESSABLE,
      `evidence floor: cannot move ${id} to ${target} without a test artifact ` +
        '(a test path, a suite-run reference, or a fixing commit) — or a [no-test: reason] note',
      'evidence_floor',
    );
  }
}

export async function setTicketStatus(config, project, id, { status, agent }) {
  const root = requireWritableRoot(project);
  if (!status || !String(status).trim()) throw new ApiError(STATUS.BAD_REQUEST, 'status is required', 'bad_request');
  let result;
  try {
    const { text } = findTicket(root, id);
    assertEvidenceFloor(text, readConfig(root).uatDefault, status, id);
    // Deliberately NO human flag: the API acts as an agent, so a human_only transition (e.g.
    // `done` in a uat=required project) is REFUSED by setStatus and mapped to 403 — the
    // maintainer's call stays the maintainer's.
    const note = agent ? `status set via web API (agent: ${agent})` : 'status set via web API';
    result = setStatus(root, id, status, { note });
  } catch (e) {
    throw mapWriteError(e);
  }
  await afterWrite(config, root);
  return { id: result.id, from: result.from, to: result.to, archived: result.archived, warnings: result.warnings };
}
