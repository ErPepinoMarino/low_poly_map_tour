import * as THREE from 'three';

// Materiales procedurales específicos de los POIs. Los nombres vienen de
// Blender normalizados: muroCastillo -> murocastillo, cespedFubol -> cespedfubol.
// Los materiales compartidos con casas y calles (jardin, acera, tejados,
// panelSolar, pared_crema) se configuran antes en setupNamedMaterials; aquí no
// se vuelven a crear.
const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const HELPERS = `
float poiHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 poiHash2(vec2 p) {
  return vec2(
    fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453),
    fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453)
  );
}

float poiNoise(vec2 p) {
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  vec2 u = fp * fp * (3.0 - 2.0 * fp);
  return mix(
    mix(poiHash(ip), poiHash(ip + vec2(1.0, 0.0)), u.x),
    mix(poiHash(ip + vec2(0.0, 1.0)), poiHash(ip + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Voronoi con celdas anchas y bajas: piedras irregulares apiladas, no ladrillos.
vec3 poiStoneCells(vec2 p) {
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  vec2 nearest = ip;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = poiHash2(ip + g);
      vec2 d = g + o - fp;
      float dist = dot(d, d);
      if (dist < f1) {
        f2 = f1;
        f1 = dist;
        nearest = ip + g;
      } else if (dist < f2) {
        f2 = dist;
      }
    }
  }
  return vec3(sqrt(f1), sqrt(f2), poiHash(nearest));
}

vec2 poiTriplanar(vec3 p) {
  vec3 n = normalize(cross(dFdx(p), dFdy(p)));
  vec3 a = abs(n);
  if (a.x >= a.y && a.x >= a.z) return p.zy;
  if (a.y >= a.z) return p.xz;
  return p.xy;
}

// Coordenadas de pared: las hiladas siguen la horizontal real de cada cara,
// aunque la pared esté girada respecto a los ejes X/Z. Así la piedra no sale
// en diagonal en los muros del colegio, la iglesia o el castillo.
vec2 poiWallUV(vec3 p) {
  vec3 n = normalize(cross(dFdx(p), dFdy(p)));
  if (abs(n.y) > 0.72) return p.xz;

  vec3 tangent = normalize(vec3(n.z, 0.0, -n.x));
  return vec2(dot(p.xz, tangent.xz), p.y);
}
`;

// Muro de piedra del castillo y las torres. No usa UV: los bloques se
// proyectan en espacio de mundo para que no se estiren en las caras.
const CASTLE_PATTERN = `
      {
        vec2 uv = poiWallUV(vPoiWorldPos);
        // Celdas más anchas que altas. El warp rompe cualquier resto de rejilla.
        vec2 p = uv * vec2(0.5, 1);
        p += 0.08 * vec2(
          poiNoise(p * 0.48 + vec2(3.1, 7.7)),
          poiNoise(p * 0.48 + vec2(9.3, 1.8))
        );

        vec3 cells = poiStoneCells(p);
        float edge = cells.y - cells.x;
        float joint = 1.0 - smoothstep(0.01, 0.07, edge);
        float bevel = smoothstep(0.0, 0.16, edge);

        float tone = 0.94 + 0.10 * cells.z;
        float weather = poiNoise(uv * 0.28 + vec2(3.7, 1.2));
        float grain = poiNoise(uv * 7.0 + vec2(1.1, 4.4));
        vec3 base = diffuseColor.rgb;
        vec3 stone = base * tone * (0.97 + 0.06 * weather) * (0.985 + 0.03 * grain);
        stone *= 0.96 + 0.04 * bevel;
        vec3 mortarColor = base * 0.92;

        // Junta fina y casi del mismo color que la roca.
        diffuseColor.rgb = mix(stone, mortarColor, joint * 0.32);

        // Anti-moiré: a distancia queda una arenisca uniforme.
        float w = max(fwidth(uv.x), fwidth(uv.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, base, smoothstep(0.35, 1.1, w));
      }`;

// Campo de fútbol del colegio. Las franjas de siega y las líneas se calculan
// con los bounds reales de la malla, así no dependemos de sus UV (que vienen
// colapsadas desde Blender).
// Puerta/cancel metálico verde de la iglesia: bandas verticales suaves y
// desgaste, sin depender de UV.
const METAL_PATTERN = `
      {
        vec2 uv = poiTriplanar(vPoiWorldPos);
        float rib = 0.86 + 0.14 * smoothstep(0.42, 0.58, fract(uv.x * 6.0));
        float wear = poiNoise(uv * 1.7 + vec2(4.1, 8.3));
        diffuseColor.rgb *= rib * (0.90 + 0.16 * wear);
      }`;

