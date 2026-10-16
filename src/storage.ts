import { useSyncExternalStore } from 'react';
import { validateTrip, type Trip } from './schema';

/** All trips live in this browser's localStorage under one key. */
const KEY = 'trip-viewer:v1';

export type Entry = { trip: Trip; savedAt: string };
type Store = { trips: Record<string, Entry>; active?: string };

let cache: Store = read();
let version = 0;
const listeners = new Set<() => void>();

function read(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object' && raw.trips) {
      // trips saved by an older version of the site are upgraded to the current format on read
      const store = raw as Store;
      for (const [id, e] of Object.entries(store.trips)) {
        if ((e.trip as { version?: number }).version === 2) continue;
        const r = validateTrip(e.trip);
        if (r.ok) store.trips[id] = { ...e, trip: r.trip };
        else delete store.trips[id];
      }
      return store;
    }
  } catch {
    /* empty or blocked storage */
  }
  return { trips: {} };
}

function commit(next: Store) {
  localStorage.setItem(KEY, JSON.stringify(next)); // throws on quota or blocked storage
  cache = next;
  version++;
  listeners.forEach(l => l());
}

window.addEventListener('storage', e => {
  if (e.key !== KEY) return;
  cache = read();
  version++;
  listeners.forEach(l => l());
});

export const store = {
  list(): Entry[] {
    return Object.values(cache.trips).sort((a, b) => a.trip.start.localeCompare(b.trip.start));
  },
  get(id: string): Entry | undefined {
    return cache.trips[id];
  },
  has(id: string) {
    return Boolean(cache.trips[id]);
  },
  save(trip: Trip) {
    commit({ ...cache, trips: { ...cache.trips, [trip.id]: { trip, savedAt: new Date().toISOString() } } });
  },
  remove(id: string) {
    const trips = { ...cache.trips };
    delete trips[id];
    commit({ ...cache, trips, active: cache.active === id ? undefined : cache.active });
  },
  active(): string | undefined {
    return cache.active && cache.trips[cache.active] ? cache.active : store.list()[0]?.trip.id;
  },
  setActive(id: string) {
    if (cache.active !== id) commit({ ...cache, active: id });
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/** Re-renders the component whenever any trip changes (in this tab or another). */
export function useStoreVersion() {
  return useSyncExternalStore(store.subscribe, () => version);
}
