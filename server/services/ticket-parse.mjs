// Pure parsers over a ticket's markdown BODY (the frontmatter-stripped text the cache stores
// in items_fts). Splits the named sections and reads acceptance-criteria checkbox state — no
// I/O, no SQLite, so it is trivially unit-testable and shared by the detail assembler.

// Text of the `## <heading>` section: everything until the next `## ` heading or EOF, trimmed.
export function sectionText(body, heading) {
  const lines = String(body || '').split('\n');
  const head = `## ${heading}`;
  const start = lines.findIndex((l) => l.trim() === head);
  if (start === -1) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^## /.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

// Acceptance-criteria checkboxes, in order: `- [ ] text` / `- [x] text` under the AC section.
export function parseAcceptance(body) {
  const section = sectionText(body, 'Acceptance Criteria');
  const out = [];
  for (const line of section.split('\n')) {
    const m = line.match(/^\s*-\s*\[([ xX])\]\s*(.*)$/);
    if (!m) continue;
    out.push({ text: m[2].trim(), checked: m[1].toLowerCase() === 'x' });
  }
  return out;
}

export function parseTicketBody(body) {
  return {
    description: sectionText(body, 'Description'),
    acceptanceCriteria: parseAcceptance(body),
    notes: sectionText(body, 'Notes'),
  };
}
