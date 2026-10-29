// Convierte el GeoTIFF del MDT05 en una malla low-poly de terreno (GLB),
// coloreando por cobertura de suelo (vertex colors, difuminadas).
//
// Pasos:
//   1. Lee el GeoTIFF y proyecta a "metros locales" (scripts/lib/geo.mjs).
//   2. Remuestrea a una rejilla de RESOLUTION metros.
//   3. Exagera verticalmente + cuantiza en terrazas.
//   4. Colorea cada vértice por zona de cobertura (campo/urbano/playa) y difumina.
//   5. Escribe el GLB (POSITION + COLOR_0 + índices).
//
// Uso: node scripts/build_terrain.mjs
// Entrada: data/raw/almenara_mdt05.tif (+ data/raw/landcover.json opcional)
// Salida: public/models/terrain.glb

import { mkdir } from 'node:fs/promises';
import { Document, NodeIO } from '@gltf-transform/core';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadDem, makeDrape } from './lib/dem.mjs';
import { toLocalMeters } from './lib/geo.mjs';
import { loadLandcover } from './lib/landcover.mjs';
import {
  RESOLUTION,
  EXAGGERATION,
  QUANTIZE_STEP,
  COLOR_BLUR_RADIUS,
  COLOR_BLUR_PASSES,
  NOISE_TILE,
} from './lib/config.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEM = path.join(ROOT, 'data', 'raw', 'almenara_mdt05.tif');
const LANDCOVER = path.join(ROOT, 'data', 'raw', 'landcover.json');
// La base procedural va a generated/ (se importa a Blender para editarla).
// El terreno FINAL (decimado/editado en Blender) se guarda en public/models/terrain.glb.
const OUT = path.join(ROOT, 'public', 'models', 'generated', 'terrain.glb');

// Box blur separable sobre una rejilla RGB (row-major). Suaviza las transiciones
// entre zonas para un aspecto orgánico, sin bordes duros.
function boxBlurRGB(grid, w, h, radius, passes) {
  let src = grid;
  for (let p = 0; p < passes; p++) {
    const tmp = new Float32Array(src.length);
    // Horizontal.
    for (let z = 0; z < h; z++) {
      for (let x = 0; x < w; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let c = 0;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          const i = (z * w + xx) * 3;
          r += src[i];
          g += src[i + 1];
          b += src[i + 2];
          c++;
        }
        const o = (z * w + x) * 3;
        tmp[o] = r / c;
        tmp[o + 1] = g / c;
        tmp[o + 2] = b / c;
      }
    }
    const out = new Float32Array(src.length);
    // Vertical.
    for (let z = 0; z < h; z++) {
      for (let x = 0; x < w; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let c = 0;
        for (let dz = -radius; dz <= radius; dz++) {
          const zz = Math.min(h - 1, Math.max(0, z + dz));
          const i = (zz * w + x) * 3;
          r += tmp[i];
          g += tmp[i + 1];
          b += tmp[i + 2];
          c++;
        }
        const o = (z * w + x) * 3;
        out[o] = r / c;
        out[o + 1] = g / c;
        out[o + 2] = b / c;
      }
    }
    src = out;
  }
  return src;
}

const dem = await loadDem(DEM);
const drape = makeDrape(dem, EXAGGERATION, QUANTIZE_STEP);

// Bbox del terreno a metros locales.
const [west, south, east, north] = dem.bbox;
const corners = [toLocalMeters(west, north), toLocalMeters(east, north), toLocalMeters(west, south), toLocalMeters(east, south)];
const xMin = Math.min(...corners.map((p) => p.x));
const xMax = Math.max(...corners.map((p) => p.x));
const zMin = Math.min(...corners.map((p) => p.z));
const zMax = Math.max(...corners.map((p) => p.z));

const nx = Math.max(2, Math.round((xMax - xMin) / RESOLUTION));
const nz = Math.max(2, Math.round((zMax - zMin) / RESOLUTION));
console.log(`Rejilla: ${nx}×${nz} celdas`);

const positions = [];
const uvs = [];
for (let iz = 0; iz <= nz; iz++) {
  const z = zMin + iz * RESOLUTION;
  for (let ix = 0; ix <= nx; ix++) {
    const x = xMin + ix * RESOLUTION;
    positions.push(x, drape(x, z), z);
    uvs.push(x / NOISE_TILE, z / NOISE_TILE);
  }
}

// ---- Vertex colors por cobertura ----
let landcover = null;
try {
  landcover = await loadLandcover(LANDCOVER);
} catch {
  landcover = null;
}
const colorAt = landcover ? (x, z) => landcover.colorAt(x, z) : () => [0.541, 0.604, 0.357];

const w = nx + 1;
const h = nz + 1;
const grid = new Float32Array(w * h * 3);
for (let iz = 0; iz <= nz; iz++) {
  const z = zMin + iz * RESOLUTION;
  for (let ix = 0; ix <= nx; ix++) {
    const x = xMin + ix * RESOLUTION;
    const c = colorAt(x, z);
    const o = (iz * w + ix) * 3;
    grid[o] = c[0];
    grid[o + 1] = c[1];
    grid[o + 2] = c[2];
  }
}
const colors = boxBlurRGB(grid, w, h, COLOR_BLUR_RADIUS, COLOR_BLUR_PASSES);
if (landcover) {
  console.log(`Cobertura: ${landcover.count} polígonos → vertex colors (blur r=${COLOR_BLUR_RADIUS}, ${COLOR_BLUR_PASSES} pasadas)`);
}

// ---- Índices de triángulos ----
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

// ---- GLB ----
const document = new Document();
const buffer = document.createBuffer();
const pos = document.createAccessor('POSITION').setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer);
const idx = document.createAccessor('INDICES').setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buffer);
const col = document.createAccessor('COLOR_0').setType('VEC3').setArray(new Float32Array(colors)).setBuffer(buffer);
const uv = document.createAccessor('TEXCOORD_0').setType('VEC2').setArray(new Float32Array(uvs)).setBuffer(buffer);

const primitive = document
  .createPrimitive()
  .setAttribute('POSITION', pos)
  .setAttribute('COLOR_0', col)
  .setAttribute('TEXCOORD_0', uv)
  .setIndices(idx);
document.createScene().addChild(document.createNode('terrain').setMesh(document.createMesh('terrain').addPrimitive(primitive)));

await mkdir(path.dirname(OUT), { recursive: true });
const io = new NodeIO();
await io.write(OUT, document);

console.log(`✓ Terreno: ${positions.length / 3} vértices, ${indices.length / 3} triángulos → ${OUT}`);
