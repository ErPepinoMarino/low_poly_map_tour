import * as THREE from 'three';

// Color base (paleta cozy) + patrón procedural por tipo de vía (nombre del material en Blender).
const ROAD_TYPES: Record<string, { color: string; pattern: string }> = {
  Carretera: { color: '#5B6066', pattern: 'asphalt' },
  Calle: { color: '#7A7468', pattern: 'cobble' },
  Via: { color: '#6B625A', pattern: 'rail' },
};

// Funciones auxiliares GLSL (se inyectan antes de main).
const HELPERS = `
float roadHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
vec2 roadHash2(vec2 p) {
  return vec2(
    fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453),
    fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453)
  );
}
float roadNoise(vec2 p) {
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  vec2 u = fp * fp * (3.0 - 2.0 * fp);
  return mix(
    mix(roadHash(ip), roadHash(ip + vec2(1.0, 0.0)), u.x),
    mix(roadHash(ip + vec2(0.0, 1.0)), roadHash(ip + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
vec2 roadVoronoi(vec2 p) {
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = roadHash2(ip + g);
      vec2 d = g + o - fp;
      float dist = dot(d, d);
      if (dist < f1) { f2 = f1; f1 = dist; }
      else if (dist < f2) { f2 = dist; }
    }
  }
  return vec2(sqrt(f1), sqrt(f2));
}
// Proyección triplanar (evita estiramiento en caras verticales).
vec2 roadTriplanar(vec3 p) {
  vec3 n = normalize(cross(dFdx(p), dFdy(p)));
  vec3 a = abs(n);
  if (a.x >= a.y && a.x >= a.z) return p.zy;
  if (a.y >= a.z) return p.xz;
  return p.xy;
}
`;

// Patrones isotrópicos (usados en asfalto y adoquín).
const PATTERNS: Record<string, string> = {
  asphalt: `
      {
        float n = roadNoise(roadTriplanar(vRoadWorldPos) * 4.0);
        diffuseColor.rgb *= 0.92 + 0.08 * n;
      }`,
  cobble: `
      {
        vec2 v = roadVoronoi(roadTriplanar(vRoadWorldPos) * 1.0);
        float edge = v.y - v.x;
        float joint = 1.0 - smoothstep(0.0, 0.05, edge);
        diffuseColor.rgb *= mix(1.0, 0.5, joint);
      }`,
};

// Patrón de la vía (raíles + traviesas), direccional: usa uRailDir/uRailPerp/uRailCenter.
const RAIL_PATTERN = `
      {
        vec2 rel = vRoadWorldPos.xz - uRailCenter;
        float along = dot(rel, uRailDir);
        float across = dot(rel, uRailPerp);
        // Traviesas: barras perpendiculares, cada 0.7 m, grosor 0.25 m.
        float sleeper = step(0.25, fract(along / 0.7));
        // Raíles: dos líneas a ±0.7 m del centro (ancho de vía estándar).
        float rail = 1.0 - smoothstep(0.05, 0.18, abs(abs(across) - 0.7));
        // Balasto (grava) de fondo.
        float g = roadNoise(vRoadWorldPos.xz * 2.0);
        float factor = 0.85 + 0.15 * g;
        factor *= mix(1.0, 0.5, 1.0 - sleeper); // traviesas oscuras
        factor *= mix(1.0, 1.7, rail);          // raíles claros
        diffuseColor.rgb *= factor;
      }`;

function injectBase(shader: { vertexShader: string; fragmentShader: string }) {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    '#include <common>\nvarying vec3 vRoadWorldPos;',
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    '#include <common>\nvarying vec3 vRoadWorldPos;',
  );
  shader.vertexShader = shader.vertexShader.replace(
    '#include <worldpos_vertex>',
    '#include <worldpos_vertex>\nvRoadWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
  );
  shader.fragmentShader = shader.fragmentShader.replace('void main() {', `${HELPERS}void main() {`);
}

function applyPattern(material: THREE.MeshStandardMaterial, name: string) {
  const code = PATTERNS[name];
  if (!code) return;
  material.onBeforeCompile = (shader) => {
    injectBase(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `vec4 diffuseColor = vec4( diffuse, opacity );${code}`,
    );
  };
  material.customProgramCacheKey = () => `road-${name}`;
  material.needsUpdate = true;
}

function applyRailPattern(material: THREE.MeshStandardMaterial, dir: { x: number; y: number }, center: { x: number; y: number }) {
  material.onBeforeCompile = (shader) => {
    injectBase(shader);
    // Uniforms del trazado de la vía.
    shader.uniforms.uRailDir = { value: new THREE.Vector2(dir.x, dir.y) };
    shader.uniforms.uRailPerp = { value: new THREE.Vector2(-dir.y, dir.x) };
    shader.uniforms.uRailCenter = { value: new THREE.Vector2(center.x, center.y) };
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\nuniform vec2 uRailDir;\nuniform vec2 uRailPerp;\nuniform vec2 uRailCenter;',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `vec4 diffuseColor = vec4( diffuse, opacity );${RAIL_PATTERN}`,
    );
  };
  material.customProgramCacheKey = () => 'road-rail';
  material.needsUpdate = true;
}

// Dirección dominante (a lo largo) de una malla en el plano XZ, vía PCA 2D.
function dominantDirection(positions: Float32Array): { dir: { x: number; y: number }; center: { x: number; y: number } } {
  let cx = 0;
  let cz = 0;
  let n = 0;
  for (let i = 0; i < positions.length; i += 3) {
    cx += positions[i];
    cz += positions[i + 2];
    n++;
  }
  cx /= n;
  cz /= n;
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const dx = positions[i] - cx;
    const dz = positions[i + 2] - cz;
    sxx += dx * dx;
    szz += dz * dz;
    sxz += dx * dz;
  }
  const theta = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  return {
    dir: { x: Math.cos(theta), y: Math.sin(theta) },
    center: { x: cx, y: cz },
  };
}

export function setupRoadMaterials(scene: THREE.Object3D) {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const name = mat.name;
      if (!(name in ROAD_TYPES)) continue;
      const std = mat as THREE.MeshStandardMaterial;
      std.color.set(ROAD_TYPES[name].color);
      if (name === 'Via') {
        const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
        const { dir, center } = pos ? dominantDirection(pos.array as Float32Array) : { dir: { x: 1, y: 0 }, center: { x: 0, y: 0 } };
        applyRailPattern(std, dir, center);
      } else {
        applyPattern(std, ROAD_TYPES[name].pattern);
      }
    }
  });
}
