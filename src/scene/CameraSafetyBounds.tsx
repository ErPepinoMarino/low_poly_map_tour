import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { CAMERA_LIMITS } from '../data/scene-config';
import { getTerrainHeightIndex } from '../lib/terrainHeight';

const TERRAIN_URL = `${import.meta.env.BASE_URL}models/terrain.glb`;

interface OrbitControlsLike {
  target: THREE.Vector3;
}

// Keeps camera position inside the requested town safety envelope while
// preserving OrbitControls pan (camera and target are translated together).
export default function CameraSafetyBounds() {
  const { scene: terrainScene } = useGLTF(TERRAIN_URL);
  const terrain = useMemo(() => getTerrainHeightIndex(terrainScene), [terrainScene]);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as OrbitControlsLike | null;
  const cameraRef = useRef(camera);
  const controlsRef = useRef(controls);

  useEffect(() => {
    cameraRef.current = camera;
    controlsRef.current = controls;
  }, [camera, controls]);

  useFrame(() => {
    const activeCamera = cameraRef.current;
    const activeControls = controlsRef.current;
    if (!activeControls) return;
    const { minHeight, maxHeight, maxHorizontalRadius } = CAMERA_LIMITS;
    let dx = 0;
    let dz = 0;
    const radius = Math.hypot(activeCamera.position.x, activeCamera.position.z);

    if (radius > maxHorizontalRadius) {
      const scale = maxHorizontalRadius / radius;
      dx = activeCamera.position.x * (scale - 1);
      dz = activeCamera.position.z * (scale - 1);
    }

    const boundedX = activeCamera.position.x + dx;
    const boundedZ = activeCamera.position.z + dz;
    const terrainY =
      terrain.heightAt(boundedX, boundedZ) ??
      terrain.nearestHeightAt(boundedX, boundedZ);
    const safeMinimumY = Math.max(minHeight, terrainY === null ? minHeight : terrainY + minHeight);
    const dy =
      THREE.MathUtils.clamp(activeCamera.position.y, safeMinimumY, maxHeight) -
      activeCamera.position.y;
    if (dx !== 0 || dy !== 0 || dz !== 0) {
      activeCamera.position.x += dx;
      activeCamera.position.y += dy;
      activeCamera.position.z += dz;
      activeControls.target.x += dx;
      activeControls.target.y += dy;
      activeControls.target.z += dz;
      activeCamera.updateMatrixWorld();
    }
  });

  return null;
}
