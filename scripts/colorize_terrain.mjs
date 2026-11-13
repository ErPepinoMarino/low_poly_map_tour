// Re-aplica vertex colors (por cobertura) + UVs (ruido) a una malla de terreno,
// conservando las normales de la malla editada en Blender.
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
const normals = [];
let hasNormals = true;
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION').getArray();
    const norm = prim.getAttribute('NORMAL')?.getArray();
    const idx = prim.getIndices()?.getArray();
    const base = positions.length / 3;
    for (let i = 0; i < pos.length; i++) positions.push(pos[i]);
    if (norm) {
      for (let i = 0; i < norm.length; i++) normals.push(norm[i]);
    } else {
      hasNormals = false;
    }
    if (idx) {
      for (let i = 0; i < idx.length; i++) indices.push(base + idx[i]);
    }
  }
}
const vertexCount = positions.length / 3;
if (normals.length !== positions.length) hasNormals = false;

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

// glTF COLOR_0 se interpreta en espacio lineal, mientras que la paleta se
// define en sRGB para que coincida con los colores de la escena.
const srgbToLinear = (value) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

const linear = ([r, g, b]) => [
  srgbToLinear(r),
  srgbToLinear(g),
  srgbToLinear(b),
];
const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smoothstep = (edge0, edge1, value) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const terrainNoise = (x, z) =>
  Math.sin(x * 0.021 + Math.sin(z * 0.017) * 1.8) * 0.5 +
  Math.sin(z * 0.037 + x * 0.013) * 0.3 +
  Math.sin((x + z) * 0.009) * 0.2;

// La montaña del castillo necesita una segunda lectura: falda verde, laderas
// mixtas y estratos de roca. Se hornea en los vertex colors para no añadir
// coste de render ni otra textura.
const GREEN_LOW = linear([0.47, 0.52, 0.3]);
const GREEN_MID = linear([0.6, 0.63, 0.39]);
const GREEN_DRY = linear([0.68, 0.64, 0.44]);
const ROCK_DARK = linear([0.4, 0.32, 0.24]);
const ROCK_MID = linear([0.58, 0.43, 0.3]);
const ROCK_LIGHT = linear([0.7, 0.55, 0.39]);

// 3. Rasterizar cobertura + difuminar.
const landcover = await loadLandcover(LANDCOVER);
const grid = new Float32Array(GRID * GRID * 3);
for (let gy = 0; gy < GRID; gy++) {
  for (let gx = 0; gx < GRID; gx++) {
    const x = xMin + (gx / (GRID - 1)) * (xMax - xMin);
    const z = zMin + (gy / (GRID - 1)) * (zMax - zMin);
    const c = landcover.colorAt(x, z);
    const o = (gy * GRID + gx) * 3;
    grid[o] = srgbToLinear(c[0]);
    grid[o + 1] = srgbToLinear(c[1]);
    grid[o + 2] = srgbToLinear(c[2]);
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

// 4b. Segunda lectura de la montaña: falda verde, laderas mixtas y estratos.
// Se aplica solo a partir de cierta altura y pendiente para no teñir huertas,
// calles ni el casco urbano.
for (let i = 0; i < vertexCount; i++) {
  const x = positions[i * 3];
  const y = positions[i * 3 + 1];
  const z = positions[i * 3 + 2];
  if (y < 45) continue;

  const slope = hasNormals ? 1 - clamp01(normals[i * 3 + 1]) : 0;
  const heightLow = smoothstep(45, 85, y);
  const heightHigh = smoothstep(70, 135, y);
  const slopeMask = smoothstep(0.12, 0.48, slope);
  const mountainMask = clamp01(heightLow * (0.65 + 0.35 * slopeMask));
  if (mountainMask < 0.01) continue;

  const noise = terrainNoise(x, z);
  const band = 0.5 + 0.5 * Math.sin(y * 0.26 + noise * 1.8 + x * 0.006);
  const bandMask = smoothstep(0.15, 0.85, band);
  const green = mix(GREEN_LOW, GREEN_MID, clamp01(noise * 0.5 + 0.5));
  const greenDry = mix(green, GREEN_DRY, smoothstep(65, 120, y) * 0.5);
  const rock = mix(
    ROCK_DARK,
    ROCK_MID,
    clamp01(0.15 + bandMask * 0.75 + noise * 0.05),
  );
  const rockColor = mix(rock, ROCK_LIGHT, smoothstep(0.5, 0.9, band) * 0.65);
  const outcrop =
    smoothstep(0.18, 0.55, slope) *
    smoothstep(55, 110, y) *
    smoothstep(-0.2, 0.5, noise) *
    0.45;
  const rockMask = clamp01(
    heightHigh * (0.55 + 0.45 * slopeMask) +
      smoothstep(0.32, 0.62, slope) * smoothstep(55, 120, y) * 0.35 +
      outcrop,
  );
  const target = mix(greenDry, rockColor, rockMask);
  for (let channel = 0; channel < 3; channel += 1) {
    const base = colors[i * 3 + channel];
    colors[i * 3 + channel] = base + (target[channel] - base) * mountainMask;
  }
}

// 5. Escribir GLB nuevo (POSITION + NORMAL + COLOR_0 + TEXCOORD_0 + índices).
// Las normales se conservan: Terrain.tsx usa flatShading, pero así el GLB
// sigue siendo correcto si en el futuro se suaviza el sombreado.
const out = new Document();
const buffer = out.createBuffer();
const pos = out
  .createAccessor('POSITION')
  .setType('VEC3')
  .setArray(new Float32Array(positions))
  .setBuffer(buffer);
const idx = out
  .createAccessor('INDICES')
  .setType('SCALAR')
  .setArray(new Uint32Array(indices))
  .setBuffer(buffer);
const col = out.createAccessor('COLOR_0').setType('VEC3').setArray(colors).setBuffer(buffer);
const uv = out.createAccessor('TEXCOORD_0').setType('VEC2').setArray(uvs).setBuffer(buffer);
const nrm = hasNormals
  ? out
      .createAccessor('NORMAL')
      .setType('VEC3')
      .setArray(new Float32Array(normals))
      .setBuffer(buffer)
  : null;
const prim = out
  .createPrimitive()
  .setAttribute('POSITION', pos)
  .setAttribute('COLOR_0', col)
  .setAttribute('TEXCOORD_0', uv)
  .setIndices(idx);
if (nrm) prim.setAttribute('NORMAL', nrm);
out
  .createScene()
  .addChild(out.createNode('terrain').setMesh(out.createMesh('terrain').addPrimitive(prim)));

await new NodeIO().write(FILE, out);
console.log(
  `✓ Terreno recoloreado: ${vertexCount} vértices, ${indices.length / 3} triángulos → ${FILE}`,
);
