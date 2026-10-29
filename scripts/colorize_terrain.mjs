// Re-aplica vertex colors (por cobertura) + UVs (ruido) a una malla de terreno.
//
// Motivo: el Decimate/export de Blender pierde los vertex colors, así que el
// color no se depende de Blender: la FORMA se edita en Blender y el COLOR se
// re-aplica aquí, procedimentalmente, cada vez que exportes.
//
// Uso: node scripts/colorize_terrain.mjs
// Entrada/salida: public/models/terrain.glb (se sobreescribe con colores + UVs)

import { Document, NodeIO } from '@gltf-transform/core';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadLandcover } from './lib/landcover.mjs';
import { boxBlurRGB } from './lib/blur.mjs';
import { COLOR_BLUR_RADIUS, COLOR_BLUR_PASSES, NOISE_TILE } from './lib/config.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANDCOVER = path.join(ROOT, 'data', 'raw', 'landcover.json');
const FILE = path.join(ROOT, 'public', 'models', 'terrain.glb');

const GRID = 256; // resolución de la rejilla de color

// 1. Leer la geometría del GLB (posiciones + índices, todas las mallas).
const io = new NodeIO();
const doc = await io.read(FILE);
const positions = [];
const indices = [];
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION').getArray();
    const idx = prim.getIndices()?.getArray();
    const base = positions.length / 3;
    for (let i = 0; i < pos.length; i++) positions.push(pos[i]);
    if (idx) {
      for (let i = 0; i < idx.length; i++) indices.push(base + idx[i]);
    }
  }
}
const vertexCount = positions.length / 3;

// 2. Bounds del terreno (en metros locales).
let xMin = Infinity;
let xMax = -Infinity;
let zMin = Infinity;
let zMax = -Infinity;
for (let i = 0; i < positions.length; i += 3) {
  const x = positions[i];
  const z = positions[i + 2];
  if (x < xMin) xMin = x;
  if (x > xMax) xMax = x;
  if (z < zMin) zMin = z;
  if (z > zMax) zMax = z;
}

// 3. Rasterizar cobertura + difuminar.
const landcover = await loadLandcover(LANDCOVER);
const grid = new Float32Array(GRID * GRID * 3);
for (let gy = 0; gy < GRID; gy++) {
  for (let gx = 0; gx < GRID; gx++) {
    const x = xMin + (gx / (GRID - 1)) * (xMax - xMin);
    const z = zMin + (gy / (GRID - 1)) * (zMax - zMin);
    const c = landcover.colorAt(x, z);
    const o = (gy * GRID + gx) * 3;
    grid[o] = c[0];
    grid[o + 1] = c[1];
    grid[o + 2] = c[2];
  }
}
const blurred = boxBlurRGB(grid, GRID, GRID, COLOR_BLUR_RADIUS, COLOR_BLUR_PASSES);

// 4. Color (bilinear) + UV por vértice.
const colors = new Float32Array(vertexCount * 3);
const uvs = new Float32Array(vertexCount * 2);
for (let i = 0; i < vertexCount; i++) {
  const x = positions[i * 3];
  const z = positions[i * 3 + 2];
  const fx = ((x - xMin) / (xMax - xMin)) * (GRID - 1);
  const fz = ((z - zMin) / (zMax - zMin)) * (GRID - 1);
  const gx = Math.max(0, Math.min(GRID - 2, Math.floor(fx)));
  const gz = Math.max(0, Math.min(GRID - 2, Math.floor(fz)));
  const tx = fx - gx;
  const tz = fz - gz;
  const o00 = (gz * GRID + gx) * 3;
  const o10 = o00 + 3;
  const o01 = o00 + GRID * 3;
  const o11 = o01 + 3;
  for (let k = 0; k < 3; k++) {
    colors[i * 3 + k] =
      blurred[o00 + k] * (1 - tx) * (1 - tz) +
      blurred[o10 + k] * tx * (1 - tz) +
      blurred[o01 + k] * (1 - tx) * tz +
      blurred[o11 + k] * tx * tz;
  }
  uvs[i * 2] = x / NOISE_TILE;
  uvs[i * 2 + 1] = z / NOISE_TILE;
}

// 5. Escribir GLB nuevo (POSITION + COLOR_0 + TEXCOORD_0 + índices).
const out = new Document();
const buffer = out.createBuffer();
const pos = out.createAccessor('POSITION').setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer);
const idx = out.createAccessor('INDICES').setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buffer);
const col = out.createAccessor('COLOR_0').setType('VEC3').setArray(colors).setBuffer(buffer);
const uv = out.createAccessor('TEXCOORD_0').setType('VEC2').setArray(uvs).setBuffer(buffer);
const prim = out
  .createPrimitive()
  .setAttribute('POSITION', pos)
  .setAttribute('COLOR_0', col)
  .setAttribute('TEXCOORD_0', uv)
  .setIndices(idx);
out.createScene().addChild(out.createNode('terrain').setMesh(out.createMesh('terrain').addPrimitive(prim)));

await new NodeIO().write(FILE, out);
console.log(`✓ Terreno recoloreado: ${vertexCount} vértices, ${indices.length / 3} triángulos → ${FILE}`);