// Masa vegetal oscura de la iglesia: variación orgánica sutil sin convertirla
// en un verde plano.
const DARK_GREEN_PATTERN = `
      {
        vec2 uv = poiTriplanar(vPoiWorldPos);
        float broad = poiNoise(uv * 2.4);
        float fine = poiNoise(uv * 9.0);
        diffuseColor.rgb *= 0.78 + 0.28 * broad + 0.08 * fine;
      }`;

// Puerta con cuadros de cristal: junta de carpintería oscura sobre el vidrio.
const GLASS_DOOR_PATTERN = `
      {
        vec2 uv = poiWallUV(vPoiWorldPos);
        vec2 grid = uv / vec2(0.82, 1.12);
        vec2 f = fract(grid);
        vec2 edge = min(f, 1.0 - f);
        float frame = 1.0 - smoothstep(0.018, 0.055, min(edge.x, edge.y));

        float w = max(fwidth(uv.x) / 0.82, fwidth(uv.y) / 1.12);
        frame *= 1.0 - smoothstep(0.35, 1.0, w);

        float glassNoise = poiNoise(uv * 3.2 + vec2(1.6, 4.8));
        vec3 glass = diffuseColor.rgb * (0.90 + 0.10 * glassNoise);
        diffuseColor.rgb = mix(glass, vec3(0.12, 0.10, 0.08), frame * 0.85);
      }`;

// Rejas metálicas (amarilla o negra): desgaste suave sobre la geometría de barras.
const METAL_BARS_PATTERN = `
      {
        vec2 uv = poiTriplanar(vPoiWorldPos);
        float wear = poiNoise(uv * 2.0 + vec2(4.2, 7.1));
        float fine = poiNoise(uv * 8.0 + vec2(1.3, 2.7));
        diffuseColor.rgb *= 0.90 + 0.10 * wear + 0.025 * fine;
      }`;

// Superficies pintadas del polideportivo: pintura deportiva, marcas y desgaste
// de uso. Un solo patrón para verde, marrón y rojo evita duplicar shaders.
const PAINTED_SURFACE_PATTERN = `
      {
        vec2 uv = poiTriplanar(vPoiWorldPos);
        float broad = poiNoise(uv * 0.62 + vec2(2.3, 5.1));
        float fine = poiNoise(uv * 4.2 + vec2(7.7, 1.4));
        float scuff = smoothstep(0.82, 0.97, poiNoise(uv * 1.7 + vec2(4.4, 9.2)));
        float detail = 1.0 - smoothstep(0.18, 0.8, max(fwidth(uv.x), fwidth(uv.y)));

        diffuseColor.rgb *= 0.95 + 0.07 * broad;
        diffuseColor.rgb *= 1.0 + (fine - 0.5) * 0.05 * detail;
        diffuseColor.rgb *= 1.0 - scuff * 0.04;
      }`;

// Fachada verde del mercado: chapa pintada con juntas verticales suaves.
// Las juntas se atenúan con la distancia para no formar moiré.
const MARKET_WALL_PATTERN = `
      {
        vec2 uv = poiWallUV(vPoiWorldPos);
        float panelWidth = 1.15;
        float panel = fract(uv.x / panelWidth);
        float seam = 1.0 - smoothstep(0.018, 0.06, min(panel, 1.0 - panel));
        seam *= 1.0 - smoothstep(0.22, 0.8, fwidth(uv.x) / panelWidth);

        float broad = poiNoise(uv * 0.55 + vec2(3.2, 6.1));
        float fine = poiNoise(uv * 3.0 + vec2(1.2, 8.4));

        diffuseColor.rgb *= 0.94 + 0.08 * broad;
        diffuseColor.rgb *= 1.0 - seam * 0.10;
        diffuseColor.rgb *= 0.985 + 0.03 * fine;
      }`;

