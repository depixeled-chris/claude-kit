#!/usr/bin/env node
// PostToolUse (Write|Edit) — language-aware linter dispatcher. Never blocks
// (always exit 0); warns to stderr and records tooling gaps. Node port of the
// bash version, which silently no-opped — its `python - <<heredoc` consumed the
// payload off stdin, so the edited file path was always empty. A living config:
// extend the per-language cases freely.
//
// Per-project override: a `.claude-tooling-ok` file at the project root silences
// the missing-tool warnings (its contents can document why).

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { payload, VENDORED, LOCKFILES, fileExt, projectRoot, have, run, logGap, nodeCli, pathExcluded } from './lib.mjs';

const HEAD_CLIPPY = 60;
const HEAD_LINT = 40;
const HEAD_FMT = 10;

const p = await payload();
const file = (p.tool_input && p.tool_input.file_path) || '';
if (!file || !existsSync(file)) process.exit(0);

const norm = file.replace(/\\/g, '/');
if (VENDORED.test(norm)) process.exit(0);
if (LOCKFILES.test(norm)) process.exit(0);
const ext = fileExt(norm);

const root = projectRoot(dirname(file));
// KIT-T051: a path glob under `lint` (or '*') exempts this file from linting.
if (pathExcluded(root, 'lint', file)) process.exit(0);
const toolingOk = existsSync(join(root, '.claude-tooling-ok'));
const hasDocker =
  existsSync(join(root, 'Dockerfile')) ||
  existsSync(join(root, 'docker-compose.yml')) ||
  existsSync(join(root, 'docker-compose.yaml')) ||
  existsSync(join(root, '.devcontainer'));

const warn = (s) => process.stderr.write(`WARN [lint] ${s}\n`);
const emit = (out, n) => {
  const body = out.split('\n').filter(Boolean).slice(0, n);
  if (body.length) process.stderr.write(body.map((l) => '  ' + l).join('\n') + '\n');
};

function missingTool(tool, hint) {
  logGap('missing-tool', file, `${tool} not available for project=${root} (${hint})`);
  if (!toolingOk) {
    warn(`${tool} not available. ${hint}`);
    warn(`(silence for this project: create ${join(root, '.claude-tooling-ok')})`);
  }
}

function venvBin(tool) {
  for (const base of ['.venv', 'venv']) {
    for (const sub of [join('Scripts', `${tool}.exe`), join('bin', tool)]) {
      const candidate = join(root, base, sub);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

switch (ext) {
  case 'py': {
    const ruff = venvBin('ruff') || (have('ruff') ? 'ruff' : null);
    if (ruff) {
      emit(run(ruff, ['check', file], root), HEAD_LINT);
      emit(run(ruff, ['format', '--check', file], root), HEAD_FMT);
    } else {
      missingTool('ruff', hasDocker ? 'Dockerized — configure ruff in the image' : 'install in venv: pip install ruff');
    }
    break;
  }
  case 'rs': {
    if (have('cargo')) {
      emit(run('cargo', ['clippy', '--quiet', '--message-format=short'], root), HEAD_CLIPPY);
      emit(run('cargo', ['fmt', '--check'], root), HEAD_LINT);
    } else {
      missingTool('cargo/clippy', hasDocker ? 'Dockerized — configure clippy in the image' : 'install Rust via rustup, then: rustup component add clippy');
    }
    break;
  }
  case 'go': {
    if (have('gofmt')) {
      const unformatted = run('gofmt', ['-l', file], root).trim();
      if (unformatted) warn(`gofmt: ${file} is not formatted. Run: gofmt -w ${file}`);
    } else {
      missingTool('gofmt', 'install Go');
    }
    if (have('go')) emit(run('go', ['vet', './...'], root), HEAD_LINT);
    if (have('golangci-lint')) emit(run('golangci-lint', ['run', file], root), HEAD_LINT);
    break;
  }
  case 'ts':
  case 'tsx':
  case 'js':
  case 'jsx':
  case 'mjs':
  case 'cjs': {
    if (!existsSync(join(root, 'package.json'))) {
      warn(`No package.json near ${file} — skipping JS/TS lint.`);
      break;
    }
    const eslint = nodeCli('eslint', root);
    if (eslint) emit(run(process.execPath, [eslint, file], root), HEAD_LINT);
    else missingTool('eslint', 'install in project: npm i -D eslint (or .claude-tooling-ok to silence)');
    const prettier = nodeCli('prettier', root);
    if (prettier) emit(run(process.execPath, [prettier, '--check', file], root), HEAD_LINT);
    break;
  }
  case 'c':
  case 'cc':
  case 'cpp':
  case 'cxx':
  case 'h':
  case 'hpp':
  case 'hxx': {
    if (have('clang-format')) emit(run('clang-format', ['--dry-run', '--Werror', file], root), HEAD_FMT);
    else missingTool('clang-format', 'install LLVM');
    if (have('clang-tidy')) {
      if (existsSync(join(root, 'compile_commands.json')) || existsSync(join(root, 'build', 'compile_commands.json'))) {
        emit(run('clang-tidy', [file, '-p', root], root), HEAD_LINT);
      } else {
        logGap('missing-tool', file, 'clang-tidy present but no compile_commands.json (-DCMAKE_EXPORT_COMPILE_COMMANDS=ON)');
      }
    } else {
      missingTool('clang-tidy', 'install LLVM');
    }
    break;
  }
  case 'sql': {
    const sqlfluff = have('sqlfluff') ? 'sqlfluff' : null;
    if (sqlfluff) {
      const args = ['lint', file];
      if (!existsSync(join(root, '.sqlfluff'))) args.splice(1, 0, '--dialect', 'ansi');
      emit(run(sqlfluff, args, root), HEAD_LINT);
    } else {
      missingTool('sqlfluff', 'install globally: pipx install sqlfluff');
    }
    break;
  }
  default:
    break;
}
process.exit(0);
