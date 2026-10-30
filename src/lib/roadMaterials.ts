import * as THREE from 'three';

// Color base (paleta cozy) + patrón procedural por tipo de vía, identificado por
// el nombre del material que asignaste en Blender.
const ROAD_TYPES: Record<string, { color: string; pattern: string }> = {
  Carretera: { color: '#5B6066', pattern: 'asphalt' },
  Calle: { color: '#7A7468', pattern: 'cobble' },
  Via: { color: '#6B625A', pattern: 'ballast' },
};

// Patrones en espacio de MUNDO (las vías no tienen UVs), con un varying propio.
// Escala exagerada a propósito (efecto maqueta): baldosas/grava más grandes de lo
// real para que se lean a la distancia del diorama. Ajusta los multiplicadores.
const PATTERNS: Record<string, string> = {
  // Asfalto: grano visible.
  asphalt: `
      {
        vec2 p = vRoadWorldPos.xz * 0.125;
        float n = fract(sin(dot(floor(p), vec2(127.1, 311.7))) * 43758.5453);
        diffuseColor.rgb *= 0.82 + 0.18 * n;
      }`,
  // Adoquines: baldosas de 6 m con juntas oscuras y variación por piedra.
  cobble: `
      {
        vec2 p = vRoadWorldPos.xz * 0.1667;
        vec2 id = floor(p);
        vec2 f = fract(p);
        vec2 g = min(f, 1.0 - f);
        float d = min(g.x, g.y);
        float joint = 1.0 - smoothstep(0.0, 0.06, d);
        float h = fract(sin(dot(id, vec2(127.1, 311.7))) * 43758.5453);
        float shade = 0.78 + 0.22 * h;
        diffuseColor.rgb *= mix(1.0, 0.4, joint) * shade;
      }`,
  // Balasto (vía): grava visible. (Los raíles/traviesas necesitarán UVs a lo largo de la vía.)
  ballast: `
      {
        vec2 p = vRoadWorldPos.xz * 0.33;
        float n = fract(sin(dot(floor(p), vec2(127.1, 311.7))) * 43758.5453);
        diffuseColor.rgb *= 0.75 + 0.25 * n;
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
    // Patrón.
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `vec4 diffuseColor = vec4( diffuse, opacity );${code}`,
    );
  };
  // Fuerza un programa único y su recompilación con el patrón.
  material.customProgramCacheKey = () => `road-${name}`;
  material.needsUpdate = true;
}

// Recorre la escena cargada y aplica color + patrón a los materiales de vía.
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
