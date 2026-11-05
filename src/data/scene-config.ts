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

// Look final: horas representativas, niebla, DOF y colores de luz.
// Las horas son locales de Almenara (Europe/Madrid), no del dispositivo.
export const LIGHTING = {
  dayHour: 10.5,
  nightHour: 22.5,
  fogDensity: 0.00032,
  // Dirección artística de la luz (no la del sol real): sur-sureste, ~66°.
  // Sombras hacia el norte-noroeste, visibles pero no extremas.
  shadow: {
    azimuth: -0.35,
    elevation: 1.05,
    mapSizeHigh: 4096,
    mapSizeLow: 2048,
    cameraSize: 900,
    near: 1,
    far: 7000,
    bias: -0.0002,
    normalBias: 0.03,
  },
  dof: {
    near: 500,
    far: 1200,
    maxBokeh: 2.0,
    focusRange: 140,
    resolutionScale: 0.5,
  },
  colors: {
    sunDay: '#FFF3DA',
    sunSet: '#FFB26B',
    moon: '#9DB4E0',
    skyDay: '#A8D4E8',
    skyNight: '#1B2A4A',
    groundDay: '#C9B08A',
    groundNight: '#0E131C',
    ambientDay: '#FFFFFF',
    ambientNight: '#5A6B8C',
    // Cielo/fondo por altura solar: noche azul profundo, horizonte anaranjado, día azul claro.
    backgroundNight: '#0E1626',
    backgroundSunset: '#E8A87C',
    backgroundDay: '#A8D4E8',
    // La niebla va un paso por detrás del cielo para leerse sobre él.
    fogNight: '#1A2740',
    fogSunset: '#D99A76',
    fogDay: '#B9D2DE',
  },
  intensities: {
    sunDay: 2.2,
    sunSet: 1.3,
    moon: 0.35,
    hemisphereDay: 0.7,
    hemisphereNight: 0.35,
    ambientDay: 0.12,
    ambientNight: 0.06,
  },
  exposure: {
    day: 1.0,
    night: 1.15,
  },
} as const;
