import * as THREE from 'three';

// Materiales de las casas, identificados por el nombre definido en Blender.
const ROOF_MATERIALS = ['tejado_teja', 'tejado_teja_oscura', 'tejado_teja_clara'];
const GARDEN_MATERIAL = 'Jardin';

// Helpers GLSL (se inyectan antes de main).
const HELPERS = `
float houseHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float houseNoise(vec2 p) {
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  vec2 u = fp * fp * (3.0 - 2.0 * fp);
  return mix(
    mix(houseHash(ip), houseHash(ip + vec2(1.0, 0.0)), u.x),
    mix(houseHash(ip + vec2(0.0, 1.0)), houseHash(ip + vec2(1.0, 1.0)), u.x),
    u.y
  );
}
// Marco tangente a la cara: u corre paralelo al alero, v baja por el faldón.
// Al proyectar sobre el plano real del tejado, la teja no se deforma aunque el
// faldón esté inclinado o girado.
void roofFrame(vec3 pos, out float u, out float v) {
  vec3 n = normalize(cross(dFdx(pos), dFdy(pos)));
  if (n.y < 0.0) n = -n;
  vec3 t = cross(n, vec3(0.0, 1.0, 0.0));
  if (dot(t, t) < 0.01) t = vec3(1.0, 0.0, 0.0);
  t = normalize(t);
  vec3 b = normalize(cross(n, t));
  u = dot(pos, t);
  v = dot(pos, b);
}
`;

// Teja árabe: filas paralelas al alero, tejas convexas y juntas sombreadas.
// Tamaño en metros reales (la malla de casas viene escalada, pero usamos mundo).
const ROOF_PATTERN = `
      {
        float u, v;
        roofFrame(vHouseWorldPos, u, v);
        float tileW = 0.50;
        float rowH = 0.55;
        float row = v / rowH;
        float rowId = floor(row);
        float uu = u / tileW + rowId * 0.5;
        float colId = floor(uu);
        float fu = fract(uu);
        float fv = fract(row);

        // Canal convexo de cada teja + sombra en la junta de filas.
        float barrel = sin(fu * 3.14159265);
        float shade = mix(0.70, 1.07, barrel);
        float seam = smoothstep(0.0, 0.16, fv) * smoothstep(1.0, 0.84, fv);
        shade *= mix(0.74, 1.0, seam);
        // Variación de tono por teja (evita el aspecto de color plano).
        shade *= 0.90 + 0.18 * houseHash(vec2(colId, rowId));

        // Anti-moiré: al alejarse, la teja se funde con el color base.
        float w = max(fwidth(u) / tileW, fwidth(v) / rowH);
        shade = mix(1.0, shade, 1.0 - smoothstep(0.45, 1.4, w));

        diffuseColor.rgb *= shade;
      }`;

// Jardín: dos verdes con ruido + flores esporádicas (amarillas y rosas).
const GARDEN_PATTERN = `
      {
        vec2 p = vHouseWorldPos.xz;
        float n1 = houseNoise(p * 1.7);
        float n2 = houseNoise(p * 6.0);
        vec3 grass = mix(vec3(0.28, 0.40, 0.16), vec3(0.47, 0.56, 0.24), n1);
        grass = mix(grass, vec3(0.55, 0.62, 0.27), n2 * 0.40);

        // Flores: una posible por celda de ~0.36 m, con baja probabilidad.
        vec2 cell = floor(p * 2.8);
        float h = houseHash(cell);
        if (h > 0.94) {
          vec2 f = fract(p * 2.8) - 0.5;
          float flower = smoothstep(0.22, 0.05, length(f));
          vec3 fc = mix(vec3(0.96, 0.93, 0.58), vec3(0.93, 0.46, 0.58), step(0.968, h));
          grass = mix(grass, fc, flower * 0.9);
        }

        // Anti-moiré: al alejarse, se queda el verde de baja frecuencia.
        float w = max(fwidth(p.x), fwidth(p.y)) * 6.0;
        vec3 base = mix(vec3(0.28, 0.40, 0.16), vec3(0.47, 0.56, 0.24), n1);
        grass = mix(grass, base, smoothstep(0.6, 1.6, w));

        diffuseColor.rgb = grass;
      }`;

function injectWorldPosition(shader: { vertexShader: string; fragmentShader: string }) {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    '#include <common>\nvarying vec3 vHouseWorldPos;',
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    '#include <common>\nvarying vec3 vHouseWorldPos;',
  );
  shader.vertexShader = shader.vertexShader.replace(
    '#include <worldpos_vertex>',
    '#include <worldpos_vertex>\nvHouseWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
  );
}

function applyPattern(material: THREE.MeshStandardMaterial, pattern: string, key: string) {
  material.onBeforeCompile = (shader) => {
    injectWorldPosition(shader);
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', `${HELPERS}void main() {`);
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `vec4 diffuseColor = vec4( diffuse, opacity );${pattern}`,
    );
  };
  material.customProgramCacheKey = () => key;
  material.needsUpdate = true;
}

export function setupHouseMaterials(scene: THREE.Object3D) {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const name = mat.name;
      if (ROOF_MATERIALS.includes(name)) {
        applyPattern(mat as THREE.MeshStandardMaterial, ROOF_PATTERN, 'house-roof');
      } else if (name === GARDEN_MATERIAL) {
        applyPattern(mat as THREE.MeshStandardMaterial, GARDEN_PATTERN, 'house-garden');
      }
    }
  });
}
