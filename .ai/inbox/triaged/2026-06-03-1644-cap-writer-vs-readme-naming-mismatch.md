(bug) inbox cap-writer disagrees with inbox/README.md naming standard.

README documents `YYYY-MM-DD-HHMM-<slug>.md` (4-digit time). Actual files use a
2-digit counter instead of HHMM, e.g. `2026-06-02-00-...`, `-02-`, `-03-`. So `cap`
(or whatever writes inbox files) and the README disagree — pick one and make them
match. Separately (design call, not a bug): inbox is intentionally OUTSIDE the
KEY-T### id space (pre-triage buffer, items get ids only when promoted) — confirm
that's the desired convention or adopt a key-prefixed scheme. Surfaced 2026-06-03;
relates to KIT request-ratchet Layer 1 (INBOX standardization).
