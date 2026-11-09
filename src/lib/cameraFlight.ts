import * as THREE from 'three';

// Parámetros del vuelo de cámara. La duración no es fija: se calcula con la
// longitud real del arco y el ángulo de giro, y se limita a este rango.
export const CAMERA_FLIGHT = {
  minDurationSeconds: 2,
  maxDurationSeconds: 6,
  maxLinearSpeed: 180, // m/s en el tramo de crucero
  maxAngularSpeed: 0.45, // rad/s en el tramo de crucero
  rampInSeconds: 0.35,
  rampOutSeconds: 0.75,
  arcLiftRatio: 0.06,
  arcLiftMax: 120,
  arcBowRatio: 0.03,
  arcBowMax: 40,
} as const;

export type CameraFlightMode = 'static' | 'linear' | 'bezier';

export interface CameraFlightPlan {
  duration: number;
  mode: CameraFlightMode;
  instant: boolean;
  curve: THREE.CubicBezierCurve3;
  startPosition: THREE.Vector3;
  startQuaternion: THREE.Quaternion;
  endQuaternion: THREE.Quaternion;
  endPosition: THREE.Vector3;
  endTarget: THREE.Vector3;
  totalLength: number;
  rampIn: number;
  rampOut: number;
}

const SAME_POSITION_EPSILON = 0.5; // metros
const SAME_ROTATION_EPSILON = 0.005; // radianes, ~0.29°
const SIMPLE_FLIGHT_DISTANCE = 50; // metros

const lookMatrix = new THREE.Matrix4();

function lookQuaternion(
  position: THREE.Vector3,
  target: THREE.Vector3,
  up: THREE.Vector3,
  out: THREE.Quaternion,
) {
  lookMatrix.lookAt(position, target, up);
  return out.setFromRotationMatrix(lookMatrix);
}

// Construye una ruta con un arco suave y calcula una duración que respeta
// simultáneamente la velocidad lineal y la velocidad angular máximas.
export function createCameraFlightPlan(input: {
  startPosition: THREE.Vector3;
  startQuaternion: THREE.Quaternion;
  endPosition: THREE.Vector3;
  endTarget: THREE.Vector3;
  up: THREE.Vector3;
}): CameraFlightPlan {
  const start = input.startPosition.clone();
  const end = input.endPosition.clone();
  const delta = new THREE.Vector3().subVectors(end, start);
  const distance = delta.length();
  const up = input.up.clone().normalize();
  const horizontal = new THREE.Vector3(delta.x, 0, delta.z);
  const horizontalLength = horizontal.length();

  const endQuaternion = lookQuaternion(end, input.endTarget, up, new THREE.Quaternion());
  const angle = input.startQuaternion.angleTo(endQuaternion);

  // Evitamos construir un Bézier cuando la cámara apenas se mueve. En el caso
  // exacto de "centrar" un POI ya centrado una curva degenerada producía NaN
  // al mapear distancias sobre una longitud de curva prácticamente cero.
  let mode: CameraFlightMode =
    distance < SAME_POSITION_EPSILON
      ? 'static'
      : distance < SIMPLE_FLIGHT_DISTANCE
        ? 'linear'
        : 'bezier';
  const instant = mode === 'static' && angle < SAME_ROTATION_EPSILON;

  // Un pequeño arco lateral evita que el vuelo sea una línea recta y ayuda
  // cuando el destino está al otro lado del pueblo.
  const side =
    horizontalLength > 0.001
      ? new THREE.Vector3(-horizontal.z, 0, horizontal.x).normalize()
      : new THREE.Vector3(1, 0, 0);
  const lift = Math.min(CAMERA_FLIGHT.arcLiftMax, distance * CAMERA_FLIGHT.arcLiftRatio);
  const bow =
    horizontalLength > 100
      ? Math.min(CAMERA_FLIGHT.arcBowMax, distance * CAMERA_FLIGHT.arcBowRatio)
      : 0;

  const c1 = start
    .clone()
    .addScaledVector(delta, 1 / 3)
    .addScaledVector(up, lift)
    .addScaledVector(side, bow);
  const c2 = start
    .clone()
    .addScaledVector(delta, 2 / 3)
    .addScaledVector(up, lift)
    .addScaledVector(side, bow * 0.7);

  const curve = new THREE.CubicBezierCurve3(start, c1, c2, end);
  let totalLength = distance;
  if (mode === 'bezier') {
    curve.arcLengthDivisions = 48;
    const lengths = curve.getLengths(48);
    const pathLength = lengths[lengths.length - 1] ?? 0;
    if (pathLength > 1e-5) {
      totalLength = pathLength;
    } else {
      mode = 'linear';
      totalLength = distance;
    }
  } else if (mode === 'static') {
    totalLength = 0;
  }

  const cruiseSeconds = Math.max(
    totalLength / CAMERA_FLIGHT.maxLinearSpeed,
    angle / CAMERA_FLIGHT.maxAngularSpeed,
  );
  const rampIn = CAMERA_FLIGHT.rampInSeconds;
  const rampOut = CAMERA_FLIGHT.rampOutSeconds;
  const duration = instant
    ? 0
    : THREE.MathUtils.clamp(
        cruiseSeconds + 0.5 * (rampIn + rampOut),
        CAMERA_FLIGHT.minDurationSeconds,
        CAMERA_FLIGHT.maxDurationSeconds,
      );

  return {
    duration,
    mode,
    instant,
    curve,
    startPosition: start,
    startQuaternion: input.startQuaternion.clone(),
    endQuaternion,
    endPosition: end,
    endTarget: input.endTarget.clone(),
    totalLength,
    rampIn,
    rampOut,
  };
}

