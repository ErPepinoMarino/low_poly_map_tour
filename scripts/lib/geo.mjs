// Sistema de coordenadas LOCAL del proyecto.
//
// Todo el mapa (terreno, calles, edificios, POIs) se expresa en "metros locales"
// con origen en el centro del casco de Almenara. Es el mismo sistema que usa
// la app (three.js: X = este, Y = arriba, Z = norte) y el que importaremos a Blender.
//
// Usamos una proyección "equirectangular" centrada en el origen: a escala de un
// pueblo (~3 km) el error frente a una proyección UTM real es inferior al 0.01%,
// despreciable para un diorama. Lo importante es que TODOS los elementos usen
// estas MISMAS funciones, garantizando la misma escala/centro/posición/rotación.

export const ORIGIN = {
  lon: -0.2233, // centro del casco de Almenara
  lat: 39.7534,
};

const R = 6_371_000; // radio medio terrestre (metros)
const DEG = Math.PI / 180;

const rad = (deg) => deg * DEG;
const deg = (r) => r / DEG;

/** (lon, lat) en grados → metros locales { x (este), z (norte) }. */
export function toLocalMeters(lon, lat) {
  const x = rad(lon - ORIGIN.lon) * R * Math.cos(rad(ORIGIN.lat));
  const z = rad(lat - ORIGIN.lat) * R;
  return { x, z };
}

/** Metros locales { x, z } → (lon, lat) en grados (inversa). */
export function toLonLat(x, z) {
  const lon = ORIGIN.lon + deg(x / (R * Math.cos(rad(ORIGIN.lat))));
  const lat = ORIGIN.lat + deg(z / R);
  return { lon, lat };
}
