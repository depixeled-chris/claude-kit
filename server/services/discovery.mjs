// Project discovery — the SAME cross-project enumeration survey.mjs walks: the machine
// registry + the claude-kit-data central notebooks (projectAiDirs, hooks/lib.mjs). Each
// project resolves to { key, name, root, aiDir }:
//   - key  = the id-prefix scope (config ids.key) — the URL segment and the cache `scope`.
//   - name = the registry/central folder name.
//   - root = the repo whose <root>/.ai IS this store (writes need it); null for a
//            central-only notebook with no local repo — reads still work, writes 4xx.
// A Discovery is an object exposing listProjects(); the registry-backed one is production,
// createStaticDiscovery injects a fixed list for tests (never the real registry).

import { dirname } from 'node:path';
import { projectAiDirs } from '../../hooks/lib.mjs';
import { readIdConfig } from '../../scripts/id-utils.mjs';
import { notFound } from '../lib/errors.mjs';

const IN_REPO_AI = /[\\/]\.ai$/; // an in-repo store dir ends in `.ai`; central data does not

export function toProject({ name, aiDir }) {
  const root = IN_REPO_AI.test(aiDir) ? dirname(aiDir) : null;
  const { key } = readIdConfig(root || aiDir, aiDir);
  return { key: key || name, name, root, aiDir };
}

export function createRegistryDiscovery() {
  return {
    listProjects() {
      return projectAiDirs().map(toProject);
    },
  };
}

export function createStaticDiscovery(projects) {
  return { listProjects: () => projects.slice() };
}

// Resolve a URL :key segment to its project, or throw a typed 404. Case-insensitive on the
// key so a lowercase URL segment still finds an UPPER-cased scope.
export function resolveProject(discovery, key) {
  const lc = String(key || '').toLowerCase();
  const hit = discovery.listProjects().find((p) => p.key.toLowerCase() === lc);
  if (!hit) throw notFound(`unknown project '${key}'`);
  return hit;
}
