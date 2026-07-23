// One place for the load → { data | error | loading } lifecycle every page repeats. `deps` drive a
// re-fetch (e.g. the route :key/:id); `reload` bumps a nonce to re-run on demand (after a
// comment/status write). The alive guard drops a stale run's result when deps change mid-flight,
// so a fast navigation never lands the wrong ticket's data.

import { useCallback, useEffect, useState } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // fn is a fresh closure each render; bind it to the caller-declared deps so the effect re-runs
  // only when they (or a reload) change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    run()
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'request failed'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [run, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}
