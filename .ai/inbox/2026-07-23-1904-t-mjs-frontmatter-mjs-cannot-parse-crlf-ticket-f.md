(bug) t.mjs / frontmatter.mjs cannot parse CRLF ticket files: status/comment fail with 'no frontmatter block to update'. Lived: GG-T076..T079 (written 2026-07-14 on Windows) were un-updatable until hand-normalized to LF. Fix: frontmatter parser accepts \r?\n line endings (and/or t.mjs normalizes on write). Note these four also sat in status 'superseded' with empty superseded_by - check whether the CRLF parse failure is HOW they got a wrong status the indexer could not correct.


ADDENDUM (same session): root cause confirmed - claude-kit-data checkouts on this machine run core.autocrlf=true (git warned LF-will-be-CRLF on every ticket file at commit 50d81b2). So ANY fresh checkout / git touch converts ALL ticket files to CRLF and t.mjs stops being able to update them. Fix must be parser-side (accept ?
) AND repo-side (.gitattributes: *.md text eol=lf in claude-kit-data).