// Tierra batida: grano fino sobre una base arcillosa, sin líneas de pista.
const CLAY_PATTERN = `
      {
        vec2 uv = poiTriplanar(vPoiWorldPos);
        float broad = poiNoise(uv * 0.48 + vec2(4.3, 1.8));
        float grain = poiNoise(uv * 9.0 + vec2(2.1, 6.7));
        float detail = 1.0 - smoothstep(0.25, 0.9, max(fwidth(uv.x), fwidth(uv.y)));

        diffuseColor.rgb *= 0.90 + 0.12 * broad;
        diffuseColor.rgb *= 1.0 + (grain - 0.5) * 0.10 * detail;
      }`;

// Gradas del teatro: peldaños horizontales de hormigón. Las bandas se calculan
// por altura de mundo, así siguen la pendiente real del graderío.
const THEATER_STEPS_PATTERN = `
      {
        float rowHeight = 0.52;
        float row = (vPoiWorldPos.y + 0.13) / rowHeight;
        float f = fract(row);
        float edge = min(f, 1.0 - f);
        float seam = 1.0 - smoothstep(0.012, 0.075, edge);
        float lip = smoothstep(0.0, 0.20, f) * (1.0 - smoothstep(0.80, 1.0, f));
        float grain = poiNoise(vPoiWorldPos.xz * 2.4 + vec2(vPoiWorldPos.y * 1.6));
        float detail = 1.0 - smoothstep(0.15, 0.6, fwidth(row));

        vec3 stone = diffuseColor.rgb * (0.86 + 0.13 * lip);
        stone *= 0.94 + 0.09 * grain;
        stone = mix(stone, diffuseColor.rgb * 0.58, seam * 0.45);
        diffuseColor.rgb = mix(diffuseColor.rgb * (0.94 + 0.08 * grain), stone, detail);
      }`;

// Lámina de agua de la piscina: ondulación suave y estática, sin transparencia.
const WATER_PATTERN = `
      {
        vec2 uv = poiTriplanar(vPoiWorldPos);
        float wave = sin(uv.x * 1.7 + uv.y * 1.1 + poiNoise(uv * 0.8) * 4.0);
        float ripple = poiNoise(uv * 3.2 + vec2(wave * 0.5));
        float light = 0.94 + 0.10 * (0.5 + 0.5 * wave) + 0.04 * ripple;
        diffuseColor.rgb *= light;
      }`;

// Material de estructura/plataforma que Blender exporta sin asignar.
const STRUCTURE_PATTERN = `
      {
        vec2 uv = poiTriplanar(vPoiWorldPos);
        float n = poiNoise(uv * 1.8 + vec2(2.5, 6.4));
        float fine = poiNoise(uv * 6.0 + vec2(7.7, 1.1));
        diffuseColor.rgb *= 0.88 + 0.10 * n + 0.02 * fine;
      }`;

const FOOTBALL_PATTERN = `
      {
        vec2 rel = vPoiWorldPos.xz - uFieldCenter;
        vec2 local = vec2(
          dot(rel, uFieldAxis),
          dot(rel, vec2(-uFieldAxis.y, uFieldAxis.x))
        );
        vec2 uv = local / max(uFieldSize, vec2(0.001)) + 0.5;
        float stripe = step(0.5, fract(uv.x * 8.0));
        float grain = poiNoise(vPoiWorldPos.xz * 2.6);

        vec3 grass = mix(diffuseColor.rgb * 0.82, diffuseColor.rgb * 1.12, stripe);
        grass *= 0.92 + 0.14 * grain;

        vec2 edge = min(uv, 1.0 - uv);
        float boundary = 1.0 - smoothstep(0.010, 0.019, min(edge.x, edge.y));
        float centerLine = 1.0 - smoothstep(0.0045, 0.0095, abs(uv.x - 0.5));
        vec2 circleCoord = (uv - 0.5) * vec2(uFieldSize.x / max(uFieldSize.y, 0.001), 1.0);
        float centerCircle = 1.0 - smoothstep(0.0045, 0.0095, abs(length(circleCoord) - 0.115));
        float mark = max(boundary, max(centerLine, centerCircle));

        // Las líneas finas se atenúan al alejarse para evitar aliasing.
        float detail = 1.0 - smoothstep(0.015, 0.07, max(fwidth(uv.x), fwidth(uv.y)));
        mark *= detail;
        grass = mix(grass, vec3(0.86, 0.90, 0.82), mark * 0.88);

        diffuseColor.rgb = grass;
      }`;

