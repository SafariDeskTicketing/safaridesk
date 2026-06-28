// Module-level stale-while-revalidate cache.
// Data is returned instantly on subsequent calls; a background fetch keeps it fresh.

type Entry<T> = { data: T; ts: number };
const _store = new Map<string, Entry<unknown>>();
const TTL = 3 * 60 * 1000; // 3 minutes

export function cacheGet<T>(key: string): T | null {
  const entry = _store.get(key) as Entry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL) { _store.delete(key); return null; }
  return entry.data;
}

export function cacheSet<T>(key: string, data: T): void {
  _store.set(key, { data, ts: Date.now() } as Entry<unknown>);
}

export function cacheDelete(key: string): void {
  _store.delete(key);
}
