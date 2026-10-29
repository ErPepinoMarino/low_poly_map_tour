// Genera cubos de referencia en la posición de cada POI (GLB).
// Sirven para ver dónde están los POIs y evitar colisiones al redistribuir
// calles y edificios, tanto en la app como en Blender.
//
// Uso: node scripts/build_pois.mjs
// Entrada: src/data/pois.json + data/raw/almenara_mdt05.tif
// Salida: public/models/pois.glb

import { readFile, mkdir } from 'node:fs/promises';
import { Document, NodeIO } from '@gltf-transform/core';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadDem, makeDrape } from './lib/dem.mjs';
import { toLocalMeters } from './lib/geo.mjs';
import { EXAGGERATION, QUANTIZE_STEP } from './lib/config.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEM = path.join(ROOT, 'data', 'raw', 'almenara_mdt05.tif');
const POIS = path.join(ROOT, 'src', 'data', 'pois.json');
const OUT = path.join(ROOT, 'public', 'models', 'pois.glb');

const CUBE_SIZE = 20; // metros de lado del cubo
const AMBER = [0.878, 0.635, 0.235]; // #E0A23C

const dem = await loadDem(DEM);
const drape = makeDrape(dem, EXAGGERATION, QUANTIZE_STEP);
const pois = JSON.parse(await readFile(POIS, 'utf8'));

const positions = [];
const indices = [];
const colors = [];
let base = 0;

for (const poi of pois) {
  const { x, z } = toLocalMeters(poi.lon, poi.lat);
  const y = drape(x, z);
  addBox(positions, indices, colors, base, x, y + CUBE_SIZE / 2, z, CUBE_SIZE / 2, AMBER);
  base += 8;
  console.log(`  ${poi.name}: (${x.toFixed(0)}, ${z.toFixed(0)})`);
}

const document = new Document();
const buffer = document.createBuffer();
const pos = document.createAccessor('POSITION').setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer);
const idx = document.createAccessor('INDICES').setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buffer);
const col = document.createAccessor('COLOR_0').setType('VEC3').setArray(new Float32Array(colors)).setBuffer(buffer);
const primitive = document
  .createPrimitive()
  .setAttribute('POSITION', pos)
  .setAttribute('COLOR_0', col)
  .setIndices(idx);
document.createScene().addChild(document.createNode('pois').setMesh(document.createMesh('pois').addPrimitive(primitive)));

await mkdir(path.dirname(OUT), { recursive: true });
const io = new NodeIO();
await io.write(OUT, document);
console.log(`✓ ${pois.length} cubos → ${OUT}`);

function addBox(positions, indices, colors, base, cx, cy, cz, half, color) {
  const x0 = cx - half;
  const x1 = cx + half;
  const y0 = cy - half;
  const y1 = cy + half;
  const z0 = cz - half;
  const z1 = cz + half;
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
    [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
  ];
  for (const p of v) positions.push(p[0], p[1], p[2]);
  for (let i = 0; i < 8; i++) colors.push(color[0], color[1], color[2]);
  const quads = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ];
  for (const [a, b, c, d] of quads) {
    indices.push(base + a, base + b, base + c, base + c, base + d, base + a);
  }
}
