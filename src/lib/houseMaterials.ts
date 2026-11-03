import * as THREE from 'three';

// Materiales de las casas, identificados por el nombre definido en Blender.
// Se normalizan a minúsculas y sin separadores: "tejado_teja", "TejadoTeja" o
// "tejado-teja" acaban en el mismo patrón.
const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

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

// Placa solar: rejilla limpia sobre el plano real del faldón (sin deformar).
// Celda de 0,50 m (misma escala que la teja): a distancia de diorama se lee como
// panel, no como ruido. Sin variación aleatoria por celda, que era el grano.
const SOLAR_PATTERN = `
      {
        float u, v;
        roofFrame(vHouseWorldPos, u, v);

        float cell = 0.50;
        vec2 g = vec2(u, v) / cell;
        vec2 f = fract(g);
        vec2 edge = min(f, 1.0 - f);
        float line = 1.0 - smoothstep(0.0, 0.08, min(edge.x, edge.y));

        // Azul profundo con una variación muy suave y de baja frecuencia.
        float tone = houseNoise(vec2(u, v) * 0.12);
        vec3 panel = mix(vec3(0.06, 0.11, 0.21), vec3(0.09, 0.15, 0.27), tone);
        vec3 color = mix(panel, vec3(0.58, 0.63, 0.70), line * 0.9);

        // Anti-moiré: de lejos queda un azul plano, sin rejilla parpadeante.
        float w = max(fwidth(u), fwidth(v)) / cell;
        color = mix(vec3(0.08, 0.13, 0.24), color, 1.0 - smoothstep(0.35, 1.0, w));

        diffuseColor.rgb = color;
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
      const key = normalizeName(mat.name);
      // Cualquier tejado (tejado_teja, tejado_teja_oscura, tejaAzul…) comparte
      // patrón; el color base de cada material se respeta.
      if (key.startsWith('teja')) {
        applyPattern(mat as THREE.MeshStandardMaterial, ROOF_PATTERN, 'house-roof');
      } else if (key === 'jardin') {
        applyPattern(mat as THREE.MeshStandardMaterial, GARDEN_PATTERN, 'house-garden');
      } else if (key === 'panelsolar') {
        applyPattern(mat as THREE.MeshStandardMaterial, SOLAR_PATTERN, 'house-solar');
      }
    }
  });
}
