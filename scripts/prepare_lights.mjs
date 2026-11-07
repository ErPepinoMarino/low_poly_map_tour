import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { NodeIO, getBounds } from '@gltf-transform/core';

// Valida los GLB de luces y, opcionalmente, hornea `_SEED` por ventana.
//
// Uso:
//   node scripts/prepare_lights.mjs
//   node scripts/prepare_lights.mjs --write
//
// El modo normal no modifica ningún asset: comprueba el contrato de Blender,
// cuenta ventanas/farolas y muestra las semillas que usaría el shader.
// Con --write genera public/models/ventanas.prepared.glb con el atributo
// `_SEED`; Three lo recibe como `_seed` y lo asigna a `windowSeed`.

const ROOT = process.cwd();
const MODELS = path.join(ROOT, 'public', 'models');
const WINDOWS_FILE = path.join(MODELS, 'ventanas.glb');
const FAROLAS_FILE = path.join(MODELS, 'farolas.glb');
const TERRAIN_FILE = path.join(MODELS, 'terrain.glb');
const OUTPUT_FILE = path.join(MODELS, 'ventanas.prepared.glb');
const WRITE = process.argv.includes('--write');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Uso: node scripts/prepare_lights.mjs [--write]');
  console.log('  --write  genera public/models/ventanas.prepared.glb con _SEED');
  process.exit(0);
}

const io = new NodeIO();
const errors = [];
const warnings = [];
const notes = [];

const normalize = (name = '') => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);
const note = (message) => notes.push(message);

