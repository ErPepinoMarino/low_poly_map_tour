// Sistema de coordenadas LOCAL del proyecto.
//
// Todo el mapa (terreno, calles, edificios, POIs) se expresa en "metros locales"
// con origen en el centro del casco de Almenara.
//
// Convención three.js (Y arriba):
//   X = ESTE   (+x = este)
//   Y = ARRIBA (altura; se añade al construir la malla)
//   Z = SUR    (+z = sur, por tanto norte = -z)
//
// Por qué Z = sur: la cámara por defecto de three.js "mira" hacia -Z. Si el norte
// fuera +Z, mirar al norte desde el sur giraría la cámara 180° y el mapa se vería
// reflejado en horizontal (este/oeste intercambiados). Con norte = -Z, la vista
// "desde el sur mirando al norte" es natural (este a la derecha).
//
// Usamos proyección "equirectangular" centrada en el origen: a ~3 km el error
// frente a UTM es < 0.01%, despreciable. Lo importante es que TODOS los elementos
// usen estas MISMAS funciones (misma escala/centro/posición/rotación).

export const ORIGIN = {
  lon: -0.2233, // centro del casco de Almenara
  lat: 39.7534,
};

const R = 6_371_000; // radio medio terrestre (metros)
const DEG = Math.PI / 180;
const rad = (d) => d * DEG;
const toDeg = (r) => r / DEG;

/** (lon, lat) en grados → metros locales { x (este), z (sur) }. */
export function toLocalMeters(lon, lat) {
  const x = rad(lon - ORIGIN.lon) * R * Math.cos(rad(ORIGIN.lat));
  const z = rad(ORIGIN.lat - lat) * R; // sur positivo → norte = -z
  return { x, z };
}

/** Metros locales { x, z } → (lon, lat) en grados (inversa). */
export function toLonLat(x, z) {
  const lon = ORIGIN.lon + toDeg(x / (R * Math.cos(rad(ORIGIN.lat))));
  const lat = ORIGIN.lat - toDeg(z / R); // z positivo = sur
  return { lon, lat };
}
