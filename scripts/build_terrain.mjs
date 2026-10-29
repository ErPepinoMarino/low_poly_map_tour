// Convierte el GeoTIFF del MDT05 en una malla low-poly de terreno (GLB).
//
// Pasos:
//   1. Lee el GeoTIFF (rejilla de alturas en grados).
//   2. Proyecta a "metros locales" (scripts/lib/geo.mjs) con origen en el casco.
//   3. Remuestrea a una rejilla uniforme de RESOLUTION metros.
//   4. Aplica EXAGGERATION vertical (efecto maqueta) y cuantiza en terrazas.
//   5. Genera triángulos y escribe el GLB (solo posiciones + índices, sin normales:
//      la app aplicará flatShading; así el archivo queda mínimo).
//
// Uso: node scripts/build_terrain.mjs
// Entrada: data/raw/almenara_mdt05.tif
// Salida: public/models/terrain.glb

import { fromFile } from 'geotiff';
import { Document, NodeIO } from '@gltf-transform/core';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { toLocalMeters, toLonLat } from './lib/geo.mjs';

// ---- Parámetros (ajustables) ----
const RESOLUTION = 10; // metros entre vértices
const EXAGGERATION = 1.4; // factor vertical (efecto maqueta)
const QUANTIZE_STEP = 3; // metros de "terraza" (0 = sin terrazas)

const IN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'raw', 'almenara_mdt05.tif');
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models', 'terrain.glb');

// ---- Leer el GeoTIFF ----
const tiff = await fromFile(IN);
const image = await tiff.getImage();
const width = image.getWidth();
const height = image.getHeight();
const [west, south, east, north] = image.getBoundingBox(); // [oeste, sur, este, norte]
const nodata = image.getGDALNoData();
const rasters = await image.readRasters({ samples: [0] });
const data = rasters[0]; // Float32Array, filas de norte (arriba) a sur (abajo)

console.log(`Raster: ${width}×${height} px`);
console.log(`Bbox (grados): [${west.toFixed(5)}, ${south.toFixed(5)}] → [${east.toFixed(5)}, ${north.toFixed(5)}]`);

// Elevación real (antes de exagerar) para el informe.
let minRaw = Infinity;
let maxRaw = -Infinity;
for (let i = 0; i < data.length; i++) {
  const v = data[i];
  if (v === nodata || Number.isNaN(v)) continue;
  if (v < minRaw) minRaw = v;
  if (v > maxRaw) maxRaw = v;
}
console.log(`Elevación real: ${minRaw.toFixed(1)} m → ${maxRaw.toFixed(1)} m`);

// ---- Proyectar el bbox a metros locales ----
const corners = [
  toLocalMeters(west, north),
  toLocalMeters(east, north),
  toLocalMeters(west, south),
  toLocalMeters(east, south),
];
const xMin = Math.min(...corners.map((p) => p.x));
const xMax = Math.max(...corners.map((p) => p.x));
const zMin = Math.min(...corners.map((p) => p.z));
const zMax = Math.max(...corners.map((p) => p.z));

const nx = Math.max(2, Math.round((xMax - xMin) / RESOLUTION));
const nz = Math.max(2, Math.round((zMax - zMin) / RESOLUTION));
console.log(`Rejilla: ${nx}×${nz} celdas (${(xMax - xMin).toFixed(0)} m × ${(zMax - zMin).toFixed(0)} m)`);

// ---- Muestrear la elevación en la rejilla de metros ----
function sampleElevation(lon, lat) {
  const col = ((lon - west) / (east - west)) * (width - 1);
  const row = ((north - lat) / (north - south)) * (height - 1);
  const c = Math.round(col);
  const r = Math.round(row);
  if (c < 0 || c >= width || r < 0 || r >= height) return 0;
  const v = data[r * width + c];
  if (v === nodata || Number.isNaN(v)) return 0; // mar → 0
  return v;
}

const quantize = (h, step) => (step > 0 ? Math.round(h / step) * step : h);

const positions = [];
for (let iz = 0; iz <= nz; iz++) {
  const z = zMin + iz * RESOLUTION;
  for (let ix = 0; ix <= nx; ix++) {
    const x = xMin + ix * RESOLUTION;
    const { lon, lat } = toLonLat(x, z);
    const h = quantize(sampleElevation(lon, lat) * EXAGGERATION, QUANTIZE_STEP);
    positions.push(x, h, z);
  }
}

// ---- Índices de triángulos (winding +Y arriba) ----
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

// ---- Escribir GLB ----
const document = new Document();
const buffer = document.createBuffer();
const positionAccessor = document
  .createAccessor('POSITION')
  .setType('VEC3')
  .setArray(new Float32Array(positions))
  .setBuffer(buffer);
const indexAccessor = document
  .createAccessor('INDICES')
  .setType('SCALAR')
  .setArray(new Uint32Array(indices))
  .setBuffer(buffer);

const primitive = document
  .createPrimitive()
  .setAttribute('POSITION', positionAccessor)
  .setIndices(indexAccessor);
const mesh = document.createMesh('terrain').addPrimitive(primitive);
document.createScene('scene').addChild(document.createNode('terrain').setMesh(mesh));

const { mkdir } = await import('node:fs/promises');
await mkdir(path.dirname(OUT), { recursive: true });
const io = new NodeIO();
await io.write(OUT, document);

console.log(`✓ Terreno horneado: ${positions.length / 3} vértices, ${indices.length / 3} triángulos`);
console.log(`  -> ${OUT}`);
