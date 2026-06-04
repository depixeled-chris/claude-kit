// db-engine.mjs — the SQLite engine cascade for the KIT-T004 query cache.
//
// Resolution order (maintainer-decided in KIT-T004): a real native engine if the host
// has one, else Node's built-in, else nothing — and callers degrade to a markdown scan.
//   1. better-sqlite3  (fast native; used if `npm i` brought it in)
//   2. node:sqlite     (built in on Node 22+; experimental, but zero-install)
//   3. null            (neither present) → hydration is impossible; queries fall back
//
// Both engines are wrapped to ONE tiny interface so hydrate/query code never branches on
// which one it got:  exec(sql) · run(sql, params) · all(sql, params) · close().
// This is the cache's only hard dependency surface — keep it this narrow.

let cached;

async function tryBetterSqlite() {
  try {
    const mod = await import('better-sqlite3');
    const Database = mod.default || mod;
    return (path) => {
      const db = new Database(path);
      return {
        name: 'better-sqlite3',
        exec: (sql) => db.exec(sql),
        run: (sql, params = []) => db.prepare(sql).run(...params),
        all: (sql, params = []) => db.prepare(sql).all(...params),
        close: () => db.close(),
      };
    };
  } catch {
    return null;
  }
}

async function tryNodeSqlite() {
  try {
    // node:sqlite is experimental; the warning is noise for a CLI cache tool, so mute it
    // for the duration of the import rather than spam every invocation.
    const prev = process.emitWarning;
    process.emitWarning = (...args) => {
      if (String(args[0]).includes('SQLite')) return;
      return prev.apply(process, args);
    };
    const { DatabaseSync } = await import('node:sqlite');
    process.emitWarning = prev;
    return (path) => {
      const db = new DatabaseSync(path);
      return {
        name: 'node:sqlite',
        exec: (sql) => db.exec(sql),
        run: (sql, params = []) => db.prepare(sql).run(...params),
        all: (sql, params = []) => db.prepare(sql).all(...params),
        close: () => db.close(),
      };
    };
  } catch {
    return null;
  }
}

// Returns an `open(path) -> handle` factory for the best available engine, or null when
// no SQLite engine exists at all. Memoized — the probe runs once per process.
export async function resolveEngine() {
  if (cached !== undefined) return cached;
  cached = (await tryBetterSqlite()) || (await tryNodeSqlite()) || null;
  return cached;
}

export async function engineName() {
  const e = await resolveEngine();
  if (!e) return null;
  // Open an in-memory db purely to read back the wrapper's name without touching disk.
  const probe = e(':memory:');
  const n = probe.name;
  probe.close();
  return n;
}
