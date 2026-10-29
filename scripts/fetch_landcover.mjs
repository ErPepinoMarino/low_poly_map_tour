// Descarga la cobertura del suelo (landuse/natural) de OpenStreetMap para el bbox.
// Se usa para colorear el terreno por zonas (vertex colors).
// Uso: node scripts/fetch_landcover.mjs  →  data/raw/landcover.json

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BBOX } from './lib/config.mjs';
import { fetchOverpass } from './lib/overpass.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'raw', 'landcover.json');

const { south, west, north, east } = BBOX;
const query =
  `[out:json][timeout:60];` +
  `(` +
  `way["landuse"](${south},${west},${north},${east});` +
  `way["natural"](${south},${west},${north},${east});` +
  `);` +
  `out geom;`;

const json = await fetchOverpass(query);
const ways = json.elements.filter((e) => e.type === 'way');

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(json));

console.log(`✓ Cobertura descargada: ${ways.length} polígonos (landuse/natural)`);
console.log(`  -> ${OUT}`);
