import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Cubos de referencia de los POIs (generados por scripts/build_pois.mjs).
const POIS_URL = `${import.meta.env.BASE_URL}models/pois.glb`;

export default function Pois() {
  const { scene } = useGLTF(POIS_URL);

  useEffect(() => {
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
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
