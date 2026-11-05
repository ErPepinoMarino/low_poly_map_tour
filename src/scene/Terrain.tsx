import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { getNoiseTexture } from '../lib/noiseTexture';
import { PALETTE } from '../data/scene-config';

// Terreno (editado en Blender y recoloreado por scripts/colorize_terrain.mjs).
const TERRAIN_URL = `${import.meta.env.BASE_URL}models/terrain.glb`;

export default function Terrain() {
  const { scene } = useGLTF(TERRAIN_URL);

  useEffect(() => {
    const noise = getNoiseTexture();
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        // Si el GLB trae vertex colors los usamos; si no, color plano (nunca negro).
        const hasColors = mesh.geometry.getAttribute('color') !== undefined;
        mesh.material = hasColors
          ? new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, map: noise })
          : new THREE.MeshStandardMaterial({ color: PALETTE.vegetation, flatShading: true, map: noise });
        mesh.receiveShadow = true;
      }
    });
  }, [scene]);

  return <primitive object={scene} />;
}
