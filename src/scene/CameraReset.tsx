import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DEFAULT_VIEW } from '../data/scene-config';
import { useStore } from '../store/useStore';

interface OrbitControlsLike {
  target: THREE.Vector3;
  enabled: boolean;
  enableDamping: boolean;
  update: () => void;
  saveState: () => void;
}

interface ResetTween {
  fromPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  elapsed: number;
  restoreEnabled: boolean;
  restoreDamping: boolean;
}

const DEFAULT_POSITION = new THREE.Vector3(...DEFAULT_VIEW.position);
const DEFAULT_TARGET = new THREE.Vector3(...DEFAULT_VIEW.target);
const RESET_DURATION_SECONDS = 3.2;

export default function CameraReset() {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as OrbitControlsLike | null;
  const request = useStore((state) => state.cameraResetRequest);
  const cameraRef = useRef(camera);
  const controlsRef = useRef(controls);
  const previousRequest = useRef(request);
  const tween = useRef<ResetTween | null>(null);

  useEffect(() => {
    cameraRef.current = camera;
    controlsRef.current = controls;
  }, [camera, controls]);

  useFrame((_, delta) => {
    const activeCamera = cameraRef.current;
    const activeControls = controlsRef.current;
    if (!activeControls) return;

    if (request !== previousRequest.current) {
      previousRequest.current = request;
      const existing = tween.current;
      const restoreEnabled = existing?.restoreEnabled ?? activeControls.enabled;
      const restoreDamping = existing?.restoreDamping ?? activeControls.enableDamping;

      activeControls.enableDamping = false;
      activeControls.update(); // Clear any residual orbit damping before the flight.
      tween.current = {
        fromPosition: activeCamera.position.clone(),
        fromTarget: activeControls.target.clone(),
        elapsed: 0,
        restoreEnabled,
        restoreDamping,
      };
      activeControls.enabled = false;
    }

    const current = tween.current;
    if (!current) return;

    current.elapsed += delta;
    const progress = Math.min(1, current.elapsed / RESET_DURATION_SECONDS);
    const eased = 1 - (1 - progress) ** 3;
    activeCamera.position.lerpVectors(current.fromPosition, DEFAULT_POSITION, eased);
    activeControls.target.lerpVectors(current.fromTarget, DEFAULT_TARGET, eased);
    activeCamera.lookAt(activeControls.target);
    activeCamera.updateMatrixWorld();
    if (progress >= 1) {
      activeCamera.position.copy(DEFAULT_POSITION);
      activeControls.target.copy(DEFAULT_TARGET);
      activeCamera.lookAt(DEFAULT_TARGET);
      activeControls.enabled = current.restoreEnabled;
      activeControls.enableDamping = current.restoreDamping;
      activeControls.saveState();
      tween.current = null;
    }
  });

  return null;
}
