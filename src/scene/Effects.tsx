import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Bloom, DepthOfField, EffectComposer, SMAA, Vignette } from '@react-three/postprocessing';
import { useTranslation } from 'react-i18next';
import type { DepthOfFieldEffect } from 'postprocessing';
import * as THREE from 'three';
import { LIGHTING } from '../data/scene-config';
import { useStore } from '../store/useStore';

const CAMERA_FOCUS_BAND =
  /float signedDistance=distance-focusDistance;float magnitude=smoothstep\(0\.0,focusRange,abs\(signedDistance\)\);gl_FragColor\.rg=magnitude\*vec2\(step\(signedDistance,0\.0\),step\(0\.0,signedDistance\)\);/;

function patchCameraFocusBand(material: THREE.ShaderMaterial, near: number, far: number) {
  if (!material.userData.cameraFocusBandPatched) {
    if (!CAMERA_FOCUS_BAND.test(material.fragmentShader)) {
      throw new Error('DepthOfField shader changed; could not find its default focus equation.');
    }
    const shader = material.fragmentShader.replace(
      '#include <common>',
      '#include <common>\nuniform float uFocusNear;\nuniform float uFocusFar;\nuniform float uNearBlurTransition;\nuniform float uFarBlurTransition;\nuniform float uNearBlurMultiplier;\nuniform float uFarBlurMultiplier;',
    );
    if (!shader.includes('float distance=getDistance(viewPosition);')) {
      throw new Error('DepthOfField shader changed; could not switch to camera-axis depth.');
    }
    const cameraDepthShader = shader.replace(
      'float distance=getDistance(viewPosition);',
      'float distance=-viewPosition.z;',
    );
    if (!CAMERA_FOCUS_BAND.test(cameraDepthShader)) {
      throw new Error('DepthOfField focus equation changed; could not install near/far band.');
    }
    material.fragmentShader = cameraDepthShader.replace(
      CAMERA_FOCUS_BAND,
      `float nearDelta = uFocusNear - distance;
       float farDelta = distance - uFocusFar;
       float nearBlur = smoothstep(0.0, uNearBlurTransition, nearDelta) * uNearBlurMultiplier;
       float farBlur = smoothstep(0.0, uFarBlurTransition, farDelta) * uFarBlurMultiplier;
       float magnitude = max(nearBlur, farBlur);
       gl_FragColor.rg = magnitude * vec2(step(distance, uFocusNear), step(uFocusFar, distance));`,
    );
    material.uniforms.uFocusNear = { value: near };
    material.uniforms.uFocusFar = { value: far };
    material.uniforms.uNearBlurTransition = { value: near };
    material.uniforms.uFarBlurTransition = { value: LIGHTING.dof.farBlurTransition };
    material.uniforms.uNearBlurMultiplier = { value: LIGHTING.dof.nearBlurMultiplier };
    material.uniforms.uFarBlurMultiplier = { value: LIGHTING.dof.farBlurMultiplier };
    material.userData.cameraFocusBandPatched = true;
    material.needsUpdate = true;
  }

  material.uniforms.uFocusNear.value = near;
  material.uniforms.uFocusFar.value = far;
  material.uniforms.uNearBlurTransition.value = near;
  material.uniforms.uFarBlurTransition.value = LIGHTING.dof.farBlurTransition;
  material.uniforms.uNearBlurMultiplier.value = LIGHTING.dof.nearBlurMultiplier;
  material.uniforms.uFarBlurMultiplier.value = LIGHTING.dof.farBlurMultiplier;
}

const FRAME_VERTICES = new Float32Array([
  -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0,
  -0.5, -0.5, 0, -0.5, 0, 0, 0.5, 0, 0, 0, -0.5, 0, 0, 0.5, 0,
]);

