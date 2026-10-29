import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { getNoiseTexture } from '../lib/noiseTexture';

// Terreno horneado (generado por scripts/build_terrain.mjs).
// BASE_URL hace que funcione tanto en dev como en GitHub Pages (base relativa).
const TERRAIN_URL = `${import.meta.env.BASE_URL}models/terrain.glb`;

export default function Terrain() {
  const { scene } = useGLTF(TERRAIN_URL);

  useEffect(() => {
    // El color viene de los vertex colors (COLOR_0) + grano sutil (ruido).
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      map: getNoiseTexture(),
    });
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).material = material;
      }
    });
  }, [scene]);

  return <primitive object={scene} />;
}
