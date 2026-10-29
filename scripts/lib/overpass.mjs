// Cliente de Overpass con reintentos y espejos (los servidores públicos se saturan).

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const HEADERS = {
  'User-Agent': 'low_poly_map_tour/0.1 (portfolio project)',
  Accept: 'application/json',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Ejecuta una query Overpass y devuelve el JSON. */
export async function fetchOverpass(query) {
  let lastErr = null;
  for (const endpoint of ENDPOINTS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, { headers: HEADERS });
        if (res.ok) return await res.json();
        lastErr = new Error(`HTTP ${res.status} (${endpoint})`);
      } catch (err) {
        lastErr = err;
      }
      await sleep(1500 * attempt);
    }
  }
  throw new Error(`Overpass: ${lastErr?.message}`);
}
