import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useTimeOfDay } from '../lighting/useTimeOfDay';

const SKY_RADIUS = 9000;

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vDir;

  void main() {
    // La esfera sigue a la cámara: la dirección local equivale a la dirección
    // de vista, sin paralaje al orbitar.
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uNight;
  varying vec3 vDir;

  const vec3 GALACTIC_NORMAL = normalize(vec3(0.55, 0.75, 0.30));

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(
        mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x),
        f.y
      ),
      mix(
        mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x),
        f.y
      ),
      f.z
    );
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.55;
    for (int i = 0; i < 3; i++) {
      value += amplitude * noise3(p);
      p = p * 2.03 + vec3(13.7, 7.3, 11.1);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 dir = normalize(vDir);

    // No recortamos por dir.y: con la cámara mirando hacia abajo, el cielo
    // visible del diorama queda por debajo del horizonte geométrico. El
    // terreno ya define el borde visual mediante depth test.
    float bandCoord = dot(dir, GALACTIC_NORMAL);
    float band = exp(-pow(bandCoord * 9.0, 2.0)) +
      0.22 * exp(-pow(bandCoord * 4.0, 2.0));

    vec3 milky = vec3(0.0);
    if (band > 0.004) {
      float clouds = fbm(dir * 16.0 + vec3(2.3, 1.7, 4.1));
      float fine = fbm(dir * 42.0 + vec3(7.1, 3.2, 1.9));
      float dust = fbm(dir * 24.0 + vec3(1.2, 8.4, 3.7));

      float structure = (0.04 + 0.55 * clouds + 0.22 * fine);
      structure *= 1.0 - 0.85 * smoothstep(0.30, 0.66, dust);

      vec3 cloudColor = mix(
        vec3(0.05, 0.09, 0.26),
        vec3(0.40, 0.44, 0.56),
        smoothstep(0.32, 0.90, clouds)
      );
      milky = cloudColor * band * structure * 0.13;
    }

    // Estrellas en celdas 3D: una draw call, sin buffers por estrella.
    vec3 cellCoord = dir * 180.0;
    vec3 cell = floor(cellCoord);
    vec3 local = fract(cellCoord) - 0.5;
    float hash = hash31(cell);
    float star = 0.0;
    vec3 starColor = vec3(0.0);

    if (hash > 0.94) {
      vec3 jitter = vec3(
        hash31(cell + 1.3),
        hash31(cell + 4.7),
        hash31(cell + 8.1)
      ) - 0.5;
      float distanceToStar = length(local - jitter * 0.8);
      float twinkle = 0.82 + 0.18 * sin(uTime * (0.7 + hash * 2.0) + hash * 37.0);
      star = (1.0 - smoothstep(0.015, 0.22, distanceToStar)) * twinkle;
      star *= 0.8 + 1.6 * hash31(cell + 5.9);
      starColor = mix(
        vec3(0.66, 0.78, 1.0),
        vec3(1.0, 0.82, 0.62),
        hash31(cell + 2.1)
      );
    }

    vec3 color = milky + starColor * star;
    gl_FragColor = vec4(color * uNight, 1.0);
    #include <colorspace_fragment>
  }
`;

// Cielo nocturno procedural: Vía Láctea + estrellas, una sola draw call.
// Se oculta de día para no gastar nada y sigue a la cámara para que las
// estrellas no tengan paralaje al orbitar.
export default function NightSky() {
  const skyRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const camera = useThree((state) => state.camera);
  const time = useTimeOfDay();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uNight: { value: 0 },
    }),
    [],
  );

  useFrame(({ clock }) => {
    const group = skyRef.current;
    const material = materialRef.current;
    if (!group || !material) return;

    // Las estrellas aparecen cuando el sol ya está bien por debajo del horizonte.
    const night = 1 - THREE.MathUtils.smoothstep(time.sunAltitude, -0.26, -0.12);
    group.position.copy(camera.position);
    group.visible = night > 0.01;
    material.uniforms.uNight.value = night;
    material.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <group ref={skyRef}>
      <mesh renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[SKY_RADIUS, 64, 32]} />
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={VERTEX_SHADER}
          fragmentShader={FRAGMENT_SHADER}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
          fog={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
