// Descarga los puntos de interés (POIs) de OpenStreetMap para el bbox.
// Se usa para ubicar los 12 POIs del proyecto y colocar cubos de referencia.
// Uso: node scripts/fetch_pois.mjs  →  data/raw/pois.json

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BBOX } from './lib/config.mjs';
import { fetchOverpass } from './lib/overpass.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'raw', 'pois.json');

const { south, west, north, east } = BBOX;
const query =
  `[out:json][timeout:60];` +
  `(` +
  `nwr["amenity"~"place_of_worship|townhall|marketplace|doctors|clinic|hospital|school|college"](${south},${west},${north},${east});` +
  `nwr["railway"~"station|halt"](${south},${west},${north},${east});` +
  `nwr["leisure"~"sports_centre|stadium|pitch"](${south},${west},${north},${east});` +
  `nwr["historic"~"castle|ruins|fort|tower"](${south},${west},${north},${east});` +
  `nwr["man_made"="tower"](${south},${west},${north},${east});` +
  `nwr["building"~"church|townhall|train_station|school"](${south},${west},${north},${east});` +
  `);` +
  `out center tags;`;

const json = await fetchOverpass(query);

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(json));

// Resumen en consola: POIs con nombre + posición.
const named = json.elements.filter((e) => e.tags?.name);
console.log(`✓ POIs descargados: ${json.elements.length} elementos (${named.length} con nombre)`);
for (const e of named) {
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  if (lat == null || lon == null) continue;
  const t = e.tags;
  const kind = t.amenity || t.railway || t.leisure || t.historic || t.man_made || t.building || t.tourism || '?';
  console.log(`  ${t.name}  [${kind}]  ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
}
console.log(`  -> ${OUT}`);
