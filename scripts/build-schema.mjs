// Generates public/trip.schema.json from src/schema.ts so editors and Claude can validate trip files.
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { zodToJsonSchema } from 'zod-to-json-schema';

mkdirSync('node_modules/.cache', { recursive: true });
const out = 'node_modules/.cache/schema.mjs';
await build({ entryPoints: ['src/schema.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' });
const { TripSchema } = await import(pathToFileURL(out).href + '?t=' + Date.now());

const json = zodToJsonSchema(TripSchema, { name: 'Trip', $refStrategy: 'none' });
json.title = 'Trip';
json.description = 'Формат поездки для trip-viewer, версия 1. Связи между разделами (place, stay, category) проверяет сам сайт при импорте.';
writeFileSync('public/trip.schema.json', JSON.stringify(json, null, 2) + '\n');
console.log('public/trip.schema.json written');
