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
import { EXAGGERATION, QUANTIZE_STEP, STREET_WIDTH, STREET_OFFSET, NOISE_TILE } from './lib/config.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEM = path.join(ROOT, 'data', 'raw', 'almenara_mdt05.tif');
const OSM = path.join(ROOT, 'data', 'raw', 'osm.json');
const OUT = path.join(ROOT, 'public', 'models', 'streets.glb');

const dem = await loadDem(DEM);
const drape = makeDrape(dem, EXAGGERATION, QUANTIZE_STEP);
const osm = JSON.parse(await readFile(OSM, 'utf8'));

const positions = [];
const indices = [];
const uvs = [];
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
    const x0 = a[0] - px * hw;
    const z0 = a[2] - pz * hw;
    const x1 = a[0] + px * hw;
    const z1 = a[2] + pz * hw;
    const x2 = b[0] - px * hw;
    const z2 = b[2] - pz * hw;
    const x3 = b[0] + px * hw;
    const z3 = b[2] + pz * hw;
    positions.push(x0, a[1], z0, x1, a[1], z1, x2, b[1], z2, x3, b[1], z3);
    uvs.push(
      x0 / NOISE_TILE, z0 / NOISE_TILE,
      x1 / NOISE_TILE, z1 / NOISE_TILE,
      x2 / NOISE_TILE, z2 / NOISE_TILE,
      x3 / NOISE_TILE, z3 / NOISE_TILE,
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
const uv = document.createAccessor('TEXCOORD_0').setType('VEC2').setArray(new Float32Array(uvs)).setBuffer(buffer);
const primitive = document.createPrimitive().setAttribute('POSITION', pos).setAttribute('TEXCOORD_0', uv).setIndices(idx);
document.createScene().addChild(document.createNode('streets').setMesh(document.createMesh('streets').addPrimitive(primitive)));

await mkdir(path.dirname(OUT), { recursive: true });
const io = new NodeIO();
await io.write(OUT, document);

console.log(`✓ Calles: ${ways} vías → ${indices.length / 3} triángulos`);
console.log('  Tipos:', [...byType.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
console.log(`  -> ${OUT}`);
