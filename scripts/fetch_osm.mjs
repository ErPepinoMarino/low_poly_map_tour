// Descarga el trazado de calles (vías "highway") de OpenStreetMap para el bbox.
//
// Fuente: Overpass API (gratis, licencia ODbL — requiere atribución).
// Prueba varios espejos con reintentos, porque los servidores públicos de
// Overpass se saturan a menudo.
//
// Uso: node scripts/fetch_osm.mjs
// Salida: data/raw/osm.json

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BBOX } from './lib/config.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'raw', 'osm.json');

const QUERY =
  `[out:json][timeout:60];` +
  `way["highway"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});` +
  `out geom;`;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const HEADERS = {
  'User-Agent': 'low_poly_map_tour/0.1 (portfolio project)',
  Accept: 'application/json',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let json = null;
let lastErr = null;
for (const endpoint of ENDPOINTS) {
  for (let attempt = 1; attempt <= 3 && !json; attempt++) {
    try {
      const res = await fetch(`${endpoint}?data=${encodeURIComponent(QUERY)}`, { headers: HEADERS });
      if (res.ok) {
        json = await res.json();
        break;
      }
      lastErr = new Error(`HTTP ${res.status} (${endpoint})`);
    } catch (err) {
      lastErr = err;
    }
    await sleep(1500 * attempt);
  }
  if (json) break;
}
if (!json) throw new Error(`No se pudo descargar de Overpass: ${lastErr?.message}`);

const ways = json.elements.filter((e) => e.type === 'way');
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(json));

console.log(`✓ OSM descargado: ${ways.length} vías (highway) en el bbox`);
console.log(`  -> ${OUT}`);
