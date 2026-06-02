#!/usr/bin/env node
// init-project.mjs — scaffold the .ai/ workflow into a repo.
//
//   node /path/to/claude-kit/scripts/init-project.mjs [target-dir]
//
// Target defaults to the current directory. Idempotent and non-destructive:
//   - copies project-template/.ai/ in, but never overwrites an existing .ai/
//   - appends CLAUDE.snippet.md to the target's CLAUDE.md (creates it if absent),
//     but only once (guarded by a marker)
//   - ensures .gitignore excludes secret/local files

import {
  existsSync, mkdirSync, readdirSync, statSync,
  copyFileSync, readFileSync, writeFileSync, appendFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = join(KIT, "project-template");
const target = resolve(process.argv[2] || process.cwd());
const MARKER = "## Workflow contract (.ai/)";

function copyDir(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = join(src, entry), d = join(dst, entry);
    if (statSync(s).isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

// 1. .ai/ — never clobber an existing one
const aiDst = join(target, ".ai");
if (existsSync(aiDst)) {
  console.log("• .ai/ already exists — left untouched");
} else {
  copyDir(join(TEMPLATE, ".ai"), aiDst);
  console.log("• .ai/ scaffolded");
}

// 2. CLAUDE.md — append the contract once
const claudeMd = join(target, "CLAUDE.md");
const snippet = readFileSync(join(TEMPLATE, "CLAUDE.snippet.md"), "utf8");
const existing = existsSync(claudeMd) ? readFileSync(claudeMd, "utf8") : "";
if (existing.includes(MARKER)) {
  console.log("• CLAUDE.md already has the workflow contract — skipped");
} else if (existing) {
  appendFileSync(claudeMd, "\n\n" + snippet);
  console.log("• workflow contract appended to CLAUDE.md");
} else {
  writeFileSync(claudeMd, "# Project\n\n" + snippet);
  console.log("• CLAUDE.md created with the workflow contract");
}

// 3. .gitignore — keep secrets/local out of git
const gi = join(target, ".gitignore");
const wants = [".ai/SECRETS*", "CLAUDE.local.md", ".claude/settings.local.json"];
const giText = existsSync(gi) ? readFileSync(gi, "utf8") : "";
const missing = wants.filter((w) => !giText.split("\n").includes(w));
if (missing.length) {
  appendFileSync(gi, (giText && !giText.endsWith("\n") ? "\n" : "") +
    "\n# claude-kit\n" + missing.join("\n") + "\n");
  console.log(`• .gitignore updated (${missing.length} entr${missing.length === 1 ? "y" : "ies"})`);
} else {
  console.log("• .gitignore already covers secrets/local");
}

console.log(`\nDone. Next: edit ${join(".ai", "config.yml")} to taste, then capture with 'cap'.`);
