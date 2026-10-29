import * as THREE from 'three';

let cached: THREE.Texture | null = null;

// Textura de ruido tileable (value noise) para el "grano cozy".
// Valores en [0.9, 1.0] → modulan sutilmente el brillo sin oscurecer la escena.
// Se aplica como `map` (con UVs planas horneadas en los GLB).
export function getNoiseTexture(): THREE.Texture {
  if (cached) return cached;

  const SIZE = 256;
  const CELLS = 24; // lattice (más celdas = grano más fino)
  const MIN = 0.9; // brillo mínimo (rango 0.9–1.0)

  const rand = new Float32Array(CELLS * CELLS);
  for (let i = 0; i < rand.length; i++) rand[i] = Math.random();

  const data = new Uint8Array(SIZE * SIZE * 4);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const gx = (x / SIZE) * CELLS;
      const gy = (y / SIZE) * CELLS;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const x1 = (x0 + 1) % CELLS;
      const y1 = (y0 + 1) % CELLS;
      const fx = smooth(gx - x0);
      const fy = smooth(gy - y0);
      const v = lerp(
        lerp(rand[y0 * CELLS + x0], rand[y0 * CELLS + x1], fx),
        lerp(rand[y1 * CELLS + x0], rand[y1 * CELLS + x1], fx),
        fy,
      );
      const b = Math.round((MIN + v * (1 - MIN)) * 255);
      const o = (y * SIZE + x) * 4;
      data[o] = b;
      data[o + 1] = b;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }

  cached = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  cached.wrapS = THREE.RepeatWrapping;
  cached.wrapT = THREE.RepeatWrapping;
  cached.colorSpace = THREE.NoColorSpace;
  cached.needsUpdate = true;
  return cached;
}
