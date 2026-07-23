// The cross-project WAITING-ON-YOU board — the clickable form of /prime's waiting list. Built
// by REUSING survey.mjs's discoverProjects + scan (which folds in needsBlock), never a
// reimplementation: the CLI briefing and this endpoint answer from one scan of the same
// notebooks. `deps` is injectable for tests; production uses the real survey imports.

import { discoverProjects, scan } from '../../scripts/survey.mjs';

export function waitingBoard({ discover = discoverProjects, scanFn = scan } = {}) {
  const { projects, activeName } = discover();
  const board = [];
  for (const name of Object.keys(projects).sort()) {
    const sc = scanFn(projects[name].notebook);
    const items = [];
    for (const t of sc.review) {
      items.push({ kind: 'review', id: t.id, title: t.title, text: `${t.id} in review — awaiting your \`done\`` });
    }
    for (const q of sc.questions) items.push({ kind: 'question', id: q, text: `open question: ${q}` });
    for (const n of sc.needs) items.push({ kind: 'needs', text: n });
    if (items.length) board.push({ project: name, active: name === activeName, items });
  }
  return board;
}
