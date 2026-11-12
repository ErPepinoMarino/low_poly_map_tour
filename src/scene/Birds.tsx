import { useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getTerrainHeightIndex } from '../lib/terrainHeight';
import { useTimeOfDay } from '../lighting/useTimeOfDay';

const TERRAIN_URL = `${import.meta.env.BASE_URL}models/terrain.glb`;
const BIRD_CLEARANCE = 55;
const EDGE_MARGIN = 90;
const FORWARD = new THREE.Vector3(0, 0, 1);

// Ajustes de las bandadas migratorias.
const BIRD_TUNING = {
  birdsPerFlockMin: 5,
  birdsPerFlockMax: 20,
  flocksPerIterationMin: 1,
  flocksPerIterationMax: 2,
  birdScaleMin: 2,
  birdScaleMax: 4,
  formationSideSpacing: 5,
  formationBackSpacing: 8,
  iterationGapMin: 12,
  iterationGapMax: 30,
  initialDelay: 4,
  dayColor: '#9da8ac',
  nightColor: '#2e3642',
} as const;

const FLOCK_SLOTS = BIRD_TUNING.flocksPerIterationMax;
const MAX_BIRDS = BIRD_TUNING.birdsPerFlockMax;
const MEMBER_OFFSETS = createMemberOffsets(
  MAX_BIRDS,
  BIRD_TUNING.formationSideSpacing,
  BIRD_TUNING.formationBackSpacing,
);
const MEMBER_MOTION = MEMBER_OFFSETS.map(() => ({
  phase: randomRange(0, Math.PI * 2),
  frequency: randomRange(5.2, 9.6),
  amplitude: randomRange(0.34, 0.72),
}));

interface FlockRuntime {
  active: boolean;
  progress: number;
  duration: number;
  start: THREE.Vector3;
  end: THREE.Vector3;
  flapTime: number;
  flapPhase: number;
  birdCount: number;
  scale: number;
}

interface WingRefs {
  left: THREE.Mesh | null;
  right: THREE.Mesh | null;
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number) {
  return Math.floor(randomRange(min, max + 1));
}

function createWingGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([0.0, 0.0, 0.45, -1.5, 0.0, 0.0, 0.0, 0.0, -0.7]),
      3,
    ),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function createBodyGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([0.0, 0.0, 0.8, 0.18, 0.0, -0.2, -0.18, 0.0, -0.2]),
      3,
    ),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function createMemberOffsets(maxBirds: number, sideSpacing: number, backSpacing: number) {
  const offsets: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0)];
  for (let rank = 1; offsets.length < maxBirds; rank += 1) {
    const back = rank * backSpacing;
    const side = rank * sideSpacing;
    offsets.push(new THREE.Vector3(side, rank * 0.12, -back));
    if (offsets.length < maxBirds) {
      offsets.push(new THREE.Vector3(-side, -rank * 0.08, -back));
    }
  }
  return offsets;
}

function buildRoute(bounds: THREE.Box3, terrain: ReturnType<typeof getTerrainHeightIndex>) {
  const minX = bounds.min.x;
  const maxX = bounds.max.x;
  const minZ = bounds.min.z;
  const maxZ = bounds.max.z;
  const edge = Math.floor(Math.random() * 4);

  let startX: number;
  let startZ: number;
  let endX: number;
  let endZ: number;

  if (edge === 0 || edge === 1) {
    startX = edge === 0 ? minX - EDGE_MARGIN : maxX + EDGE_MARGIN;
    endX = edge === 0 ? maxX + EDGE_MARGIN : minX - EDGE_MARGIN;
    startZ = randomRange(minZ, maxZ);
    endZ = randomRange(minZ, maxZ);
  } else {
    startZ = edge === 2 ? minZ - EDGE_MARGIN : maxZ + EDGE_MARGIN;
    endZ = edge === 2 ? maxZ + EDGE_MARGIN : minZ - EDGE_MARGIN;
    startX = randomRange(minX, maxX);
    endX = randomRange(minX, maxX);
  }

  let maxTerrainHeight = 0;
  for (let step = 0; step <= 64; step += 1) {
    const t = step / 64;
    const x = THREE.MathUtils.lerp(startX, endX, t);
    const z = THREE.MathUtils.lerp(startZ, endZ, t);
    const height = terrain.heightAt(x, z) ?? terrain.nearestHeightAt(x, z);
    if (height !== null) maxTerrainHeight = Math.max(maxTerrainHeight, height);
  }

  const altitude = maxTerrainHeight + BIRD_CLEARANCE + randomRange(0, 20);
  const start = new THREE.Vector3(startX, altitude, startZ);
  const end = new THREE.Vector3(endX, altitude, endZ);
  const distance = start.distanceTo(end);
  const speed = randomRange(32, 46);

  return { start, end, duration: distance / speed };
}

