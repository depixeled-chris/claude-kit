// identity.mjs — the HUMAN identity resolver (KIT-T145), the mirror of comments.resolveAgent.
//
// The maintainer is a ROLE (`user`) with a configurable alias, never a hardcoded name: a
// hardcoded personal name makes the kit unusable for anyone else. The alias resolves the same
// way $KIT_AGENT does — env first (a session can declare who it acts for), then machine config,
// then a generic literal — so no code outside .ai/ ever needs to name the person.
//
//   env KIT_USER  →  registry `user` field (~/.claude/claude-kit-projects.json)  →  'user'
//
// The registry is machine-local and uncommitted (paths differ per machine); the alias lives
// there, not in the repo, so the name is never committed to code. Consumed by /api/me, the
// write endpoints' author/agent default, and the CLI's default comment author.

import { readRegistry } from '../hooks/lib.mjs';

// The generic fallback — a real personal alias always overrides it, but 'user' is what a
// fresh checkout with no configured alias reports, and it is deliberately NOT a personal name.
export const DEFAULT_USER = 'user';

export function resolveUser(env = process.env) {
  const fromEnv = (env.KIT_USER || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const reg = readRegistry();
    if (reg && typeof reg.user === 'string' && reg.user.trim()) return reg.user.trim();
  } catch {
    /* registry unreadable — fall through to the generic role literal */
  }
  return DEFAULT_USER;
}
