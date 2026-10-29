import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { PALETTE } from '../data/scene-config';

// Calles de referencia (generadas por scripts/build_streets.mjs).
const STREETS_URL = `${import.meta.env.BASE_URL}models/streets.glb`;

export default function Streets() {
  const { scene } = useGLTF(STREETS_URL);

  useEffect(() => {
    const material = new THREE.MeshStandardMaterial({
      color: PALETTE.road,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).material = material;
      }
    });
  }, [scene]);

  return <primitive object={scene} />;
}