// Progreso por distancia con rampa de entrada y salida de duración fija.
// La velocidad empieza y termina en cero, pero no se queda "parada" durante
// una fracción grande del vuelo como ocurría con smoothstep en vuelos largos.
export function getCameraFlightProgress(elapsed: number, plan: CameraFlightPlan) {
  if (plan.instant || plan.duration <= 0) return 1;
  if (elapsed <= 0) return 0;
  if (elapsed >= plan.duration) return 1;

  const duration = plan.duration;
  const rampIn = plan.rampIn;
  const rampOut = plan.rampOut;
  const cruiseSeconds = duration - 0.5 * (rampIn + rampOut);
  const cruiseSpeed = 1 / cruiseSeconds;

  if (elapsed < rampIn) {
    const u = elapsed / rampIn;
    return cruiseSpeed * rampIn * (u * u * u - 0.5 * u * u * u * u);
  }

  if (elapsed < duration - rampOut) {
    return 0.5 * cruiseSpeed * rampIn + cruiseSpeed * (elapsed - rampIn);
  }

  const u = (duration - elapsed) / rampOut;
  return 1 - cruiseSpeed * rampOut * (u * u * u - 0.5 * u * u * u * u);
}

export function sampleCameraFlightPosition(
  plan: CameraFlightPlan,
  progress: number,
  out: THREE.Vector3,
) {
  const u = THREE.MathUtils.clamp(progress, 0, 1);
  if (plan.mode === 'static') return out.copy(plan.startPosition);
  if (plan.mode === 'linear') return out.lerpVectors(plan.startPosition, plan.endPosition, u);

  plan.curve.getPoint(plan.curve.getUtoTmapping(u, u * plan.totalLength), out);
  // Guarda defensiva: una curva degenerada nunca debe llegar a la cámara como
  // NaN. Si ocurre, caemos a una interpolación lineal segura.
  if (!Number.isFinite(out.x) || !Number.isFinite(out.y) || !Number.isFinite(out.z)) {
    out.lerpVectors(plan.startPosition, plan.endPosition, u);
  }
  return out;
}

export function sampleCameraFlightQuaternion(
  plan: CameraFlightPlan,
  progress: number,
  out: THREE.Quaternion,
) {
  return out.copy(plan.startQuaternion).slerp(plan.endQuaternion, progress);
}
