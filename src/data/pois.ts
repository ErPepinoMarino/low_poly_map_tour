import rawPois from './pois.json';

export interface PoiCamera {
  position: [number, number, number];
  target: [number, number, number];
}

export interface PoiDescription {
  es: string;
  en: string;
}

export interface PoiData {
  id: string;
  categoria: PoiDescription;
  name: string;
  nameEn: string;
  lat: number;
  lon: number;
  /** Nombre del nodo/malla en pois.glb. */
  node: string;
  /** Ruta final de la foto; el archivo puede sustituirse sin tocar código. */
  photo: string;
  /** Encuadre autorado uno a uno. Null hasta que se complete. */
  camera: PoiCamera | null;
  description: PoiDescription;
  note?: string;
}

// El orden del array es el orden de la ruta (con wrap-around).
export const POIS: readonly PoiData[] = rawPois as PoiData[];

export const POI_BY_ID: ReadonlyMap<string, PoiData> = new Map(POIS.map((poi) => [poi.id, poi]));

export const POI_IDS: readonly string[] = POIS.map((poi) => poi.id);

export function getPoi(id: string | null | undefined): PoiData | undefined {
  if (!id) return undefined;
  return POI_BY_ID.get(id);
}
