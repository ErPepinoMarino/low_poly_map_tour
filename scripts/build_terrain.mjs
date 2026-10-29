// Convierte el GeoTIFF del MDT05 en una malla low-poly de terreno (GLB).
//
// Pasos:
//   1. Lee el GeoTIFF (rejilla de alturas).
//   2. Proyecta a "metros locales" (scripts/lib/geo.mjs).
//   3. Remuestrea a una rejilla uniforme de RESOLUTION metros.
//   4. Exagera verticalmente + cuantiza en terrazas (scripts/lib/config.mjs).
//   5. Escribe el GLB (solo posiciones + índices; flat shading en la app).
//
// Uso: node scripts/build_terrain.mjs
// Entrada: data/raw/almenara_mdt05.tif
// Salida: public/models/terrain.glb

import { mkdir } from 'node:fs/promises';
import { Document, NodeIO } from '@gltf-transform/core';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadDem, makeDrape } from './lib/dem.mjs';
import { toLocalMeters } from './lib/geo.mjs';
import { RESOLUTION, EXAGGERATION, QUANTIZE_STEP } from './lib/config.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const IN = path.join(ROOT, 'data', 'raw', 'almenara_mdt05.tif');
const OUT = path.join(ROOT, 'public', 'models', 'terrain.glb');

const dem = await loadDem(IN);
const drape = makeDrape(dem, EXAGGERATION, QUANTIZE_STEP);

// Elevación real (informe).
let minRaw = Infinity;
let maxRaw = -Infinity;
for (let i = 0; i < dem.data.length; i++) {
  const v = dem.data[i];
  if (v === dem.nodata || Number.isNaN(v)) continue;
  if (v < minRaw) minRaw = v;
  if (v > maxRaw) maxRaw = v;
}
console.log(`Elevación real: ${minRaw.toFixed(1)} m → ${maxRaw.toFixed(1)} m`);

// Bbox del terreno a metros locales.
const [west, south, east, north] = dem.bbox;
const corners = [toLocalMeters(west, north), toLocalMeters(east, north), toLocalMeters(west, south), toLocalMeters(east, south)];
const xMin = Math.min(...corners.map((p) => p.x));
const xMax = Math.max(...corners.map((p) => p.x));
const zMin = Math.min(...corners.map((p) => p.z));
const zMax = Math.max(...corners.map((p) => p.z));

const nx = Math.max(2, Math.round((xMax - xMin) / RESOLUTION));
const nz = Math.max(2, Math.round((zMax - zMin) / RESOLUTION));
console.log(`Rejilla: ${nx}×${nz} celdas (${(xMax - xMin).toFixed(0)} m × ${(zMax - zMin).toFixed(0)} m)`);

const positions = [];
for (let iz = 0; iz <= nz; iz++) {
  const z = zMin + iz * RESOLUTION;
  for (let ix = 0; ix <= nx; ix++) {
    const x = xMin + ix * RESOLUTION;
    positions.push(x, drape(x, z), z);
  }
}

const indices = [];
for (let iz = 0; iz < nz; iz++) {
  for (let ix = 0; ix < nx; ix++) {
    const a = iz * (nx + 1) + ix;
    const b = a + 1;
    const c = a + (nx + 1);
    const d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
}

const document = new Document();
const buffer = document.createBuffer();
const pos = document.createAccessor('POSITION').setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer);
const idx = document.createAccessor('INDICES').setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buffer);
const primitive = document.createPrimitive().setAttribute('POSITION', pos).setIndices(idx);
document.createScene().addChild(document.createNode('terrain').setMesh(document.createMesh('terrain').addPrimitive(primitive)));

await mkdir(path.dirname(OUT), { recursive: true });
const io = new NodeIO();
await io.write(OUT, document);

console.log(`✓ Terreno: ${positions.length / 3} vértices, ${indices.length / 3} triángulos → ${OUT}`);
