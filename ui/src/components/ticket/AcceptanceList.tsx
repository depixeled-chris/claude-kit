// The acceptance-criteria checklist, read-only: checked state mirrors the markdown (`- [x]`), it
// is NOT editable here — criteria are ticked through the `t` CLI so the evidence trail stays in
// the store. Rendered as disabled checkboxes so the state reads at a glance without inviting edits.

import type { AcceptanceCriterion } from '../../types';

export function AcceptanceList({ items }: { items: AcceptanceCriterion[] }) {
  if (!items.length) return <p className="muted">No acceptance criteria.</p>;
  const done = items.filter((c) => c.checked).length;
  return (
    <div className="ac-list">
      <div className="ac-progress">{done}/{items.length} met</div>
      <ul>
        {items.map((c, i) => (
          <li key={i} className={c.checked ? 'ac-item checked' : 'ac-item'}>
            <input type="checkbox" checked={c.checked} readOnly disabled />
            <span>{c.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
