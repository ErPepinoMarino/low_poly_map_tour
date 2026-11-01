// Configuración de escena: pueblo, encuadre, límites de cámara y paleta (hex).

export const TOWN = {
  name: 'Almenara',
  region: 'Castellón',
  lat: 39.7534,
  lon: -0.2233,
} as const;

// Encuadre (bbox). Coordenadas exactas derivadas en Fase 2 (OSM + MDT05).
export const BBOX = {
  southMeters: 600,
  northMeters: 500,
  verticalExaggeration: 1.4, // rango 1.2–1.6× (efecto maqueta)
} as const;

// Límites de órbita (zoom, inclinación, rotación).
export const CAMERA_LIMITS = {
  minDistance: 20,
  maxDistance: 400,
  minPolarAngle: 0.15,
  maxPolarAngle: 1.45,
  minAzimuthAngle: -Infinity,
  maxAzimuthAngle: Infinity,
} as const;

// Vista por defecto: sur → norte, 45°, apuntando al casco con el cerro al fondo.
// Valores placeholder; se ajustan en Fase 2.
export const DEFAULT_VIEW = {
  position: [0, 0, 0] as const,
  target: [0, 0, 0] as const,
} as const;

// Paleta "cozy" mediterránea — referencia consultable.
export const PALETTE = {
  // Fondo neutro oscuro: aísla el diorama y evita el azul marino de la maqueta.
  background: '#2A2D31',
  wall: '#F2E6D0',
  roof: '#C96F4A',
  vegetation: '#8A9A5B',
  dryField: '#D9B36C',
  ground: '#C9B08A',
  street: '#7A7468',
  road: '#5B6066',
  water: '#3E7C9E',
  sand: '#E4D3B0',
  accent: '#E0A23C',
  skyDay: '#A8D4E8',
  sunset: '#E8A87C',
  nightAmbient: '#1B2A4A',
  nightLight: '#FFC87A',
} as const;
