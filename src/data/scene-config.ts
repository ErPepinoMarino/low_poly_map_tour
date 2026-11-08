// Configuración de escena: pueblo, encuadre, límites de cámara y paleta (hex).

export const TOWN = {
  name: 'Almenara',
  region: 'Castellón',
  lat: 39.7534,
  lon: -0.2233,
} as const;

// Centro del diorama para la distancia de autoapagado del DOF. El origen
// (0,0,0) está dentro del pueblo y es fácil de visualizar con el gizmo.
export const DIORAMA_CENTER = [0, 0, 0] as const;

// Encuadre (bbox). Coordenadas exactas derivadas en Fase 2 (OSM + MDT05).
export const BBOX = {
  southMeters: 600,
  northMeters: 500,
  verticalExaggeration: 1.4, // rango 1.2–1.6× (efecto maqueta)
} as const;

// Límites de órbita (zoom, inclinación, rotación).
export const CAMERA_LIMITS = {
  minDistance: 20,
  maxDistance: 3500,
  // Inclinación libre hacia abajo; un margen de 0,1° impide mirar al horizonte/arriba.
  minPolarAngle: 0,
  maxPolarAngle: Math.PI / 2 - (0.1 * Math.PI) / 180,
  // Clamps absolutos de seguridad (CameraSafetyBounds).
  minHeight: 30,
  maxHeight: 3500,
  maxHorizontalRadius: 3000,
  minAzimuthAngle: -Infinity,
  maxAzimuthAngle: Infinity,
} as const;

// Vista inicial validada por el usuario (cámara baja, casi horizontal).
export const DEFAULT_VIEW = {
  position: [-635.7, 542.4, 746.3] as const,
  target: [110.8, -27.2, -86.0] as const,
} as const;

// Paleta "cozy" mediterránea — referencia consultable.
export const PALETTE = {
  // Fondo neutro oscuro: aísla el diorama y evita el azul marino de la maqueta.
  background: '#2A2D31',
  wall: '#F2E6D0',
  roof: '#C96F4A',
  vegetation: '#8F9B42',
  dryField: '#B39250',
  ground: '#D8BF8C',
  street: '#7A7468',
  road: '#5B6066',
  water: '#2F8194',
  sand: '#EED6A5',
  forest: '#667334',
  cliff: '#B49A7B',
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
  // Luz direccional: elevación fija 40° y azimut real del sol.
  // Sombras largas que giran con la hora; se apagan de noche.
  shadow: {
    elevation: 0.698,
    fadeRate: 1.2,
    mapSizeHigh: 4096,
    mapSizeLow: 2048,
    cameraSize: 900,
    near: 1,
    far: 7000,
    bias: -0.0002,
    normalBias: 0.03,
    // El shadow map solo se regenera cuando el azimut cambia este ángulo.
    // Con 4096/2048 px equivale aproximadamente a 0,5–1 texel de desplazamiento
    // en sombras de casas de 10–20 m: el salto es imperceptible.
    updateAngleDeg: 1,
  },
  dof: {
    near: 80,
    far: 330,
    // Distancia cámara -> DIORAMA_CENTER a partir de la cual se apaga.
    autoDisableDistance: 600,
    maxBokeh: 7,
    nearBlurMultiplier: 10.0,
    farBlurMultiplier: 1.7,
    farBlurTransition: 180,
    gizmoSize: 500,
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
