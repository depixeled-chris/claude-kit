---
id: KIT-D030
title: "No config vapor: a config knob exists only when software implements it"
date: 2026-06-09
supersedes:
source: conversation 2026-06-09 (full-plugin process review)
---

**Decision:** Config keys must be backed by an implementation. Concretely (executed in
KIT-T069): the `drain.groomer` knob is REMOVED until a groomer exists; `native_task_sync`
is SLIMMED to what /work actually does (mirror acceptance criteria into native tasks) and
the unused sync-tasks.mjs machinery drops out of the spec. Standing rule for future
config: ship the knob WITH the code, or don't ship the knob.

**Why:** Unbacked config reads as capability and erodes trust in the file that is
explicitly "the brain" — the maintainer can't tell which knobs do anything. The review
found `groomer:` had zero implementation anywhere and the elaborate native_task_sync
spec had no invoker. Rejected: implementing both as spec'd (real work with no current
demand); leaving them documented-aspirational (that's the trust leak itself).
