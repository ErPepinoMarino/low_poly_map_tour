import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { DIORAMA_CENTER } from '../data/scene-config';
import { getTerrainHeightIndex } from '../lib/terrainHeight';
import { useStore } from '../store/useStore';

const TERRAIN_URL = `${import.meta.env.BASE_URL}models/terrain.glb`;
const cameraWorld = new THREE.Vector3();
const dioramaCenter = new THREE.Vector3(...DIORAMA_CENTER);

interface OrbitControlsLike {
  target: THREE.Vector3;
  getPolarAngle: () => number;
  getAzimuthalAngle: () => number;
}

// Camera debug telemetry, orbit-target distance and diorama-center distance (15 Hz).
export default function CameraTelemetry() {
  const { scene: terrainScene } = useGLTF(TERRAIN_URL);
  const terrain = getTerrainHeightIndex(terrainScene);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as OrbitControlsLike | null;
  const setCameraInfo = useStore((state) => state.setCameraInfo);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    elapsed.current += delta;
    if (elapsed.current < 1 / 15) return;
    elapsed.current = 0;

    const target = controls?.target ?? new THREE.Vector3();
    camera.getWorldPosition(cameraWorld);
    const terrainSample = terrain.heightAt(cameraWorld.x, cameraWorld.z);
    const terrainInside = terrainSample !== null;
    const terrainHeight = terrainSample ?? terrain.nearestHeightAt(cameraWorld.x, cameraWorld.z);

    setCameraInfo({
      position: [cameraWorld.x, cameraWorld.y, cameraWorld.z],
      rotation: [
        THREE.MathUtils.radToDeg(camera.rotation.x),
        THREE.MathUtils.radToDeg(camera.rotation.y),
        THREE.MathUtils.radToDeg(camera.rotation.z),
      ],
      target: [target.x, target.y, target.z],
      distance: cameraWorld.distanceTo(target),
      centerDistance: cameraWorld.distanceTo(dioramaCenter),
      polar: controls ? THREE.MathUtils.radToDeg(controls.getPolarAngle()) : 0,
      azimuth: controls ? THREE.MathUtils.radToDeg(controls.getAzimuthalAngle()) : 0,
      terrainHeight,
      terrainInside,
      clearance: terrainHeight === null ? null : cameraWorld.y - terrainHeight,
    });
  });

  return null;
}
