import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { setupNamedMaterials } from '../lib/materials';
import { TRAIN_ROUTE } from '../data/train-route';

const LOCOMOTIVE_URL = `${import.meta.env.BASE_URL}models/locomotora.glb`;
const WAGON_URL = `${import.meta.env.BASE_URL}models/vagon.glb`;
const TRACKS_URL = `${import.meta.env.BASE_URL}models/vias.glb`;

const TRAIN_SPEED = 16;
const CAR_COUNT = 4;
const LOOP_PAUSE = 3;
const FADE_IN_DISTANCE = 22;
const FADE_OUT_DISTANCE = 22;
const DEFAULT_CAR_GAP = 2.5;
const DEFAULT_VERTICAL_OFFSET = 0;
const DEFAULT_START_DELAY = 0;
const CAR_TYPES = ['locomotive', 'wagon', 'wagon', 'locomotive'] as const;
const REVERSED_CARS = [false, false, false, true] as const;
// El GLB contiene varias copias de la misma polilínea (caras superior/inferior).
// Cortamos en la primera discontinuidad para quedarnos con una sola pasada.
const PATH_BREAK_DISTANCE = 80;
const TRACK_SURFACE_OFFSET = 0.02;
const PATH_FALLBACK = TRAIN_ROUTE.map(([x, y, z]) => new THREE.Vector3(x, y, z));

type TrainPathName = 'trenPathIda' | 'trenPathVuelta';

interface TrainProps {
  pathName: TrainPathName;
  reverse?: boolean;
  carGap?: number;
  verticalOffset?: number;
  startDelay?: number;
}

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function hasRailMaterial(material: THREE.Material | THREE.Material[] | undefined) {
  const materials = Array.isArray(material) ? material : material ? [material] : [];
  return materials.some((entry) => normalizeName(entry.name) === 'via');
}

function extractPath(scene: THREE.Object3D, name: TrainPathName): THREE.Vector3[] {
  const object = scene.getObjectByName(name) as THREE.Mesh | undefined;
  if (!object?.isMesh) return [];

  object.updateWorldMatrix(true, false);
  const position = object.geometry.getAttribute('position');
  const points: THREE.Vector3[] = [];
  const point = new THREE.Vector3();
  let previous: THREE.Vector3 | null = null;

  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
    if (previous) {
      const distanceSq = point.distanceToSquared(previous);
      if (distanceSq < 0.0025) continue;
      if (distanceSq > PATH_BREAK_DISTANCE * PATH_BREAK_DISTANCE) break;
    }
    points.push(point.clone());
    previous = point.clone();
  }
  return points;
}

// La polilínea exportada puede quedar unos centímetros por debajo de la cara
// superior de la vía. Proyectamos sus puntos sobre la malla `via` para que las
// ruedas apoyen realmente en la superficie superior.
function snapPathToTrack(
  points: THREE.Vector3[],
  scene: THREE.Object3D,
): THREE.Vector3[] {
  const track = scene.getObjectByName('viasTren');
  if (!track) return points;

  track.updateWorldMatrix(true, true);
  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);

  return points.map((point) => {
    origin.set(point.x, 1000, point.z);
    raycaster.set(origin, down);
    const hits = raycaster.intersectObject(track, true);
    const hit =
      hits.find((entry) => {
        const mesh = entry.object as THREE.Mesh;
        return mesh.isMesh && hasRailMaterial(mesh.material);
      }) ?? null;
    if (!hit) return point;
    return new THREE.Vector3(point.x, hit.point.y + TRACK_SURFACE_OFFSET, point.z);
  });
}

function cloneCar(scene: THREE.Object3D): THREE.Object3D {
  const clone = scene.clone(true);
  clone.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    // Clonar materiales permite que cada tren haga su propio fade sin afectar
    // al otro convoy.
    const material = mesh.material;
    mesh.material = Array.isArray(material)
      ? material.map((entry) => entry.clone())
      : material.clone();
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });
  return clone;
}

