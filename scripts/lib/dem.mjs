// Lectura del MDT05 (GeoTIFF) + "drapeado" sobre el terreno.
// Compartido por build_terrain.mjs y build_streets.mjs para que ambos
// muestreen y transformen la elevación exactamente igual.

import { fromFile } from 'geotiff';
import { toLonLat } from './geo.mjs';

/** Lee el GeoTIFF y devuelve un muestreador de elevación (m) por (lon, lat). */
export async function loadDem(file) {
  const tiff = await fromFile(file);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const [west, south, east, north] = image.getBoundingBox();
  const nodata = image.getGDALNoData();
  const data = (await image.readRasters({ samples: [0] }))[0];

  function sample(lon, lat) {
    const col = Math.round(((lon - west) / (east - west)) * (width - 1));
    const row = Math.round(((north - lat) / (north - south)) * (height - 1));
    if (col < 0 || col >= width || row < 0 || row >= height) return 0;
    const v = data[row * width + col];
    return v === nodata || Number.isNaN(v) ? 0 : v;
  }

  return { sample, data, width, height, nodata, bbox: [west, south, east, north] };
}

/** Devuelve una función (x, z) → altura "drapada" (exagerada + cuantizada),
 *  idéntica a la usada para hornear el terreno. */
export function makeDrape(dem, exaggeration, step) {
  const quantize = (h) => (step > 0 ? Math.round(h / step) * step : h);
  return (x, z) => {
    const { lon, lat } = toLonLat(x, z);
    return quantize(dem.sample(lon, lat) * exaggeration);
  };
}
