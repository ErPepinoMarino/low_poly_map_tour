// Clasificación de la cobertura del suelo → colores por zona (vertex colors).
//
// Colores base de la paleta "cozy" (desaturada), en RGB 0-1:
//   agua #3E7C9E · playa #E4D3B0 · acantilado #A39B8B · urbano #C9B08A
//   bosque #6B7A4A · matorral #9A9160 · campo #8A9A5B (por defecto)
//
// El campo es el color por defecto (huerta/naranjos que rodean el casco):
// solo clasificamos las zonas con un color propio; el resto cae en "campo".

import { readFile } from 'node:fs/promises';
import { toLocalMeters } from './geo.mjs';

const ZONES = [
  { id: 'water', prio: 6, color: [0.243, 0.486, 0.62], natural: ['water', 'bay'], landuse: ['reservoir', 'basin'] },
  { id: 'beach', prio: 5, color: [0.894, 0.827, 0.69], natural: ['beach', 'sand', 'dune'], landuse: [] },
  { id: 'cliff', prio: 4, color: [0.639, 0.608, 0.545], natural: ['cliff', 'bare_rock', 'rock', 'scree'], landuse: [] },
  {
    id: 'urban',
    prio: 3,
    color: [0.788, 0.69, 0.541],
    natural: [],
    landuse: ['residential', 'industrial', 'commercial', 'retail', 'cemetery', 'construction', 'farmyard'],
  },
  { id: 'forest', prio: 2, color: [0.42, 0.478, 0.29], natural: ['wood'], landuse: ['forest'] },
  { id: 'scrub', prio: 1, color: [0.604, 0.569, 0.376], natural: ['scrub', 'heath', 'grassland', 'shrub'], landuse: [] },
];
const FIELD_COLOR = [0.541, 0.604, 0.357]; // #8A9A5B

/** Carga los polígonos de cobertura y devuelve un colorAt(x, z) → [r,g,b]. */
export async function loadLandcover(file) {
  const json = JSON.parse(await readFile(file, 'utf8'));
  const polys = [];

  for (const el of json.elements) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 3) continue;
    const t = el.tags ?? {};
    let zone = null;
    for (const z of ZONES) {
      const hit = z.natural.some((v) => t.natural === v) || z.landuse.some((v) => t.landuse === v);
      if (hit) {
        zone = z;
        break;
      }
    }
    if (!zone) continue;

    const pts = el.geometry.map(({ lat, lon }) => toLocalMeters(lon, lat));
    let minx = Infinity;
    let maxx = -Infinity;
    let minz = Infinity;
    let maxz = -Infinity;
    for (const p of pts) {
      if (p.x < minx) minx = p.x;
      if (p.x > maxx) maxx = p.x;
      if (p.z < minz) minz = p.z;
      if (p.z > maxz) maxz = p.z;
    }
    polys.push({ pts, color: zone.color, prio: zone.prio, minx, maxx, minz, maxz });
  }

  // Prioridad: agua > playa > urbano.
  polys.sort((a, b) => b.prio - a.prio);

  return {
    count: polys.length,
    colorAt(x, z) {
      for (const p of polys) {
        if (x < p.minx || x > p.maxx || z < p.minz || z > p.maxz) continue;
        if (pointInPolygon(x, z, p.pts)) return p.color;
      }
      return FIELD_COLOR;
    },
  };
}

function pointInPolygon(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const zi = pts[i].z;
    const xj = pts[j].x;
    const zj = pts[j].z;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