function DofPlane({
  depth,
  color,
  label,
  labelOffset,
}: {
  depth: number;
  color: string;
  label: string;
  labelOffset: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const cameraPosition = useRef(new THREE.Vector3());
  const cameraDirection = useRef(new THREE.Vector3());
  const camera = useThree((state) => state.camera);
  const frameGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(FRAME_VERTICES, 3));
    return geometry;
  }, []);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    camera.getWorldPosition(cameraPosition.current);
    camera.getWorldDirection(cameraDirection.current);
    group.position.copy(cameraPosition.current).addScaledVector(cameraDirection.current, depth);
    group.quaternion.copy(camera.quaternion);
    // A fixed world-space size makes the two camera-depth planes visibly
    // different in perspective and lets them slice through the town geometry.
    const size = LIGHTING.dof.gizmoSize;
    group.scale.set(size, size, 1);
  });

  return (
    <group ref={groupRef}>
      <mesh
        renderOrder={998}
        castShadow={false}
        receiveShadow={false}
        userData={{ excludeFromSceneStats: true }}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <lineSegments geometry={frameGeometry} renderOrder={999}>
        <lineBasicMaterial color={color} depthTest={false} depthWrite={false} toneMapped={false} />
      </lineSegments>
      <Html center zIndexRange={[30, 0]}>
        <div
          className="dof-gizmo-label"
          style={{ borderColor: color, color, transform: `translateY(${labelOffset}px)` }}
        >
          {label} · {depth.toFixed(0)} m
        </div>
      </Html>
    </group>
  );
}

function DofGizmo({ near, far }: { near: number; far: number }) {
  const { t } = useTranslation();
  return (
    <>
      <DofPlane depth={near} color="#49e3d0" label={t('hud.dofNearPlane')} labelOffset={-24} />
      <DofPlane depth={far} color="#ffae57" label={t('hud.dofFarPlane')} labelOffset={24} />
    </>
  );
}

// Camera-space DOF: [near, far] is the sharp depth band measured along the
// camera view axis. Foreground and background blur progressively outside it.
export default function Effects() {
  const effects = useStore((state) => state.effects);
  const performanceMode = useStore((state) => state.performanceMode);
  const dofNear = useStore((state) => state.dofNear);
  const dofFar = useStore((state) => state.dofFar);
  // El autoapagado usa la distancia al centro del diorama, no al target de
  // OrbitControls: el target se mueve con el pan y puede estar al otro extremo.
  const centerDistance = useStore((state) => state.cameraInfo?.centerDistance ?? Infinity);
  const showDofGuide = useStore((state) => state.showDofGuide);
  const near = Math.max(20, dofNear);
  const far = Math.max(near + 10, dofFar);
  const dofRef = useRef<DepthOfFieldEffect>(null);
  const dofEnabled =
    effects.dof && !performanceMode && centerDistance <= LIGHTING.dof.autoDisableDistance;

  useFrame(() => {
    const dof = dofRef.current;
    if (!dof) return;
    patchCameraFocusBand(dof.circleOfConfusionMaterial, near, far);
    dof.bokehScale = LIGHTING.dof.maxBokeh;
  });

  const composerEnabled =
    !performanceMode && (effects.bloom || effects.vignette || effects.smaa || dofEnabled);

  return (
    <>
      {showDofGuide && dofEnabled ? <DofGizmo near={near} far={far} /> : null}
      {composerEnabled ? (
        <EffectComposer multisampling={effects.smaa ? 0 : 4} enableNormalPass={false}>
          {dofEnabled ? (
            <DepthOfField
              ref={dofRef}
              focusDistance={(near + far) / 2}
              focusRange={LIGHTING.dof.farBlurTransition}
              bokehScale={LIGHTING.dof.maxBokeh}
              resolutionScale={LIGHTING.dof.resolutionScale}
            />
          ) : null}
          {effects.bloom ? (
            <Bloom
              luminanceThreshold={0.85}
              luminanceSmoothing={0.2}
              intensity={0.7}
              mipmapBlur
              radius={0.7}
            />
          ) : null}
          {effects.vignette ? <Vignette offset={0.3} darkness={0.55} /> : null}
          {effects.smaa ? <SMAA /> : null}
        </EffectComposer>
      ) : null}
    </>
  );
}
