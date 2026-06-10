(bug) `q next-id HOD` prints `HOD-undefined149  HOD  undefined  149` — the formatted id
interpolates an undefined type segment (formatId(root, scope, type, num) with no type?).
Expected something like `HOD-T149` or an explicit "next num: 149". scripts/q.mjs:102
formatId / the next-id case (~line 556). Found 2026-06-10 while filing HOD tickets.
