import * as THREE from 'three';
import { PALETTE } from '../data/scene-config';

// Material de ventanas: un único shader para todas las ventanas.
// La independencia de cada ventana sale de una isla de geometría (GLB fusionado)
// o de un objeto separado, no de un material por ventana. El contrato final usa
// un solo material `luz` y cada ventana como objeto en Blender.
const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

// Uniforms compartidos por todos los materiales de ventana.
// Windows.tsx los actualiza cada frame con la hora de la escena.
const uniforms = {
  uWindowNight: { value: 0 },
  uWindowTownHour: { value: 12 },
  uWindowDuskHour: { value: 18.5 },
  uWindowTime: { value: 0 },
};

export function updateWindowLighting(
  nightFactor: number,
  townHour: number,
  duskHour: number,
  elapsedTime: number,
) {
  uniforms.uWindowNight.value = nightFactor;
  uniforms.uWindowTownHour.value = townHour;
  uniforms.uWindowDuskHour.value = duskHour;
  uniforms.uWindowTime.value = elapsedTime;
}

function seedFromPoint(x: number, y: number, z: number): number {
  const hash = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return hash - Math.floor(hash);
}

function readBakedSeed(
  geometry: THREE.BufferGeometry,
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
): number | null {
  // Semilla horneada por scripts/prepare_lights.mjs. glTF conserva `_SEED`;
  // Three normaliza el nombre del atributo a `_seed` al cargar.
  const baked = geometry.getAttribute('_seed') ?? geometry.getAttribute('_SEED');
  if (!baked || baked.count !== position.count) return null;

  const seeds = new Set<number>();
  for (let i = 0; i < baked.count; i += 1) seeds.add(baked.getX(i));
  geometry.setAttribute('windowSeed', baked);
  geometry.userData.windowIslandCount = seeds.size;
  return seeds.size;
}

// Un objeto de Blender = una ventana lógica. Si el GLB tiene varias ventanas
// separadas, todas las caras de ese objeto comparten semilla; así un marco con
// varios cristales no parpadea por partes.
function addObjectSeed(geometry: THREE.BufferGeometry, object: THREE.Object3D): number {
  if (geometry.getAttribute('windowSeed')) {
    return Number(geometry.userData.windowIslandCount ?? 0);
  }

  const position = geometry.getAttribute('position');
  if (!position) return 0;

  const baked = readBakedSeed(geometry, position);
  if (baked !== null) return baked;

  geometry.computeBoundingSphere();
  const center = geometry.boundingSphere?.center ?? new THREE.Vector3();
  object.updateWorldMatrix(true, false);
  center.applyMatrix4(object.matrixWorld);
  const seed = seedFromPoint(center.x, center.y, center.z);

  const data = new Float32Array(position.count).fill(seed);
  geometry.setAttribute('windowSeed', new THREE.BufferAttribute(data, 1));
  geometry.userData.windowIslandCount = 1;
  return 1;
}

// GLB fusionado: cada ventana es una isla desconectada. El exportador glTF
// duplica vértices por cara (normales), así que unir solo por índice daría
// 5 islas por ventana. Unimos por posición (1 mm) y después por triángulo.
function addWindowSeeds(geometry: THREE.BufferGeometry, object: THREE.Object3D): number {
  if (geometry.getAttribute('windowSeed')) {
    return Number(geometry.userData.windowIslandCount ?? 0);
  }

  const position = geometry.getAttribute('position');
  if (!position) return 0;

  const baked = readBakedSeed(geometry, position);
  if (baked !== null) return baked;

  object.updateWorldMatrix(true, false);
  const worldMatrix = object.matrixWorld;
  const count = position.count;
  const parent = new Int32Array(count);
  for (let i = 0; i < count; i += 1) parent[i] = i;

  const find = (value: number): number => {
    let i = value;
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };

  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  // Vértices partidos por normales/UV: mismo punto -> misma isla.
  const quantize = (value: number) => Math.round(value * 1000);
  const byPosition = new Map<string, number>();
  for (let i = 0; i < count; i += 1) {
    const key = `${quantize(position.getX(i))},${quantize(position.getY(i))},${quantize(
      position.getZ(i),
    )}`;
    const previous = byPosition.get(key);
    if (previous === undefined) byPosition.set(key, i);
    else union(previous, i);
  }

  const index = geometry.index;
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      union(index.getX(i), index.getX(i + 1));
      union(index.getX(i), index.getX(i + 2));
    }
  } else {
    for (let i = 0; i < count; i += 3) {
      union(i, i + 1);
      union(i, i + 2);
    }
  }

  const sums = new Map<number, { x: number; y: number; z: number; n: number }>();
  for (let i = 0; i < count; i += 1) {
    const root = find(i);
    const sum = sums.get(root);
    if (sum) {
      sum.x += position.getX(i);
      sum.y += position.getY(i);
      sum.z += position.getZ(i);
      sum.n += 1;
    } else {
      sums.set(root, {
        x: position.getX(i),
        y: position.getY(i),
        z: position.getZ(i),
        n: 1,
      });
    }
  }

  // Semilla estable por isla a partir de su centro en mundo. Usar la posición
  // local haría que ventanas separadas con la misma geometría compartieran
  // semilla aunque sus nodos estuvieran en sitios distintos.
  const seeds = new Map<number, number>();
  const point = new THREE.Vector3();
  for (const [root, sum] of sums) {
    point.set(sum.x / sum.n, sum.y / sum.n, sum.z / sum.n).applyMatrix4(worldMatrix);
    seeds.set(root, seedFromPoint(point.x, point.y, point.z));
  }

  const data = new Float32Array(count);
  for (let i = 0; i < count; i += 1) data[i] = seeds.get(find(i)) ?? 0;

  geometry.setAttribute('windowSeed', new THREE.BufferAttribute(data, 1));
  geometry.userData.windowIslandCount = sums.size;
  return sums.size;
}

