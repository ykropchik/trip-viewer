import { validateTrip, type Trip } from './schema';
import { store } from './storage';

/**
 * Programmatic access for agents (Claude driving the browser) and the console.
 *
 *   tripPlanner.list()                → [{ id, title, start, end, savedAt }]
 *   tripPlanner.get(id)               → trip JSON or null
 *   tripPlanner.validate(json)        → { ok, errors? }
 *   tripPlanner.save(json, { open })  → { ok, id } | { ok: false, errors }
 *   tripPlanner.remove(id)            → boolean
 *   tripPlanner.open(id, date?)       → shows a trip (optionally a day, YYYY-MM-DD)
 *   tripPlanner.schemaUrl             → '/trip.schema.json'
 *
 * The same operations are registered as WebMCP tools when the browser exposes navigator.modelContext.
 */

type SaveResult = { ok: true; id: string } | { ok: false; errors: { path: string; message: string }[] };

function save(json: unknown, opts: { open?: boolean } = {}): SaveResult {
  const r = validateTrip(json);
  if (!r.ok) return r;
  try {
    store.save(r.trip);
  } catch (e) {
    return { ok: false, errors: [{ path: '', message: `Не удалось сохранить в браузере: ${(e as Error).message}` }] };
  }
  if (opts.open !== false) open(r.trip.id);
  return { ok: true, id: r.trip.id };
}

function open(id: string, date?: string) {
  if (!store.has(id)) return false;
  store.setActive(id);
  location.hash = date ? `#/t/${id}/${date}` : `#/t/${id}`;
  return true;
}

export const api = {
  version: 1,
  schemaUrl: '/trip.schema.json',
  list: () => store.list().map(e => ({ id: e.trip.id, title: e.trip.title, start: e.trip.start, end: e.trip.end, savedAt: e.savedAt })),
  get: (id: string): Trip | null => store.get(id)?.trip ?? null,
  validate: (json: unknown) => {
    const r = validateTrip(json);
    return r.ok ? { ok: true as const } : r;
  },
  save,
  remove: (id: string) => {
    if (!store.has(id)) return false;
    store.remove(id);
    return true;
  },
  open,
};

declare global {
  interface Window {
    tripPlanner: typeof api;
  }
}

type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: object;
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown;
};

const text = (v: unknown) => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v) }] });

export function installApi() {
  window.tripPlanner = api;

  const tools: WebMcpTool[] = [
    {
      name: 'list_trips',
      description: 'List trips saved in this browser.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => text(api.list()),
    },
    {
      name: 'get_trip',
      description: 'Return the full JSON of a saved trip.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      execute: ({ id }) => text(api.get(String(id)) ?? `No trip with id "${id}"`),
    },
    {
      name: 'save_trip',
      description: 'Validate and save a trip JSON (creates or replaces by id). Returns validation errors if any. Schema: /trip.schema.json',
      inputSchema: { type: 'object', properties: { trip: { type: 'object' } }, required: ['trip'] },
      execute: ({ trip }) => text(api.save(trip)),
    },
    {
      name: 'get_trip_schema',
      description: 'Return the JSON Schema of the trip format.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => text(await (await fetch('/trip.schema.json')).text()),
    },
  ];

  // WebMCP is an early proposal; register only when the browser offers it, and never let it break the page.
  const mc = (navigator as unknown as { modelContext?: { registerTool?: (t: WebMcpTool) => void; provideContext?: (c: { tools: WebMcpTool[] }) => void } }).modelContext;
  if (!mc) return;
  try {
    if (typeof mc.provideContext === 'function') mc.provideContext({ tools });
    else if (typeof mc.registerTool === 'function') tools.forEach(t => mc.registerTool!(t));
  } catch (e) {
    console.warn('WebMCP registration failed', e);
  }
}
