import { useEffect, useMemo, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getTerrainHeightIndex } from '../lib/terrainHeight';
import { useTimeOfDay } from '../lighting/useTimeOfDay';

const TERRAIN_URL = `${import.meta.env.BASE_URL}models/terrain.glb`;
const CLOUD_DAY_COLOR = new THREE.Color('#d8ecf1');
const CLOUD_NIGHT_COLOR = new THREE.Color('#37455c');

// Ajustes rápidos de forma y acabado.
// objectSpacing:
//   0  = todos los puffs comparten el mismo origen
//   1  = cada puff toca a su padre
//   >1 = separación creciente
const CLOUD_TUNING = {
  numMinGroups: 3,
  numMaxGroups: 8,
  spawnRadiusMin: 0.6,
  spawnRadiusMax: 0.9,
  // Margen exterior normalizado sobre el radio del terreno.
  spawnOuterMargin: 0,
  numMinBig: 15,
  numMaxBig: 30,
  mediumFactor: 1.5,
  smallFactor: 2,
  sizeMinBig: 120,
  sizeMaxBig: 180,
  sizeMinMedium: 70,
  sizeMaxMedium: 60,
  sizeMinSmall: 20,
  sizeMaxSmall: 30,
  heightMinGroup: 275,
  heightMaxGroup: 400,
  // Velocidad angular en radianes por segundo.
  orbitVelocityMin: 0.004,
  orbitVelocityMax: 0.01,
  objectSpacing: 0.3,
  // Desvío vertical máximo en metros, simétrico hacia arriba y abajo.
  verticalJitter: 20,
  spriteCoreStart: 0.2,
  spriteCoreEnd: 0.6,
  haloStrength: 0.1,
  opacity: 0.15,
};

function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(value: number) {
  return value * value * (3 - 2 * value);
}