function seedFromCenter(cx, cy, cz) {
  const hash = Math.sin(cx * 12.9898 + cy * 78.233 + cz * 37.719) * 43758.5453;
  return hash - Math.floor(hash);
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Misma rampa que el shader, para poder enseñar cuántas ventanas quedarían
// encendidas a una hora concreta.
function windowFraction(hour, duskHour, nightFactor) {
  const t = hour < 12 ? hour + 24 : hour;
  const offStart = 22;
  if (t < duskHour) return 0.8 * smoothstep(0, 1, nightFactor);
  if (t < offStart) return 0.8;
  if (t < 28) {
    const progress = Math.min(1, Math.max(0, (t - offStart) / (28 - offStart)));
    return 0.8 + (0.1 - 0.8) * progress;
  }
  return 0.1 * nightFactor;
}

function readVec3(accessor) {
  const array = accessor?.getArray();
  if (!array) return [];
  const out = [];
  for (let i = 0; i < array.length; i += 3) out.push([array[i], array[i + 1], array[i + 2]]);
  return out;
}

function transformPoint(matrix, [x, y, z]) {
  // glTF usa matrices column-major, igual que Three.
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

function averageWorld(positions, matrix) {
  if (positions.length === 0) return [0, 0, 0];
  const sum = [0, 0, 0];
  for (const point of positions) {
    const world = transformPoint(matrix, point);
    sum[0] += world[0];
    sum[1] += world[1];
    sum[2] += world[2];
  }
  return sum.map((value) => value / positions.length);
}

// Detecta ventanas por conectividad de posición + triángulos. glTF duplica
// vértices por cara, así que unir solo por índice daría 5 islas por ventana.
function findIslands(primitives, worldMatrix) {
  const positions = [];
  const triangles = [];
  const primitiveOffsets = [];

  for (const primitive of primitives) {
    const offset = positions.length;
    const local = readVec3(primitive.getAttribute('POSITION'));
    positions.push(...local);

    const indices = primitive.getIndices()?.getArray();
    if (indices) {
      for (let i = 0; i < indices.length; i += 3) {
        triangles.push([offset + indices[i], offset + indices[i + 1], offset + indices[i + 2]]);
      }
    } else {
      for (let i = 0; i < local.length; i += 3) {
        triangles.push([offset + i, offset + i + 1, offset + i + 2]);
      }
    }
    primitiveOffsets.push({ primitive, offset, count: local.length });
  }

  const count = positions.length;
  const parent = new Int32Array(count);
  for (let i = 0; i < count; i += 1) parent[i] = i;

  const find = (value) => {
    let i = value;
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  const quantize = (value) => Math.round(value * 1000);
  const byPosition = new Map();
  positions.forEach(([x, y, z], index) => {
    const key = `${quantize(x)},${quantize(y)},${quantize(z)}`;
    if (byPosition.has(key)) union(byPosition.get(key), index);
    else byPosition.set(key, index);
  });
  for (const [a, b, c] of triangles) {
    union(a, b);
    union(a, c);
  }

  const sums = new Map();
  positions.forEach(([x, y, z], index) => {
    const root = find(index);
    const sum = sums.get(root);
    if (sum) {
      sum.x += x;
      sum.y += y;
      sum.z += z;
      sum.n += 1;
    } else {
      sums.set(root, { x, y, z, n: 1 });
    }
  });

  const islands = [];
  const seedByRoot = new Map();
  for (const [root, sum] of sums) {
    const center = transformPoint(worldMatrix, [sum.x / sum.n, sum.y / sum.n, sum.z / sum.n]);
    const seed = seedFromCenter(...center);
    seedByRoot.set(root, seed);
    islands.push({ center, seed });
  }

  // Semilla por vértice, preparada para el atributo `_SEED`.
  const vertexSeeds = new Float32Array(count);
  positions.forEach((_, index) => {
    vertexSeeds[index] = seedByRoot.get(find(index)) ?? 0;
  });

  return { islands, vertexSeeds, primitiveOffsets, positions };
}

function collectMeshes(doc) {
  return doc
    .getRoot()
    .listNodes()
    .filter((node) => node.getMesh())
    .map((node) => ({
      node,
      mesh: node.getMesh(),
      primitives: node.getMesh().listPrimitives(),
    }));
}

function collectMaterials(meshes) {
  const names = new Set();
  for (const { primitives } of meshes) {
    for (const primitive of primitives) {
      const material = primitive.getMaterial();
      if (material?.getName()) names.add(material.getName());
    }
  }
  return [...names];
}

function validateMaterials(label, names, expected) {
  if (names.length === 0) {
    fail(`${label}: no tiene materiales.`);
    return;
  }
  const normalized = names.map(normalize);
  if (expected === 'windows' && normalized.includes('ventana')) {
    note('Ventanas: se acepta `ventana` como alias de prueba; el contrato final es `luz`.');
  }
  for (const name of names) {
    const key = normalize(name);
    const ok =
      expected === 'windows'
        ? ['luz', 'luzventana', 'ventanaluz', 'ventana', 'cristal', 'vidrio'].includes(key)
        : ['luz', 'luzfarola', 'farolaluz', 'farola'].includes(key);
    if (!ok) warn(`${label}: material inesperado "${name}".`);
    if (['terreno', 'terrain', 'suelo', 'ground', 'roca', 'rock'].includes(key)) {
      fail(`${label}: el material "${name}" parece terreno; ventanas/farolas no deben contenerlo.`);
    }
  }
  if (expected === 'windows' && names.length > 1) {
    warn(`Ventanas: hay ${names.length} materiales; el contrato final usa uno solo, \`luz\`.`);
  }
  if (expected === 'farolas' && names.length > 1) {
    warn(`Farolas: hay ${names.length} materiales; el contrato final usa uno solo, \`luz\`.`);
  }
}

function validateBounds(label, scene, terrainScene) {
  if (!scene) {
    fail(`${label}: el GLB no tiene escena.`);
    return;
  }
  const bounds = getBounds(scene);
  if (!Number.isFinite(bounds.min[0])) {
    fail(`${label}: no se pudo calcular el AABB.`);
    return;
  }
  if (!terrainScene) {
    note(`${label}: terrain.glb no está disponible; no se comprueba el AABB.`);
    return;
  }
  const terrain = getBounds(terrainScene);
  const tolerance = 1;
  const outside =
    bounds.min[0] < terrain.min[0] - tolerance ||
    bounds.min[1] < terrain.min[1] - tolerance ||
    bounds.min[2] < terrain.min[2] - tolerance ||
    bounds.max[0] > terrain.max[0] + tolerance ||
    bounds.max[1] > terrain.max[1] + tolerance ||
    bounds.max[2] > terrain.max[2] + tolerance;
  if (outside) {
    fail(
      `${label}: AABB fuera del terreno (${JSON.stringify(bounds)} vs ${JSON.stringify(terrain)}).`,
    );
  } else {
    notes.push(`${label}: AABB dentro del terreno.`);
  }
}

async function load(file) {
  try {
    return await io.read(file);
  } catch (error) {
    fail(`${path.basename(file)}: no se pudo leer (${error.message}).`);
    return null;
  }
}

const terrainScene = existsSync(TERRAIN_FILE)
  ? (await load(TERRAIN_FILE))?.getRoot().listScenes()[0]
  : null;

let windowsDoc = null;
let windowsScene = null;
let windowsReport = null;

if (!existsSync(WINDOWS_FILE)) {
  fail('ventanas.glb no existe.');
} else {
  windowsDoc = await load(WINDOWS_FILE);
  windowsScene = windowsDoc?.getRoot().listScenes()[0] ?? null;
  if (windowsDoc) {
    const meshes = collectMeshes(windowsDoc);
    const materials = collectMaterials(meshes);
    validateMaterials('Ventanas', materials, 'windows');
    validateBounds('Ventanas', windowsScene, terrainScene);

    let islandCount = 0;
    const seeds = [];
    const islandsByMesh = [];
    const perObject = meshes.length > 1;

    for (const { node, mesh, primitives } of meshes) {
      const worldMatrix = node.getWorldMatrix();
      const { islands, vertexSeeds, primitiveOffsets, positions } = findIslands(
        primitives,
        worldMatrix,
      );
      islandCount += islands.length;

      if (perObject) {
        // Varios objetos en Blender: una ventana lógica por objeto. Todas sus
        // caras comparten semilla aunque el objeto tenga varios cristales.
        const center = averageWorld(positions, worldMatrix);
        const seed = seedFromCenter(...center);
        vertexSeeds.fill(seed);
        seeds.push(seed);
      } else {
        seeds.push(...islands.map((island) => island.seed));
      }

      islandsByMesh.push({ node, mesh, primitives, islands, vertexSeeds, primitiveOffsets });
    }

    const windowCount = perObject ? meshes.length : islandCount;

    if (meshes.length === 1 && islandCount > 1) {
      warn(
        `Ventanas: 1 mesh con ${islandCount} islas. El contrato final recomienda objetos separados en Blender y fusión/seed al cargar.`,
      );
    }
    if (meshes.length > 1) {
      const withoutName = meshes.filter(
        ({ node }) => !normalize(node.getName()).includes('ventana'),
      );
      if (withoutName.length > 0) {
        warn(
          `Ventanas: ${withoutName.length} objeto(s) no se llaman ventana*; el runtime los acepta por pertenecer a ventanas.glb, pero nombres claros ayudan a depurar.`,
        );
      }
    }
    if (islandCount === 0) fail('Ventanas: no se detectó ninguna ventana.');

    windowsReport = {
      meshes: meshes.length,
      islands: islandCount,
      windows: windowCount,
      materials,
      seeds,
      islandsByMesh,
    };

    note(`Ventanas: ${meshes.length} objeto(s), ${windowCount} ventana(s).`);
    note(`Ventanas: materiales [${materials.join(', ')}].`);
    const seedPreview =
      seeds.length <= 24
        ? seeds.map((s) => s.toFixed(3)).join(', ')
        : `${seeds
            .slice(0, 8)
            .map((s) => s.toFixed(3))
            .join(', ')}, …, ${seeds
            .slice(-4)
            .map((s) => s.toFixed(3))
            .join(', ')} (${seeds.length} semillas)`;
    note(`Ventanas: semillas [${seedPreview}].`);
    // Curva acordada: 80 % al anochecer, se mantiene hasta las 22:00,
    // baja al 10 % a las 04:00 y desaparece con la luz del día.
    const dusk = 18.5;
    for (const [hour, night] of [
      [18.5, 1],
      [21, 1],
      [22, 1],
      [22.5, 1],
      [2, 1],
      [4, 1],
      [10.5, 0],
    ]) {
      const fraction = windowFraction(hour, dusk, night);
      const lit = seeds.filter((seed) => seed <= fraction).length;
      note(
        `  ${String(hour).padStart(4, ' ')} h -> ${lit}/${seeds.length} encendidas (${Math.round(fraction * 100)} %).`,
      );
    }
  }
}

let farolasDoc = null;
let farolasScene = null;
let farolasReport = null;

if (!existsSync(FAROLAS_FILE)) {
  note('farolas.glb todavía no existe; se omite su validación.');
} else {
  farolasDoc = await load(FAROLAS_FILE);
  farolasScene = farolasDoc?.getRoot().listScenes()[0] ?? null;
  if (farolasDoc) {
    const meshes = collectMeshes(farolasDoc);
    const materials = collectMaterials(meshes);
    validateMaterials('Farolas', materials, 'farolas');
    validateBounds('Farolas', farolasScene, terrainScene);
    if (meshes.length !== 1) {
      warn(`Farolas: el contrato pide una sola malla; hay ${meshes.length}.`);
    }
    const islands = meshes.reduce(
      (total, { primitives }) => total + findIslands(primitives).islands.length,
      0,
    );
    farolasReport = { meshes: meshes.length, islands, materials };
    note(
      `Farolas: ${meshes.length} malla(s), ${islands} grupo(s) desconectado(s), materiales [${materials.join(', ')}].`,
    );
  }
}

if (WRITE && windowsDoc && windowsReport) {
  let buffer = windowsDoc.getRoot().listBuffers()[0];
  if (!buffer) buffer = windowsDoc.createBuffer();

  for (const { primitives, vertexSeeds, primitiveOffsets } of windowsReport.islandsByMesh) {
    for (const { primitive, offset, count } of primitiveOffsets) {
      const data = vertexSeeds.slice(offset, offset + count);
      const accessor = windowsDoc
        .createAccessor(`${primitive.getMaterial()?.getName() ?? 'ventana'}_SEED`)
        .setType('SCALAR')
        .setArray(data)
        .setBuffer(buffer);
      primitive.setAttribute('_SEED', accessor);
    }
  }

  await io.write(OUTPUT_FILE, windowsDoc);
  note(`Escrito ${path.relative(ROOT, OUTPUT_FILE)} con el atributo _SEED.`);
}

for (const message of notes) console.log(`INFO  ${message}`);
for (const message of warnings) console.warn(`WARN  ${message}`);
for (const message of errors) console.error(`ERROR ${message}`);

if (errors.length > 0) {
  console.error(`\n${errors.length} error(es), ${warnings.length} aviso(s).`);
  process.exit(1);
}

console.log(`\nOK: ${warnings.length} aviso(s).`);
