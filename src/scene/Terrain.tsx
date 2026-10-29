import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Terreno horneado (generado por scripts/build_terrain.mjs).
// BASE_URL hace que funcione tanto en dev como en GitHub Pages (base relativa).
const TERRAIN_URL = `${import.meta.env.BASE_URL}models/terrain.glb`;

export default function Terrain() {
  const { scene } = useGLTF(TERRAIN_URL);

  useEffect(() => {
    // El color viene de los vertex colors horneados en el GLB (COLOR_0).
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
    });
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).material = material;
      }
    });
  }, [scene]);

  return <primitive object={scene} />;
}
