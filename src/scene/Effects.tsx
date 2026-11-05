import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  SMAA,
  Vignette,
} from '@react-three/postprocessing';
import type { DepthOfFieldEffect } from 'postprocessing';
import * as THREE from 'three';
import { LIGHTING } from '../data/scene-config';
import { useStore } from '../store/useStore';

const ORIGIN = new THREE.Vector3();

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Postprocesado opcional. El DOF solo se monta cuando la cámara está cerca;
// lejos no se paga el pase. Bloom/Vignette/SMAA se pueden apagar desde el HUD.
export default function Effects() {
  const effects = useStore((s) => s.effects);
  const performanceMode = useStore((s) => s.performanceMode);
  const dofNear = useStore((s) => s.dofNear);
  const dofFar = useStore((s) => s.dofFar);
  const near = Math.min(dofNear, dofFar - 1);
  const far = Math.max(dofFar, near + 1);
  const dofRef = useRef<DepthOfFieldEffect>(null);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3;
  } | null;
  const [dofActive, setDofActive] = useState(false);

  useFrame(() => {
    const target = controls?.target ?? ORIGIN;
    const distance = camera.position.distanceTo(target);
    const active = effects.dof && !performanceMode && distance < far;
    if (active !== dofActive) setDofActive(active);

    const dof = dofRef.current;
    if (dof) {
      const strength = 1 - smoothstep(near, far, distance);
      dof.circleOfConfusionMaterial.focusDistance = distance;
      dof.circleOfConfusionMaterial.focusRange = LIGHTING.dof.focusRange;
      dof.bokehScale = LIGHTING.dof.maxBokeh * strength;
    }
  });

  const composerEnabled =
    !performanceMode && (effects.bloom || effects.vignette || effects.smaa || dofActive);
  if (!composerEnabled) return null;

  return (
    <EffectComposer multisampling={effects.smaa ? 0 : 4} enableNormalPass={false}>
      {dofActive ? (
        <DepthOfField
          ref={dofRef}
          focusDistance={200}
          focusRange={LIGHTING.dof.focusRange}
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
  );
}
