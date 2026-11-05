import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { PALETTE } from '../data/scene-config';

// POIs (modelos simplificados, aún sin textura) como marcadores de posición.
const POIS_URL = `${import.meta.env.BASE_URL}models/pois.glb`;

export default function Pois() {
  const { scene } = useGLTF(POIS_URL);

  useEffect(() => {
    const material = new THREE.MeshStandardMaterial({
      color: PALETTE.accent,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.material = material;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [scene]);

  return <primitive object={scene} />;
}
