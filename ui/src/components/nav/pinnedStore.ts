// The pinned-tabs store (KIT-T149): which project boards stay open across sessions. Pins live in
// localStorage so they survive a reload; everything else (transient tabs) is derived from the route.
// Best-effort — a disabled/throwing storage degrades to "no pins", never breaks the nav.

const PINNED_KEY = 'kit:pinned-project-tabs';

export function loadPinned(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    const value: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function savePinned(keys: string[]): void {
  try {
    localStorage.setItem(PINNED_KEY, JSON.stringify(keys));
  } catch {
    /* storage unavailable — pins are best-effort */
  }
}