function injectWorldPosition(shader: { vertexShader: string; fragmentShader: string }) {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    '#include <common>\nvarying vec3 vPoiWorldPos;',
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    '#include <common>\nvarying vec3 vPoiWorldPos;',
  );
  shader.vertexShader = shader.vertexShader.replace(
    '#include <worldpos_vertex>',
    '#include <worldpos_vertex>\nvPoiWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
  );
}

function applyPattern(material: THREE.MeshStandardMaterial, pattern: string, key: string) {
  material.onBeforeCompile = (shader) => {
    injectWorldPosition(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `${HELPERS}void main() {`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `vec4 diffuseColor = vec4( diffuse, opacity );${pattern}`,
    );
  };
  material.customProgramCacheKey = () => key;
  material.needsUpdate = true;
}

interface FieldFrame {
  center: THREE.Vector2;
  axis: THREE.Vector2;
  size: THREE.Vector2;
}

// El colegio está girado respecto a los ejes del mundo. Calculamos el
// rectángulo orientado del campo desde sus vértices para que las franjas y
// líneas sigan la orientación real de la malla.
function getFieldFrame(mesh: THREE.Mesh): FieldFrame | null {
  const position = mesh.geometry.getAttribute('position');
  if (!position || position.count < 3) return null;

  mesh.updateWorldMatrix(true, false);
  const point = new THREE.Vector3();
  const points: Array<[number, number]> = [];
  let cx = 0;
  let cz = 0;

  for (let i = 0; i < position.count; i += 1) {
    point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    points.push([point.x, point.z]);
    cx += point.x;
    cz += point.z;
  }
  cx /= points.length;
  cz /= points.length;

  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  for (const [x, z] of points) {
    const dx = x - cx;
    const dz = z - cz;
    sxx += dx * dx;
    szz += dz * dz;
    sxz += dx * dz;
  }

  const theta = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  let axis = new THREE.Vector2(Math.cos(theta), Math.sin(theta));
  let perp = new THREE.Vector2(-axis.y, axis.x);

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const [x, z] of points) {
    const dx = x - cx;
    const dz = z - cz;
    const u = dx * axis.x + dz * axis.y;
    const v = dx * perp.x + dz * perp.y;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }

  let size = new THREE.Vector2(maxU - minU, maxV - minV);
  let centerU = (minU + maxU) * 0.5;
  let centerV = (minV + maxV) * 0.5;
  if (size.x < size.y) {
    axis = perp;
    perp = new THREE.Vector2(-axis.y, axis.x);
    size = new THREE.Vector2(size.y, size.x);
    [centerU, centerV] = [centerV, centerU];
  }

  return {
    center: new THREE.Vector2(
      cx + centerU * axis.x + centerV * perp.x,
      cz + centerU * axis.y + centerV * perp.y,
    ),
    axis,
    size,
  };
}

function applyFootballPattern(material: THREE.MeshStandardMaterial, field: FieldFrame) {
  material.onBeforeCompile = (shader) => {
    injectWorldPosition(shader);
    shader.uniforms.uFieldCenter = { value: field.center };
    shader.uniforms.uFieldAxis = { value: field.axis };
    shader.uniforms.uFieldSize = { value: field.size };
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\nuniform vec2 uFieldCenter;\nuniform vec2 uFieldAxis;\nuniform vec2 uFieldSize;',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `${HELPERS}void main() {`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `vec4 diffuseColor = vec4( diffuse, opacity );${FOOTBALL_PATTERN}`,
    );
  };
  material.customProgramCacheKey = () => 'poi-football';
  material.needsUpdate = true;
}

