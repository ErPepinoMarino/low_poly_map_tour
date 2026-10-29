// Descarga el trazado de calles (vías "highway") de OpenStreetMap para el bbox.
// Fuente: Overpass API (gratis, licencia ODbL — requiere atribución).
// Uso: node scripts/fetch_osm.mjs  →  data/raw/osm.json

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BBOX } from './lib/config.mjs';
import { fetchOverpass } from './lib/overpass.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'raw', 'osm.json');

const query =
  `[out:json][timeout:60];` +
  `way["highway"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});` +
  `out geom;`;

const json = await fetchOverpass(query);
const ways = json.elements.filter((e) => e.type === 'way');

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(json));

console.log(`✓ OSM descargado: ${ways.length} vías (highway) en el bbox`);
console.log(`  -> ${OUT}`);
