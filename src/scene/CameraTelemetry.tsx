import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store/useStore';

interface OrbitControlsLike {
  target: THREE.Vector3;
  getPolarAngle: () => number;
  getAzimuthalAngle: () => number;
}

// Publica posición/rotación de cámara en el store para el panel de depuración.
// Se actualiza a 10 Hz para no re-renderizar el HUD en cada frame.
export default function CameraTelemetry() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsLike | null;
  const setCameraInfo = useStore((s) => s.setCameraInfo);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    elapsed.current += delta;
    if (elapsed.current < 0.1) return;
    elapsed.current = 0;

    const target = controls?.target ?? new THREE.Vector3();
    setCameraInfo({
      position: [camera.position.x, camera.position.y, camera.position.z],
      rotation: [
        THREE.MathUtils.radToDeg(camera.rotation.x),
        THREE.MathUtils.radToDeg(camera.rotation.y),
        THREE.MathUtils.radToDeg(camera.rotation.z),
      ],
      target: [target.x, target.y, target.z],
      distance: camera.position.distanceTo(target),
      polar: controls ? THREE.MathUtils.radToDeg(controls.getPolarAngle()) : 0,
      azimuth: controls ? THREE.MathUtils.radToDeg(controls.getAzimuthalAngle()) : 0,
    });
  });

  return null;
}
