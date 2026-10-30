import * as THREE from 'three';

// Color base (paleta cozy) + patrón procedural por tipo de vía, identificado por
// el nombre del material que asignaste en Blender.
const ROAD_TYPES: Record<string, { color: string; pattern: string }> = {
  Carretera: { color: '#5B6066', pattern: 'asphalt' },
  Calle: { color: '#7A7468', pattern: 'cobble' },
  Via: { color: '#6B625A', pattern: 'ballast' },
};

// Patrones en espacio de MUNDO (las vías no tienen UVs).
// Son multiplicadores de diffuseColor: sutiles, "cozy".
const PATTERNS: Record<string, string> = {
  // Asfalto: ruido sutil.
  asphalt: `
      {
        vec2 p = vWorldPosition.xz * 0.25;
        float n = fract(sin(dot(floor(p), vec2(127.1, 311.7))) * 43758.5453);
        diffuseColor.rgb *= 0.95 + 0.05 * n;
      }`,
  // Adoquines: rejilla con juntas y variación por piedra.
  cobble: `
      {
        vec2 p = vWorldPosition.xz * 0.4;
        vec2 id = floor(p);
        vec2 f = fract(p) - 0.5;
        float h = fract(sin(dot(id, vec2(127.1, 311.7))) * 43758.5453);
        float d = length(f);
        float stone = smoothstep(0.42, 0.5, d);
        float shade = 0.9 + 0.1 * h;
        diffuseColor.rgb *= mix(0.75, 1.0, stone) * shade;
      }`,
  // Balasto (vía): grava con ruido. (Los raíles/traviesas necesitarán UVs a lo largo de la vía.)
  ballast: `
      {
        vec2 p = vWorldPosition.xz * 0.5;
        float n = fract(sin(dot(floor(p), vec2(127.1, 311.7))) * 43758.5453);
        diffuseColor.rgb *= 0.88 + 0.12 * n;
      }`,
};

function applyPattern(material: THREE.MeshStandardMaterial, pattern: string) {
  const code = PATTERNS[pattern];
  if (!code) return;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `vec4 diffuseColor = vec4( diffuse, opacity );${code}`,
    );
  };
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