export function setupPoiMaterials(scene: THREE.Object3D) {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const key = normalizeName(material.name);
      if (key === 'murocastillo') {
        // Arenisca cálida y poco rojiza, más coherente con el castillo real.
        (material as THREE.MeshStandardMaterial).color.set('#c9ae9e');
        if (material.userData.poiPattern === 'castle') continue;
        material.userData.poiPattern = 'castle';
        applyPattern(material as THREE.MeshStandardMaterial, CASTLE_PATTERN, 'poi-castle');
      } else if (key === 'cespedfubol') {
        if (material.userData.poiPattern === 'football') continue;
        const field = getFieldFrame(mesh);
        if (!field) continue;
        material.userData.poiPattern = 'football';
        applyFootballPattern(material as THREE.MeshStandardMaterial, field);
      } else if (key === 'puertametalverde') {
        if (material.userData.poiPattern === 'metal') continue;
        material.userData.poiPattern = 'metal';
        applyPattern(material as THREE.MeshStandardMaterial, METAL_PATTERN, 'poi-metal');
      } else if (key === 'verdeoscuro') {
        if (material.userData.poiPattern === 'dark-green') continue;
        material.userData.poiPattern = 'dark-green';
        applyPattern(material as THREE.MeshStandardMaterial, DARK_GREEN_PATTERN, 'poi-dark-green');
      } else if (key === 'puertacuadroscristal') {
        if (material.userData.poiPattern === 'glass-door') continue;
        material.userData.poiPattern = 'glass-door';
        const std = material as THREE.MeshStandardMaterial;
        std.roughness = 0.28;
        std.metalness = 0.04;
        applyPattern(std, GLASS_DOOR_PATTERN, 'poi-glass-door');
      } else if (key === 'puertarejaamarilla' || key === 'puertarejamercado') {
        if (material.userData.poiPattern === 'metal-bars') continue;
        material.userData.poiPattern = 'metal-bars';
        const std = material as THREE.MeshStandardMaterial;
        if (key === 'puertarejamercado') {
          // Puerta negra del mercado.
          std.color.set('#252a2c');
          std.metalness = 0.45;
          std.roughness = 0.6;
        }
        applyPattern(std, METAL_BARS_PATTERN, 'poi-metal-bars');
      } else if (key === 'paredmercado') {
        if (material.userData.poiPattern === 'market-wall') continue;
        material.userData.poiPattern = 'market-wall';
        const std = material as THREE.MeshStandardMaterial;
        // Verde de la fachada del mercado, menos saturado que el color base.
        std.color.set('#9fbe32');
        std.roughness = 0.88;
        applyPattern(std, MARKET_WALL_PATTERN, 'poi-market-wall');
      } else if (key === 'gradasteatro') {
        if (material.userData.poiPattern === 'theater-steps') continue;
        material.userData.poiPattern = 'theater-steps';
        const std = material as THREE.MeshStandardMaterial;
        std.color.set('#b7a58a');
        std.roughness = 0.92;
        applyPattern(std, THEATER_STEPS_PATTERN, 'poi-theater-steps');
      } else if (key === 'piscina') {
        if (material.userData.poiPattern === 'water') continue;
        material.userData.poiPattern = 'water';
        const std = material as THREE.MeshStandardMaterial;
        std.color.set('#2f8fae');
        std.roughness = 0.22;
        std.metalness = 0.05;
        applyPattern(std, WATER_PATTERN, 'poi-water');
      } else if (key === 'pistatenistierra') {
        if (material.userData.poiPattern === 'clay') continue;
        material.userData.poiPattern = 'clay';
        const std = material as THREE.MeshStandardMaterial;
        std.color.set('#b65a42');
        std.roughness = 0.88;
        applyPattern(std, CLAY_PATTERN, 'poi-clay');
      } else if (
        key === 'pinturaverdesuelo' ||
        key === 'pinturamarron' ||
        key === 'pinturaroja' ||
        key === 'pinturarojainstituto'
      ) {
        if (material.userData.poiPattern === 'painted-surface') continue;
        material.userData.poiPattern = 'painted-surface';
        const std = material as THREE.MeshStandardMaterial;
        if (key === 'pinturaverdesuelo') std.color.set('#3a8a4b');
        if (key === 'pinturamarron') std.color.set('#6b4a31');
        // Pista roja del instituto: terracota desaturada, no rojo de señal.
        if (key === 'pinturarojainstituto') std.color.set('#b24d3f');
        std.roughness = key === 'pinturaroja' ? std.roughness : 0.84;
        applyPattern(std, PAINTED_SURFACE_PATTERN, 'poi-painted-surface');
      } else if (key === 'materialpordefecto') {
        if (material.userData.poiPattern === 'structure') continue;
        material.userData.poiPattern = 'structure';
        const std = material as THREE.MeshStandardMaterial;
        std.color.set('#756E62');
        std.roughness = 0.86;
        applyPattern(std, STRUCTURE_PATTERN, 'poi-structure');
      }
    }
  });
}
