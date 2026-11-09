import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getPoi } from '../data/pois';
import { useStore } from '../store/useStore';

const HIGHLIGHT_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const HOVER_PULSE_SECONDS = 1.25;

const HIGHLIGHT_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    float facing = max(dot(normalize(vNormal), normalize(vView)), 0.0);
    float rim = pow(1.0 - facing, 2.0);
    vec3 color = mix(vec3(1.0, 0.48, 0.08), vec3(1.0, 0.82, 0.38), rim);
    // Cobertura uniforme en toda la superficie + borde algo más marcado.
    float alpha = 0.62 + 0.20 * rim;
    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`;

function createHighlightMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: HIGHLIGHT_VERTEX,
    fragmentShader: HIGHLIGHT_FRAGMENT,
    transparent: true,
    depthWrite: false,
    // X-ray deliberado: el resalte se dibuja siempre por delante. Es la
    // solución robusta frente al z-fighting de una copia coplanar.
    depthTest: false,
    blending: THREE.NormalBlending,
    // Los materiales del GLB son DoubleSide; el resalte debe coincidir para
    // no descartar caras invertidas de la malla original.
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

function setHighlightOpacity(material: THREE.ShaderMaterial, opacity: number) {
  material.uniforms.uOpacity.value = opacity;
}

function buildClone(
  scene: THREE.Object3D,
  poiId: string,
  material: THREE.ShaderMaterial,
): THREE.Object3D | null {
  const poi = getPoi(poiId);
  if (!poi) return null;
  const node = scene.getObjectByName(poi.node);
  if (!node) return null;

  node.updateWorldMatrix(true, false);
  const clone = node.clone(true);
  clone.matrixAutoUpdate = false;
  clone.matrix.copy(node.matrixWorld);
  clone.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = material;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 999;
    mesh.userData.poiHighlight = true;
  });
  return clone;
}

// Dos capas independientes:
// - hover: resalta el POI bajo el ratón.
// - selected: acompaña al clic y se desvanece durante el vuelo.
export default function PoiHighlight({ scene }: { scene: THREE.Object3D }) {
  const hoveredPoiId = useStore((state) => state.hoveredPoiId);
  const flightId = useStore((state) => state.cameraFlightRequest?.id);
  const flightPoiId = useStore((state) => state.cameraFlightRequest?.poiId ?? null);
  const flightDuration = useStore((state) => state.cameraFlightRequest?.duration ?? 3);
  const hoverRoot = useRef<THREE.Group>(null);
  const selectedRoot = useRef<THREE.Group>(null);
  const hoverStartedAt = useRef(0);
  const selectedStartedAt = useRef(0);
  const selectedDuration = useRef(3);
  const latestFlightDuration = useRef(flightDuration);

  useEffect(() => {
    latestFlightDuration.current = flightDuration;
  }, [flightDuration]);

  const hoverMaterial = useMemo(() => createHighlightMaterial(), []);
  const selectedMaterial = useMemo(() => createHighlightMaterial(), []);

  useEffect(
    () => () => {
      hoverMaterial.dispose();
      selectedMaterial.dispose();
    },
    [hoverMaterial, selectedMaterial],
  );

  useEffect(() => {
    const root = hoverRoot.current;
    if (!root) return;
    root.clear();
    root.visible = false;
    if (!hoveredPoiId) return;

    const clone = buildClone(scene, hoveredPoiId, hoverMaterial);
    if (!clone) return;
    root.add(clone);
    root.visible = true;
    hoverStartedAt.current = performance.now();
    setHighlightOpacity(hoverMaterial, 0);
  }, [scene, hoveredPoiId, hoverMaterial]);

  useEffect(() => {
    const root = selectedRoot.current;
    if (!root) return;
    root.clear();
    root.visible = false;
    if (!flightPoiId) return;

    const clone = buildClone(scene, flightPoiId, selectedMaterial);
    if (!clone) return;
    root.add(clone);
    root.visible = true;
    selectedStartedAt.current = performance.now();
    selectedDuration.current = latestFlightDuration.current;
    setHighlightOpacity(selectedMaterial, 0.84);
  }, [scene, flightPoiId, flightId, selectedMaterial]);

  useFrame(() => {
    if (hoverRoot.current?.visible) {
      const elapsed = (performance.now() - hoverStartedAt.current) / 1000;
      const progress = Math.min(1, elapsed / HOVER_PULSE_SECONDS);
      // Pulso de entrada y salida con fadeout de 1,25 s.
      const opacity = 0.78 * Math.sin(Math.PI * progress);
      setHighlightOpacity(hoverMaterial, opacity);
      if (progress >= 1) hoverRoot.current.visible = false;
    }

    if (selectedRoot.current?.visible) {
      const elapsed = (performance.now() - selectedStartedAt.current) / 1000;
      const opacity = Math.max(0, 0.84 * (1 - elapsed / selectedDuration.current));
      setHighlightOpacity(selectedMaterial, opacity);
      if (opacity <= 0) selectedRoot.current.visible = false;
    }
  });

  return (
    <>
      <group ref={hoverRoot} />
      <group ref={selectedRoot} />
    </>
  );
}
