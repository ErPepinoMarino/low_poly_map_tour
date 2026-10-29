// Box blur separable sobre una rejilla RGB (row-major). Suaviza las transiciones
// entre zonas para un aspecto orgánico, sin bordes duros.
export function boxBlurRGB(grid, w, h, radius, passes) {
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