export default function Birds() {
  const { scene: terrainScene } = useGLTF(TERRAIN_URL);
  const terrain = useMemo(() => getTerrainHeightIndex(terrainScene), [terrainScene]);
  const bounds = useMemo(() => new THREE.Box3().setFromObject(terrainScene), [terrainScene]);
  const scene = useThree((state) => state.scene);
  const time = useTimeOfDay();

  const wingGeometry = useMemo(() => createWingGeometry(), []);
  const bodyGeometry = useMemo(() => createBodyGeometry(), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: BIRD_TUNING.dayColor,
        side: THREE.DoubleSide,
        fog: true,
      }),
    [],
  );
  const dayColor = useMemo(() => new THREE.Color(BIRD_TUNING.dayColor), []);
  const nightColor = useMemo(() => new THREE.Color(BIRD_TUNING.nightColor), []);
  const targetColor = useMemo(() => new THREE.Color(), []);

  const flockGroups = useRef<Array<THREE.Group | null>>([]);
  const birdGroups = useRef<Array<Array<THREE.Group | null>>>([]);
  const wingRefs = useRef<Array<Array<WingRefs>>>([]);
  const flocks = useRef<FlockRuntime[]>(
    Array.from({ length: FLOCK_SLOTS }, () => ({
      active: false,
      progress: 0,
      duration: 1,
      start: new THREE.Vector3(),
      end: new THREE.Vector3(),
      flapTime: 0,
      flapPhase: 0,
      birdCount: BIRD_TUNING.birdsPerFlockMin,
      scale: BIRD_TUNING.birdScaleMin,
    })),
  );
  const wave = useRef<{ active: boolean; wait: number }>({
    active: false,
    wait: BIRD_TUNING.initialDelay,
  });
  const direction = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    let targetNightFactor = THREE.MathUtils.clamp(time.nightFactor, 0, 1);
    if (scene.background instanceof THREE.Color) {
      const background = scene.background;
      const luminance = background.r * 0.2126 + background.g * 0.7152 + background.b * 0.0722;
      const brightness = THREE.MathUtils.clamp((luminance - 0.02) / 0.33, 0, 1);
      const smoothBrightness = brightness * brightness * (3 - 2 * brightness);
      targetNightFactor = 1 - smoothBrightness;
    }
    targetColor.copy(dayColor).lerp(nightColor, targetNightFactor);
    material.color.lerp(targetColor, 1 - Math.exp(-8 * Math.min(delta, 0.1)));

    const dt = Math.min(delta, 0.1);
    const activeFlocks = flocks.current;

    if (!wave.current.active) {
      wave.current.wait -= dt;
      if (wave.current.wait <= 0) {
        const flockCount = randomInt(
          BIRD_TUNING.flocksPerIterationMin,
          BIRD_TUNING.flocksPerIterationMax,
        );

        for (let index = 0; index < activeFlocks.length; index += 1) {
          const flock = activeFlocks[index];
          const group = flockGroups.current[index];
          if (index >= flockCount) {
            flock.active = false;
            if (group) group.visible = false;
            continue;
          }

          const route = buildRoute(bounds, terrain);
          flock.active = true;
          flock.progress = 0;
          flock.duration = route.duration;
          flock.start.copy(route.start);
          flock.end.copy(route.end);
          flock.flapTime = Math.random() * 10;
          flock.flapPhase = Math.random() * Math.PI * 2;
          flock.birdCount = randomInt(BIRD_TUNING.birdsPerFlockMin, BIRD_TUNING.birdsPerFlockMax);
          flock.scale = randomRange(BIRD_TUNING.birdScaleMin, BIRD_TUNING.birdScaleMax);

          if (!group) continue;
          group.position.copy(route.start);
          direction.current.subVectors(route.end, route.start);
          direction.current.y = 0;
          if (direction.current.lengthSq() > 1e-6) direction.current.normalize();
          group.quaternion.setFromUnitVectors(FORWARD, direction.current);
          group.visible = true;

          const members = birdGroups.current[index];
          if (members) {
            for (let memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
              const member = members[memberIndex];
              if (!member) continue;
              member.visible = memberIndex < flock.birdCount;
              member.scale.setScalar(flock.scale);
            }
          }
        }
        wave.current.active = true;
      }
    }

    let anyActive = false;
    for (let index = 0; index < activeFlocks.length; index += 1) {
      const flock = activeFlocks[index];
      const group = flockGroups.current[index];
      if (!flock.active || !group) continue;
      anyActive = true;

      flock.progress += dt / flock.duration;
      if (flock.progress >= 1) {
        flock.active = false;
        group.visible = false;
        continue;
      }

      group.position.lerpVectors(flock.start, flock.end, flock.progress);
      group.position.y += Math.sin(flock.progress * Math.PI * 6) * 3.5;
      flock.flapTime += dt;

      const wingPairs = wingRefs.current[index];
      if (wingPairs) {
        for (let memberIndex = 0; memberIndex < wingPairs.length; memberIndex += 1) {
          const wings = wingPairs[memberIndex];
          const motion = MEMBER_MOTION[memberIndex];
          if (!wings?.left || !wings.right || !motion) continue;
          const flap =
            Math.sin(flock.flapTime * motion.frequency + motion.phase + flock.flapPhase) *
            motion.amplitude;
          wings.left.rotation.z = flap;
          wings.right.rotation.z = -flap;
        }
      }
    }

    if (wave.current.active && !anyActive) {
      wave.current.active = false;
      wave.current.wait = randomRange(BIRD_TUNING.iterationGapMin, BIRD_TUNING.iterationGapMax);
    }
  });

  return (
    <>
      {Array.from({ length: FLOCK_SLOTS }, (_, flockIndex) => (
        <group
          key={flockIndex}
          ref={(node) => {
            flockGroups.current[flockIndex] = node;
          }}
          visible={false}
        >
          {MEMBER_OFFSETS.map((offset, memberIndex) => (
            <group
              key={memberIndex}
              position={offset}
              scale={BIRD_TUNING.birdScaleMin}
              ref={(node) => {
                const members = (birdGroups.current[flockIndex] ??= []);
                members[memberIndex] = node;
              }}
            >
              <mesh
                geometry={wingGeometry}
                material={material}
                ref={(node) => {
                  const wings = (wingRefs.current[flockIndex] ??= []);
                  const entry = (wings[memberIndex] ??= { left: null, right: null });
                  entry.left = node;
                }}
              />
              <mesh
                geometry={wingGeometry}
                material={material}
                scale={[-1, 1, 1]}
                ref={(node) => {
                  const wings = (wingRefs.current[flockIndex] ??= []);
                  const entry = (wings[memberIndex] ??= { left: null, right: null });
                  entry.right = node;
                }}
              />
              <mesh geometry={bodyGeometry} material={material} />
            </group>
          ))}
        </group>
      ))}
    </>
  );
}
