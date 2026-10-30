import * as THREE from 'three';

// Color base (paleta cozy) + patrón procedural por tipo de vía (nombre del material en Blender).
const ROAD_TYPES: Record<string, { color: string; pattern: string }> = {
  Carretera: { color: '#5B6066', pattern: 'asphalt' },
  Calle: { color: '#7A7468', pattern: 'cobble' },
  Via: { color: '#6B625A', pattern: 'ballast' },
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
`;

// Patrones en espacio de MUNDO (sin UVs), con varying propio vRoadWorldPos.
// Escala en metros: multiplica la frecuencia para afinar el tamaño.
const PATTERNS: Record<string, string> = {
  // Asfalto: ruido suave fino.
  asphalt: `
      {
        float n = roadNoise(vRoadWorldPos.xz * 1.0);
        diffuseColor.rgb *= 0.92 + 0.08 * n;
      }`,
  // Adoquines: Voronoi isotrópico (indiferente a la dirección) con juntas.
  cobble: `
      {
        vec2 v = roadVoronoi(vRoadWorldPos.xz * 0.25);
        float edge = v.y - v.x; // 0 en la junta, mayor en el centro de la celda
        float joint = 1.0 - smoothstep(0.0, 0.05, edge);
        diffuseColor.rgb *= mix(1.0, 0.5, joint);
      }`,
  // Balasto (vía): ruido fino de grava.
  ballast: `
      {
        float n = roadNoise(vRoadWorldPos.xz * 2.0);
        diffuseColor.rgb *= 0.85 + 0.15 * n;
      }`,
};

function applyPattern(material: THREE.MeshStandardMaterial, name: string) {
  const code = PATTERNS[name];
  if (!code) return;

  material.onBeforeCompile = (shader) => {
    // Varying propio (vWorldPosition no existe sin envmap/shadowmap).
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
    // Funciones auxiliares antes de main.
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `${HELPERS}void main() {`,
    );
    // Patrón.
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `vec4 diffuseColor = vec4( diffuse, opacity );${code}`,
    );
  };
  material.customProgramCacheKey = () => `road-${name}`;
  material.needsUpdate = true;
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
      applyPattern(std, ROAD_TYPES[name].pattern);
    }
  });
}