function createWindowMaterial(original: THREE.Material): THREE.MeshStandardMaterial {
  const source = original as THREE.MeshStandardMaterial;
  const material = new THREE.MeshStandardMaterial({
    name: original.name,
    color: source.color?.clone() ?? new THREE.Color('#2E3B40'),
    roughness: 0.32,
    metalness: 0.08,
    emissive: new THREE.Color(PALETTE.nightLight),
    emissiveIntensity: 2.8,
    side: original.side,
    flatShading: source.flatShading,
    transparent: original.transparent,
    opacity: original.opacity,
    alphaTest: original.alphaTest,
  });
  material.userData.windowGlass = true;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindowNight = uniforms.uWindowNight;
    shader.uniforms.uWindowTownHour = uniforms.uWindowTownHour;
    shader.uniforms.uWindowDuskHour = uniforms.uWindowDuskHour;
    shader.uniforms.uWindowTime = uniforms.uWindowTime;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float windowSeed;\nvarying float vWindowSeed;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWindowSeed = windowSeed;');

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vWindowSeed;\nuniform float uWindowNight;\nuniform float uWindowTownHour;\nuniform float uWindowDuskHour;\nuniform float uWindowTime;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float seed = vWindowSeed;

          // La noche se cuenta de forma continua desde el anochecer hasta las
          // 4:00 del día siguiente. Después de medianoche sumamos 24 h para no
          // cortar la rampa en el cambio de día.
          float hour = uWindowTownHour < 12.0 ? uWindowTownHour + 24.0 : uWindowTownHour;
          float dusk = uWindowDuskHour;
          float offStart = 22.0;
          float fourAM = 28.0;
          float litFraction;

          if (hour < dusk) {
            // Última hora del día: encendido progresivo y rápido hasta el 80 %.
            litFraction = 0.8 * smoothstep(0.0, 1.0, uWindowNight);
          } else if (hour < offStart) {
            // Desde el anochecer hasta las 22:00 no se apaga ninguna.
            litFraction = 0.8;
          } else if (hour < fourAM) {
            // 22:00 -> 4:00: el umbral baja de forma continua de 0,8 a 0,1.
            float nightProgress = clamp((hour - offStart) / (fourAM - offStart), 0.0, 1.0);
            litFraction = mix(0.8, 0.1, nightProgress);
          } else {
            // 4:00 -> amanecer: queda el 10 % y se apaga del todo con el día.
            litFraction = 0.1 * uWindowNight;
          }

          // Cada ventana tiene una semilla estable: el umbral común las apaga
          // una a una, sin encenderlas ni apagarlas todas a la vez.
          float lit = step(seed, litFraction);
          // Variación mínima para que no parezcan bombillas perfectas.
          float flicker = 0.92 + 0.08 * sin(uWindowTime * (0.6 + seed) + seed * 37.0);
          totalEmissiveRadiance *= lit * flicker;
        }`,
      );
  };
  material.customProgramCacheKey = () => 'window-glass-v2';
  material.needsUpdate = true;
  return material;
}

function isWindowGlass(name: string, meshKey: string, force: boolean): boolean {
  const key = normalizeName(name);
  if (key.includes('marco')) return false;

  // Contrato final de Blender: material único `luz`. Como las farolas usan el
  // mismo nombre, solo se acepta aquí si el nodo se llama `ventana...` o si
  // Windows.tsx fuerza el rol porque el GLB es exclusivamente de ventanas.
  if (key === 'luz') return force || meshKey.includes('ventana');
  if (key === 'luzventana' || key === 'ventanaluz') return true;

  return key === 'ventana' || key.includes('cristal') || key.includes('vidrio');
}

export function setupWindowMaterials(scene: THREE.Object3D, force = false) {
  const cache = new WeakMap<THREE.Material, THREE.MeshStandardMaterial>();
  const windowMeshes: THREE.Mesh[] = [];

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    // El nodo o su grupo padre identifican el rol cuando el material es `luz`.
    const meshKey = normalizeName(`${mesh.name} ${mesh.parent?.name ?? ''}`);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let hasWindowGlass = false;

    const next = materials.map((material) => {
      if (material.userData.windowGlass) {
        hasWindowGlass = true;
        return material;
      }
      if (!isWindowGlass(material.name, meshKey, force)) return material;

      let windowMaterial = cache.get(material);
      if (!windowMaterial) {
        windowMaterial = createWindowMaterial(material);
        cache.set(material, windowMaterial);
      }
      hasWindowGlass = true;
      return windowMaterial;
    });

    if (hasWindowGlass) {
      mesh.material = Array.isArray(mesh.material) ? next : next[0];
      windowMeshes.push(mesh);
    }
  });

  // GLB final: varios objetos separados -> una semilla por objeto. GLB de
  // prueba/fusionado: un solo mesh -> una semilla por isla.
  const perObject = windowMeshes.length > 1;
  for (const mesh of windowMeshes) {
    const windows = perObject
      ? addObjectSeed(mesh.geometry, mesh)
      : addWindowSeeds(mesh.geometry, mesh);
    mesh.userData.windowIslandCount = windows;
  }
}