function randomInt(random: () => number, min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randomRange(random: () => number, min: number, max: number) {
  return min + random() * (max - min);
}

interface CloudPuff {
  x: number;
  y: number;
  z: number;
  radius: number;
  alpha: number;
  shade: number;
}

interface CloudSpec {
  puffs: CloudPuff[];
  radius: number;
}

interface PlacedCloud {
  spec: CloudSpec;
  x: number;
  z: number;
  ground: number;
}

interface CloudOrbit {
  phase: number;
  speed: number;
}

interface InstanceData {
  baseCenters: Float32Array;
  centers: Float32Array;
  orbitCenterX: number;
  orbitCenterZ: number;
  groupOf: Uint16Array;
  groups: CloudOrbit[];
  sizes: Float32Array;
  alphas: Float32Array;
  shades: Float32Array;
  sortedCenters: Float32Array;
  sortedSizes: Float32Array;
  sortedAlphas: Float32Array;
  sortedShades: Float32Array;
  order: number[];
  centerAttribute: THREE.InstancedBufferAttribute;
  sizeAttribute: THREE.InstancedBufferAttribute;
  alphaAttribute: THREE.InstancedBufferAttribute;
  shadeAttribute: THREE.InstancedBufferAttribute;
}

function createCloudGeometry(
  terrain: ReturnType<typeof getTerrainHeightIndex>,
  terrainBounds: THREE.Box3,
) {
  // Semilla nueva en cada carga para que F5 no repita el mismo cielo.
  const random = mulberry32((Math.random() * 0xffffffff) >>> 0);
  const specs: CloudSpec[] = [];
  const groupCount = randomInt(random, CLOUD_TUNING.numMinGroups, CLOUD_TUNING.numMaxGroups);
  const bigCounts = Array.from({ length: groupCount }, () =>
    randomInt(random, CLOUD_TUNING.numMinBig, CLOUD_TUNING.numMaxBig),
  );
  if (groupCount >= 2) {
    // Garantiza que en cada generación haya un grupo mínimo y uno máximo.
    bigCounts[0] = CLOUD_TUNING.numMinBig;
    bigCounts[1] = CLOUD_TUNING.numMaxBig;
    for (let i = bigCounts.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [bigCounts[i], bigCounts[j]] = [bigCounts[j], bigCounts[i]];
    }
  }

  for (let clusterIndex = 0; clusterIndex < groupCount; clusterIndex += 1) {
    const xScale = 1.3 + random() * 0.5;
    const yScale = 0.42 + random() * 0.16;
    const zScale = 0.85 + random() * 0.2;
    const rotation = random() * Math.PI * 2;
    const rotationCos = Math.cos(rotation);
    const rotationSin = Math.sin(rotation);
    const localPuffs: CloudPuff[] = [];

    const addAttachedPuff = (
      parent: CloudPuff,
      radius: number,
      verticalOffset: number,
      alpha: number,
      shade: number,
    ) => {
      const distance = (parent.radius + radius) * CLOUD_TUNING.objectSpacing;
      const vertical = verticalOffset;
      const horizontal = Math.sqrt(Math.max(0, distance * distance - vertical * vertical));
      const angle = random() * Math.PI * 2;
      localPuffs.push({
        x: parent.x + Math.cos(angle) * horizontal,
        y: parent.y + vertical,
        z: parent.z + Math.sin(angle) * horizontal,
        radius,
        alpha,
        shade,
      });
    };

    // Formas grandes enganchadas entre sí; la primera fija el origen.
    const largeCount = bigCounts[clusterIndex] ?? CLOUD_TUNING.numMinBig;
    const firstLargeRadius = randomRange(random, CLOUD_TUNING.sizeMinBig, CLOUD_TUNING.sizeMaxBig);
    localPuffs.push({
      x: 0,
      y: (random() * 2 - 1) * CLOUD_TUNING.verticalJitter,
      z: 0,
      radius: firstLargeRadius,
      alpha: 0.8 + random() * 0.15,
      shade: 1,
    });
    for (let i = 1; i < largeCount; i += 1) {
      const parent = localPuffs[Math.floor(random() * localPuffs.length)];
      const radius = randomRange(random, CLOUD_TUNING.sizeMinBig, CLOUD_TUNING.sizeMaxBig);
      const vertical = (random() * 2 - 1) * CLOUD_TUNING.verticalJitter;
      addAttachedPuff(parent, radius, vertical, 0.8 + random() * 0.15, 1);
    }

    // Las medianas y pequeñas crecen multiplicando cada nivel anterior.
    const mediumCount = Math.round(largeCount * CLOUD_TUNING.mediumFactor);
    for (let i = 0; i < mediumCount; i += 1) {
      const parent = localPuffs[Math.floor(random() * largeCount)];
      const radius = randomRange(random, CLOUD_TUNING.sizeMinMedium, CLOUD_TUNING.sizeMaxMedium);
      const vertical = (random() * 2 - 1) * CLOUD_TUNING.verticalJitter;
      addAttachedPuff(parent, radius, vertical, 0.58 + random() * 0.2, 0.92);
    }

    const smallCount = Math.round(mediumCount * CLOUD_TUNING.smallFactor);
    for (let i = 0; i < smallCount; i += 1) {
      const parent = localPuffs[Math.floor(random() * localPuffs.length)];
      const radius = randomRange(random, CLOUD_TUNING.sizeMinSmall, CLOUD_TUNING.sizeMaxSmall);
      const vertical = (random() * 2 - 1) * CLOUD_TUNING.verticalJitter;
      addAttachedPuff(parent, radius, vertical, 0.38 + random() * 0.2, 0.84);
    }

    const puffs: CloudPuff[] = [];
    for (const puff of localPuffs) {
      const shapedX = puff.x * xScale;
      const shapedY = puff.y * yScale;
      const shapedZ = puff.z * zScale;
      const x = shapedX * rotationCos - shapedZ * rotationSin;
      const z = shapedX * rotationSin + shapedZ * rotationCos;
      const scaledRadius = puff.radius * ((xScale + zScale) * 0.5);
      puffs.push({
        x,
        y: shapedY,
        z,
        radius: scaledRadius,
        alpha: puff.alpha,
        shade: puff.shade,
      });
    }

    let radius = 0;
    for (const puff of puffs) {
      radius = Math.max(radius, Math.hypot(puff.x, puff.z) + puff.radius);
    }
    specs.push({ puffs, radius: Math.max(1, radius) });
  }

  specs.sort((a, b) => b.radius - a.radius);

  const width = terrainBounds.max.x - terrainBounds.min.x;
  const depth = terrainBounds.max.z - terrainBounds.min.z;
  const centerX = (terrainBounds.min.x + terrainBounds.max.x) * 0.5;
  const centerZ = (terrainBounds.min.z + terrainBounds.max.z) * 0.5;
  const halfWidth = width * 0.5;
  const halfDepth = depth * 0.5;
  const maxSpawnRadius = CLOUD_TUNING.spawnRadiusMax + CLOUD_TUNING.spawnOuterMargin;
  const spawnRadii = specs.map(() =>
    randomRange(random, CLOUD_TUNING.spawnRadiusMin, maxSpawnRadius),
  );
  if (spawnRadii.length >= 2) {
    // Garantiza una nube en el radio mínimo y otra en el máximo.
    spawnRadii[0] = CLOUD_TUNING.spawnRadiusMin;
    spawnRadii[1] = maxSpawnRadius;
  }

  const placed: PlacedCloud[] = [];
  for (let specIndex = 0; specIndex < specs.length; specIndex += 1) {
    const spec = specs[specIndex];
    const targetRadius = spawnRadii[specIndex];
    const angle = random() * Math.PI * 2;
    const x = centerX + Math.cos(angle) * halfWidth * targetRadius;
    const z = centerZ + Math.sin(angle) * halfDepth * targetRadius;
    const ground = terrain.heightAt(x, z) ?? terrain.nearestHeightAt(x, z) ?? 0;
    placed.push({ spec, x, z, ground });
  }

  const centers: number[] = [];
  const sizes: number[] = [];
  const alphas: number[] = [];
  const shades: number[] = [];
  const groupOf: number[] = [];
  const groups: CloudOrbit[] = [];

  for (let groupIndex = 0; groupIndex < placed.length; groupIndex += 1) {
    const { spec, x, z, ground } = placed[groupIndex];
    groups.push({
      phase: random() * Math.PI * 2,
      speed: randomRange(random, CLOUD_TUNING.orbitVelocityMin, CLOUD_TUNING.orbitVelocityMax),
    });
    const y =
      ground +
      CLOUD_TUNING.heightMinGroup +
      random() * (CLOUD_TUNING.heightMaxGroup - CLOUD_TUNING.heightMinGroup);
    const clusterRadius = Math.max(1, spec.radius);
    for (const puff of spec.puffs) {
      const q = Math.min(1, Math.hypot(puff.x, puff.z) / clusterRadius);
      const edge = THREE.MathUtils.clamp((q - 0.15) / 0.85, 0, 1);
      const radial = 1 - smoothstep(edge);
      centers.push(x + puff.x, y + puff.y, z + puff.z);
      sizes.push(puff.radius);
      alphas.push(puff.alpha * radial);
      shades.push(puff.shade);
      groupOf.push(groupIndex);
    }
  }

  const count = sizes.length;
  const baseCenters = new Float32Array(centers);
  const currentCenters = new Float32Array(baseCenters);
  const baseSizes = new Float32Array(sizes);
  const baseAlphas = new Float32Array(alphas);
  const baseShades = new Float32Array(shades);
  const sortedCenters = new Float32Array(baseCenters);
  const sortedSizes = new Float32Array(baseSizes);
  const sortedAlphas = new Float32Array(baseAlphas);
  const sortedShades = new Float32Array(baseShades);

  const quad = new THREE.PlaneGeometry(1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.getAttribute('position'));
  geometry.setAttribute('uv', quad.getAttribute('uv'));
  geometry.instanceCount = count;

  const centerAttribute = new THREE.InstancedBufferAttribute(sortedCenters, 3);
  const sizeAttribute = new THREE.InstancedBufferAttribute(sortedSizes, 1);
  const alphaAttribute = new THREE.InstancedBufferAttribute(sortedAlphas, 1);
  const shadeAttribute = new THREE.InstancedBufferAttribute(sortedShades, 1);
  geometry.setAttribute('aCenter', centerAttribute);
  geometry.setAttribute('aSize', sizeAttribute);
  geometry.setAttribute('aAlpha', alphaAttribute);
  geometry.setAttribute('aShade', shadeAttribute);
  geometry.userData.cloudInstances = {
    baseCenters,
    centers: currentCenters,
    orbitCenterX: centerX,
    orbitCenterZ: centerZ,
    groupOf: new Uint16Array(groupOf),
    groups,
    sizes: baseSizes,
    alphas: baseAlphas,
    shades: baseShades,
    sortedCenters,
    sortedSizes,
    sortedAlphas,
    sortedShades,
    order: Array.from({ length: count }, (_, index) => index),
    centerAttribute,
    sizeAttribute,
    alphaAttribute,
    shadeAttribute,
  } satisfies InstanceData;

  quad.dispose();
  return geometry;
}

const CLOUD_VERTEX_SHADER = /* glsl */ `
  attribute vec3 aCenter;
  attribute float aSize;
  attribute float aAlpha;
  attribute float aShade;

  varying float vAlpha;
  varying float vShade;
  varying vec3 vWorld;
  varying vec2 vQuad;

  void main() {
    vQuad = position.xy * 2.0;
    vAlpha = aAlpha;
    vShade = aShade;

    vec4 mvCenter = modelViewMatrix * vec4(aCenter, 1.0);
    mvCenter.xy += position.xy * aSize * 2.0;
    gl_Position = projectionMatrix * mvCenter;

    vWorld = (modelMatrix * vec4(aCenter, 1.0)).xyz;
  }
`;

const CLOUD_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uCoreStart;
  uniform float uCoreEnd;
  uniform float uHaloStrength;
  uniform vec3 uFogColor;
  uniform float uFogDensity;

  varying float vAlpha;
  varying float vShade;
  varying vec3 vWorld;
  varying vec2 vQuad;

  float cloudHash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float cloudNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(
        mix(cloudHash(i), cloudHash(i + vec3(1, 0, 0)), f.x),
        mix(cloudHash(i + vec3(0, 1, 0)), cloudHash(i + vec3(1, 1, 0)), f.x),
        f.y
      ),
      mix(
        mix(cloudHash(i + vec3(0, 0, 1)), cloudHash(i + vec3(1, 0, 1)), f.x),
        mix(cloudHash(i + vec3(0, 1, 1)), cloudHash(i + vec3(1, 1, 1)), f.x),
        f.y
      ),
      f.z
    );
  }

  float cloudFbm(vec3 p) {
    return cloudNoise(p) * 0.65 + cloudNoise(p * 2.07 + 17.0) * 0.35;
  }

  void main() {
    float vapor = cloudFbm(vWorld * 0.05 + vec3(vQuad * 0.7, 0.0));
    float radialDistance = length(vQuad) + (vapor - 0.5) * 0.2;
    if (radialDistance > 1.0) discard;

    float core = 1.0 - smoothstep(uCoreStart, uCoreEnd, radialDistance);
    float halo = 1.0 - smoothstep(0.0, 0.95, radialDistance);
    float shape = max(core, halo * uHaloStrength);
    float alpha = vAlpha * shape * mix(0.65, 1.0, vapor) * uOpacity;
    if (alpha < 0.01) discard;

    vec3 toFragment = vWorld - cameraPosition;
    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * dot(toFragment, toFragment));
    vec3 color = mix(uColor * vShade, uFogColor, clamp(fogFactor, 0.0, 1.0));

    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function Clouds({ enabled = true }: { enabled?: boolean }) {
  const { scene: terrainScene } = useGLTF(TERRAIN_URL);
  const terrain = useMemo(() => getTerrainHeightIndex(terrainScene), [terrainScene]);
  const terrainBounds = useMemo(() => new THREE.Box3().setFromObject(terrainScene), [terrainScene]);
  const geometry = useMemo(
    () => createCloudGeometry(terrain, terrainBounds),
    [terrain, terrainBounds],
  );
  const time = useTimeOfDay();
  const [initialNightFactor] = useState(() => THREE.MathUtils.clamp(time.nightFactor, 0, 1));
  const targetColor = useMemo(() => new THREE.Color(), []);
  const material = useMemo(() => {
    const initialColor = CLOUD_DAY_COLOR.clone().lerp(CLOUD_NIGHT_COLOR, initialNightFactor);
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: initialColor },
        uOpacity: { value: CLOUD_TUNING.opacity },
        uCoreStart: { value: CLOUD_TUNING.spriteCoreStart },
        uCoreEnd: { value: CLOUD_TUNING.spriteCoreEnd },
        uHaloStrength: { value: CLOUD_TUNING.haloStrength },
        uFogColor: { value: new THREE.Color('#b9d2de') },
        uFogDensity: { value: 0.00032 },
      },
      vertexShader: CLOUD_VERTEX_SHADER,
      fragmentShader: CLOUD_FRAGMENT_SHADER,
    });
  }, [initialNightFactor]);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const instanceRef = useRef<InstanceData | null>(null);

  useEffect(() => {
    instanceRef.current = (geometry.userData.cloudInstances as InstanceData | undefined) ?? null;
  }, [geometry]);

  useFrame((state, delta) => {
    const fog = scene.fog;
    if (fog instanceof THREE.FogExp2) {
      material.uniforms.uFogColor.value.copy(fog.color);
    }

    let targetNightFactor = THREE.MathUtils.clamp(time.nightFactor, 0, 1);
    if (scene.background instanceof THREE.Color) {
      const background = scene.background;
      const luminance = background.r * 0.2126 + background.g * 0.7152 + background.b * 0.0722;
      const brightness = THREE.MathUtils.clamp((luminance - 0.02) / 0.33, 0, 1);
      const smoothBrightness = brightness * brightness * (3 - 2 * brightness);
      targetNightFactor = 1 - smoothBrightness;
    }
    targetColor.copy(CLOUD_DAY_COLOR).lerp(CLOUD_NIGHT_COLOR, targetNightFactor);
    // Aproximadamente medio segundo para llegar al color de destino.
    material.uniforms.uColor.value.lerp(targetColor, 1 - Math.exp(-8 * Math.min(delta, 0.1)));

    if (!enabled) return;

    const instanceData = instanceRef.current;
    if (!instanceData) return;

    const {
      baseCenters,
      centers,
      orbitCenterX,
      orbitCenterZ,
      groupOf,
      groups,
      sizes,
      alphas,
      shades,
      sortedCenters,
      sortedSizes,
      sortedAlphas,
      sortedShades,
      order,
    } = instanceData;
    for (let i = 0; i < order.length; i += 1) {
      const group = groups[groupOf[i]];
      const theta = group.phase + state.clock.elapsedTime * group.speed;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      const baseX = baseCenters[i * 3] - orbitCenterX;
      const baseZ = baseCenters[i * 3 + 2] - orbitCenterZ;
      centers[i * 3] = orbitCenterX + baseX * cosTheta - baseZ * sinTheta;
      centers[i * 3 + 1] = baseCenters[i * 3 + 1];
      centers[i * 3 + 2] = orbitCenterZ + baseX * sinTheta + baseZ * cosTheta;
    }

    const cameraPosition = camera.position;
    order.sort((a, b) => {
      const ax = centers[a * 3] - cameraPosition.x;
      const ay = centers[a * 3 + 1] - cameraPosition.y;
      const az = centers[a * 3 + 2] - cameraPosition.z;
      const bx = centers[b * 3] - cameraPosition.x;
      const by = centers[b * 3 + 1] - cameraPosition.y;
      const bz = centers[b * 3 + 2] - cameraPosition.z;
      return bx * bx + by * by + bz * bz - (ax * ax + ay * ay + az * az);
    });

    for (let i = 0; i < order.length; i += 1) {
      const source = order[i];
      sortedCenters[i * 3] = centers[source * 3];
      sortedCenters[i * 3 + 1] = centers[source * 3 + 1];
      sortedCenters[i * 3 + 2] = centers[source * 3 + 2];
      sortedSizes[i] = sizes[source];
      sortedAlphas[i] = alphas[source];
      sortedShades[i] = shades[source];
    }

    instanceData.centerAttribute.needsUpdate = true;
    instanceData.sizeAttribute.needsUpdate = true;
    instanceData.alphaAttribute.needsUpdate = true;
    instanceData.shadeAttribute.needsUpdate = true;
  });

  useEffect(
    () => () => {
      material.dispose();
      geometry.dispose();
    },
    [geometry, material],
  );

  return (
    <mesh
      geometry={geometry}
      material={material}
      castShadow={false}
      receiveShadow={false}
      frustumCulled={false}
      visible={enabled}
    />
  );
}
