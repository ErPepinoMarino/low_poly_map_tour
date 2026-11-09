import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DEFAULT_VIEW } from '../data/scene-config';
import {
  createCameraFlightPlan,
  getCameraFlightProgress,
  sampleCameraFlightPosition,
  sampleCameraFlightQuaternion,
  type CameraFlightPlan,
} from '../lib/cameraFlight';
import { useStore } from '../store/useStore';

interface OrbitControlsLike {
  target: THREE.Vector3;
  enabled: boolean;
  enableDamping: boolean;
  update: () => void;
  saveState: () => void;
}

interface ResetFlight {
  plan: CameraFlightPlan;
  elapsed: number;
  restoreEnabled: boolean;
  restoreDamping: boolean;
}

const DEFAULT_POSITION = new THREE.Vector3(...DEFAULT_VIEW.position);
const DEFAULT_TARGET = new THREE.Vector3(...DEFAULT_VIEW.target);
const resetPosition = new THREE.Vector3();
const resetQuaternion = new THREE.Quaternion();

export default function CameraReset() {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as OrbitControlsLike | null;
  const request = useStore((state) => state.cameraResetRequest);
  const flightRequest = useStore((state) => state.cameraFlightRequest);
  const cameraRef = useRef(camera);
  const controlsRef = useRef(controls);
  const previousRequest = useRef(request);
  const flight = useRef<ResetFlight | null>(null);

  useEffect(() => {
    cameraRef.current = camera;
    controlsRef.current = controls;
  }, [camera, controls]);

  useFrame((_, delta) => {
    const activeCamera = cameraRef.current;
    const activeControls = controlsRef.current;
    if (!activeControls) return;

    // Un vuelo de POI tiene prioridad: cancela el vuelo de reset si estaba activo.
    if (flightRequest) {
      const current = flight.current;
      if (current) {
        activeControls.enabled = current.restoreEnabled;
        activeControls.enableDamping = current.restoreDamping;
        flight.current = null;
      }
      return;
    }

    if (request !== previousRequest.current) {
      previousRequest.current = request;
      const existing = flight.current;
      const restoreEnabled = existing?.restoreEnabled ?? activeControls.enabled;
      const restoreDamping = existing?.restoreDamping ?? activeControls.enableDamping;

      activeControls.enableDamping = false;
      activeControls.update(); // Clear any residual orbit damping before the flight.
      flight.current = {
        plan: createCameraFlightPlan({
          startPosition: activeCamera.position,
          startQuaternion: activeCamera.quaternion,
          endPosition: DEFAULT_POSITION,
          endTarget: DEFAULT_TARGET,
          up: activeCamera.up,
        }),
        elapsed: 0,
        restoreEnabled,
        restoreDamping,
      };
      activeControls.enabled = false;
    }

    const current = flight.current;
    if (!current) return;

    current.elapsed += delta;
    const progress = getCameraFlightProgress(current.elapsed, current.plan);
    sampleCameraFlightPosition(current.plan, progress, resetPosition);
    sampleCameraFlightQuaternion(current.plan, progress, resetQuaternion);
    activeCamera.position.copy(resetPosition);
    activeCamera.quaternion.copy(resetQuaternion);
    activeCamera.updateMatrixWorld();

    if (current.elapsed < current.plan.duration) return;

    activeCamera.position.copy(DEFAULT_POSITION);
    activeCamera.quaternion.copy(current.plan.endQuaternion);
    activeControls.target.copy(DEFAULT_TARGET);
    activeControls.enabled = current.restoreEnabled;
    activeControls.enableDamping = current.restoreDamping;
    activeControls.update();
    activeControls.saveState();
    flight.current = null;
  });

  return null;
}