export default function Train({
  pathName,
  reverse = false,
  carGap = DEFAULT_CAR_GAP,
  verticalOffset = DEFAULT_VERTICAL_OFFSET,
  startDelay = DEFAULT_START_DELAY,
}: TrainProps) {
  const { scene: locomotiveScene } = useGLTF(LOCOMOTIVE_URL);
  const { scene: wagonScene } = useGLTF(WAGON_URL);
  const { scene: tracksScene } = useGLTF(TRACKS_URL);
  const trainRef = useRef<THREE.Group>(null);
  const carRefs = useRef<Array<THREE.Group | null>>([]);
  const progress = useRef(0);
  const pause = useRef(0);
  const delay = useRef(startDelay);
  const travelSign = reverse ? -1 : 1;

  const pathPoints = useMemo(() => {
    const extracted = extractPath(tracksScene, pathName);
    const points = extracted.length > 1 ? extracted : PATH_FALLBACK;
    return snapPathToTrack(points, tracksScene);
  }, [pathName, tracksScene]);

  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(pathPoints, false, 'centripetal', 0.5),
    [pathPoints],
  );
  const routeLength = useMemo(() => curve.getLength(), [curve]);
  const frontZ = useMemo(
    () => locomotiveScene.getObjectByName('frontHitch')?.position.z ?? 17.9578,
    [locomotiveScene],
  );
  const rearZ = useMemo(
    () => locomotiveScene.getObjectByName('rearHitch')?.position.z ?? -2.0971,
    [locomotiveScene],
  );
  const carLength = Math.max(1, frontZ - rearZ);
  const carStride = carLength + Math.max(0, carGap);
  // El origen del modelo está a media altura del tren. La ruta está en la
  // superficie superior de la vía, así que elevamos el grupo hasta que las
  // ruedas apoyen en ella.
  const wheelOffset = useMemo(() => {
    const bounds = new THREE.Box3().setFromObject(locomotiveScene);
    return Math.max(0, -bounds.min.y);
  }, [locomotiveScene]);
  const localForward = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const frontTarget = useMemo(() => new THREE.Vector3(), []);
  const rearTarget = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const modelDirection = useMemo(() => new THREE.Vector3(), []);

  const cars = useMemo(
    () =>
      CAR_TYPES.map((type) =>
        cloneCar(type === 'locomotive' ? locomotiveScene : wagonScene),
      ),
    [locomotiveScene, wagonScene],
  );

  useEffect(() => {
    // Apply the existing project material contracts to the imported train.
    // The convoy fades through material opacity, so the hitch transforms stay
    // untouched (scaling the cars would separate the couplings).
    for (const car of cars) {
      setupNamedMaterials(car);
      car.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const material of materials) material.transparent = true;
      });
    }
  }, [cars]);

  useEffect(() => {
    progress.current = 0;
  }, [routeLength]);

  useEffect(() => {
    delay.current = Math.max(0, startDelay);
  }, [startDelay]);

  useFrame((_, delta) => {
    if (delay.current > 0) {
      delay.current -= delta;
      for (const car of carRefs.current) {
        if (car) car.visible = false;
      }
      return;
    }

    if (pause.current > 0) {
      pause.current -= delta;
      for (const car of carRefs.current) {
        if (car) car.visible = false;
      }
      if (pause.current <= 0) {
        progress.current = 0;
        delay.current = Math.max(0, startDelay);
      }
      return;
    }

    progress.current = Math.min(
      routeLength,
      progress.current + delta * TRAIN_SPEED,
    );
    const fadeIn = THREE.MathUtils.clamp(
      (progress.current - carLength) / FADE_IN_DISTANCE,
      0,
      1,
    );
    const fadeOut = THREE.MathUtils.clamp(
      (routeLength - progress.current) / FADE_OUT_DISTANCE,
      0,
      1,
    );
    const fade =
      fadeIn * fadeIn * (3 - 2 * fadeIn) *
      (fadeOut * fadeOut * (3 - 2 * fadeOut));

    for (const car of carRefs.current) {
      if (!car) continue;
      car.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const material of materials) {
          material.opacity = fade;
          material.depthWrite = fade > 0.99;
        }
      });
    }

    const headAlongPath = reverse
      ? routeLength - progress.current
      : progress.current;

    for (let index = 0; index < CAR_COUNT; index += 1) {
      const car = carRefs.current[index];
      if (!car) continue;

      const frontDistance =
        headAlongPath - travelSign * index * carStride;
      const rearDistance = frontDistance - travelSign * carLength;
      if (
        frontDistance < 0 ||
        frontDistance > routeLength ||
        rearDistance < 0 ||
        rearDistance > routeLength
      ) {
        car.visible = false;
        continue;
      }

      frontTarget.copy(
        curve.getPointAt(
          THREE.MathUtils.clamp(frontDistance / routeLength, 0, 1),
        ),
      );
      rearTarget.copy(
        curve.getPointAt(
          THREE.MathUtils.clamp(rearDistance / routeLength, 0, 1),
        ),
      );
      direction.subVectors(frontTarget, rearTarget);
      if (direction.lengthSq() < 1e-6) continue;
      direction.normalize();

      const reversedCar = REVERSED_CARS[index] ?? false;
      modelDirection.copy(direction);
      if (reversedCar) modelDirection.multiplyScalar(-1);
      car.quaternion.setFromUnitVectors(localForward, modelDirection);
      // En el coche invertido, el enganche que mira al centro del tren es el
      // trasero local; en el resto es el delantero.
      const couplerOffset = reversedCar ? -rearZ : frontZ;
      car.position.copy(frontTarget).addScaledVector(direction, -couplerOffset);
      car.position.y += wheelOffset + verticalOffset;
      car.visible = fade > 0.01;
    }

    if (progress.current >= routeLength) {
      pause.current = LOOP_PAUSE;
    }
  });

  return (
    <group ref={trainRef}>
      {cars.map((scene, index) => (
        <group
          key={index}
          ref={(node) => {
            carRefs.current[index] = node;
          }}
        >
          <primitive object={scene} />
        </group>
      ))}
    </group>
  );
}
