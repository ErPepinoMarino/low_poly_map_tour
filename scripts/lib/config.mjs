// Parámetros COMPARTIDOS del horneado (terreno + calles).
// Centralizados para que terreno y calles usen exactamente los mismos valores
// y nunca diverjan (misma escala, misma exageración, mismo cuantizado).

export const BBOX = {
  south: 39.743,
  north: 39.766,
  west: -0.241,
  east: -0.206,
};

export const RESOLUTION = 10; // metros entre vértices del terreno
export const EXAGGERATION = 1.4; // factor vertical (efecto maqueta)
export const QUANTIZE_STEP = 3; // metros de "terraza" (0 = sin terrazas)

export const STREET_WIDTH = 2; // ancho de las cintas de referencia (m)
export const STREET_OFFSET = 1; // elevación extra para evitar z-fighting sobre el terreno (m)
