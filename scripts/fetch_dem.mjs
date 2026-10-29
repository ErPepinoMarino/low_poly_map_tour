// Descarga el MDT05 (Modelo Digital del Terreno, 5 m) del CNIG para el bbox de Almenara.
//
// Fuente: servicio WCS del CNIG (gratis, sin login, licencia CC-BY 4.0).
//   https://servicios.idee.es/wcs-inspire/mdt
// Cobertura: Elevacion4258_5 = MDT05 a 5 m en coordenadas geográficas (ETRS89).
// Formato de salida: GeoTIFF (COG).
//
// Uso: node scripts/fetch_dem.mjs
// Salida: data/raw/almenara_mdt05.tif

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Bbox inicial (generoso). Se refina al trazar las calles en Fase 2.
const BBOX = {
  south: 39.743,
  north: 39.766,
  west: -0.241,
  east: -0.206,
};

const COVERAGE = 'Elevacion4258_5';
const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'data',
  'raw',
  'almenara_mdt05.tif',
);

const url =
  `https://servicios.idee.es/wcs-inspire/mdt` +
  `?request=GetCoverage` +
  `&service=WCS&version=2.0.1` +
  `&coverageId=${COVERAGE}` +
  `&subset=Lat(${BBOX.south},${BBOX.north})` +
  `&subset=Long(${BBOX.west},${BBOX.east})` +
  `&format=image/tiff`;

const res = await fetch(url);
if (!res.ok) {
  throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
}

const buf = Buffer.from(await res.arrayBuffer());
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, buf);

console.log(`✓ MDT05 descargado (${(buf.length / 1e6).toFixed(2)} MB)`);
console.log(`  bbox: lat [${BBOX.south}, ${BBOX.north}], lon [${BBOX.west}, ${BBOX.east}]`);
console.log(`  -> ${OUT}`);
