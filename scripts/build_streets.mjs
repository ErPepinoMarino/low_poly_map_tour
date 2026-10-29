// Convierte las vías de OSM en cintas de referencia (GLB) drapadas sobre el terreno.
//
// - Proyecta cada calle a metros locales (scripts/lib/geo.mjs).
// - "Drapa" la altura con los MISMOS parámetros que el terreno (exageración + cuantizado),
//   para que las cintas se asienten sobre la malla horneada.
// - Genera una cinta fina (STREET_WIDTH) por segmento de calle, con un pequeño
//   offset vertical (STREET_OFFSET) para evitar z-fighting.
// - Exporta un GLB con mallas normales (triángulos): se abre en Blender y three.js.
//
// Uso: node scripts/build_streets.mjs
// Entrada: data/raw/osm.json + data/raw/almenara_mdt05.tif
// Salida: public/models/streets.glb

import { mkdir, readFile } from 'node:fs/promises';
import { Document, NodeIO } from '@gltf-transform/core';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadDem, makeDrape } from './lib/dem.mjs';
import { toLocalMeters } from './lib/geo.mjs';
import { EXAGGERATION, QUANTIZE_STEP, STREET_WIDTH, STREET_OFFSET } from './lib/config.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEM = path.join(ROOT, 'data', 'raw', 'almenara_mdt05.tif');
const OSM = path.join(ROOT, 'data', 'raw', 'osm.json');
const OUT = path.join(ROOT, 'public', 'models', 'streets.glb');

const dem = await loadDem(DEM);
const drape = makeDrape(dem, EXAGGERATION, QUANTIZE_STEP);
const osm = JSON.parse(await readFile(OSM, 'utf8'));

const positions = [];
const indices = [];
const byType = new Map();
let base = 0;
let ways = 0;

for (const el of osm.elements) {
  if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;

  const tag = el.tags?.highway ?? 'unknown';
  byType.set(tag, (byType.get(tag) ?? 0) + 1);

  const pts = el.geometry.map(({ lat, lon }) => {
    const { x, z } = toLocalMeters(lon, lat);
    return [x, drape(x, z) + STREET_OFFSET, z];
  });

  const hw = STREET_WIDTH / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    let dx = b[0] - a[0];
    let dz = b[2] - a[2];
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    const px = -dz; // perpendicular en XZ
    const pz = dx;
    positions.push(
      a[0] - px * hw, a[1], a[2] - pz * hw,
      a[0] + px * hw, a[1], a[2] + pz * hw,
      b[0] - px * hw, b[1], b[2] - pz * hw,
      b[0] + px * hw, b[1], b[2] + pz * hw,
    );
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    base += 4;
  }
  ways++;
}

const document = new Document();
const buffer = document.createBuffer();
const pos = document.createAccessor('POSITION').setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer);
const idx = document.createAccessor('INDICES').setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buffer);
const primitive = document.createPrimitive().setAttribute('POSITION', pos).setIndices(idx);
document.createScene().addChild(document.createNode('streets').setMesh(document.createMesh('streets').addPrimitive(primitive)));

await mkdir(path.dirname(OUT), { recursive: true });
const io = new NodeIO();
await io.write(OUT, document);

console.log(`✓ Calles: ${ways} vías → ${indices.length / 3} triángulos`);
console.log('  Tipos:', [...byType.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
console.log(`  -> ${OUT}`);
