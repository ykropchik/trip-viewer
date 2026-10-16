// Usage: npm run validate -- path/to/trip.json [more.json]
import { build } from 'esbuild';
import { mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

mkdirSync('node_modules/.cache', { recursive: true });
const out = 'node_modules/.cache/schema.mjs';
await build({ entryPoints: ['src/schema.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' });
const { validateTrip } = await import(pathToFileURL(out).href + '?t=' + Date.now());

const files = process.argv.slice(2);
if (!files.length) {
  console.log('Usage: npm run validate -- path/to/trip.json');
  process.exit(1);
}
let failed = false;
for (const f of files) {
  const r = validateTrip(readFileSync(f, 'utf8'));
  if (r.ok) console.log(`✓ ${f}`);
  else {
    failed = true;
    console.log(`✗ ${f}`);
    for (const e of r.errors) console.log(`  ${e.path || '(root)'}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
