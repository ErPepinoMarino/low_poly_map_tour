// Clasificación de la cobertura del suelo → colores por zona (vertex colors).
//
// Paleta mediterránea cálida y saturada, alineada con los materiales del diorama
// (teja terracota, muro crema, campos dorados). Colores base en RGB 0-1:
//   agua #2F8194 · playa #EED6A5 · acantilado #B49A7B · urbano #D8BF8C
//   bosque #667334 · matorral #B39250 · campo #8F9B42 (por defecto)
//
// El campo es el color por defecto (huerta/naranjos que rodean el casco):
// solo clasificamos las zonas con un color propio; el resto cae en "campo".

import { readFile } from 'node:fs/promises';
import { toLocalMeters } from './geo.mjs';

const ZONES = [
  {
    id: 'water',
    prio: 6,
    color: [0.184, 0.506, 0.58],
    natural: ['water', 'bay'],
    landuse: ['reservoir', 'basin'],
  },
  {
    id: 'beach',
    prio: 5,
    color: [0.933, 0.839, 0.647],
    natural: ['beach', 'sand', 'dune'],
    landuse: [],
  },
  {
    id: 'cliff',
    prio: 4,
    color: [0.706, 0.604, 0.482],
    natural: ['cliff', 'bare_rock', 'rock', 'scree'],
    landuse: [],
  },
  {
    id: 'urban',
    prio: 3,
    color: [0.847, 0.749, 0.549],
    natural: [],
    landuse: [
      'residential',
      'industrial',
      'commercial',
      'retail',
      'cemetery',
      'construction',
      'farmyard',
    ],
  },
  { id: 'forest', prio: 2, color: [0.4, 0.451, 0.204], natural: ['wood'], landuse: ['forest'] },
  {
    id: 'scrub',
    prio: 1,
    color: [0.702, 0.573, 0.314],
    natural: ['scrub', 'heath', 'grassland', 'shrub'],
    landuse: [],
  },
];
const FIELD_COLOR = [0.561, 0.608, 0.259]; // #8F9B42

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
