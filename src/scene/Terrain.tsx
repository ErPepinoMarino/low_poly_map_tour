import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { PALETTE } from '../data/scene-config';

// Terreno horneado (generado por scripts/build_terrain.mjs).
// BASE_URL hace que funcione tanto en dev como en GitHub Pages (base relativa).
const TERRAIN_URL = `${import.meta.env.BASE_URL}models/terrain.glb`;

export default function Terrain() {
  const { scene } = useGLTF(TERRAIN_URL);

  useEffect(() => {
    // El GLB no lleva material; lo asignamos aquí (flat shading = look low-poly).
    const material = new THREE.MeshStandardMaterial({
      color: PALETTE.vegetation,
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
