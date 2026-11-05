import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { setupNamedMaterials } from '../lib/materials';

// Casas del pueblo (exportadas desde Blender con materiales nombrados).
// Puede reutilizar materiales de streets.glb por nombre (p. ej. "Calle" o "Jardin").
const HOUSES_URL = `${import.meta.env.BASE_URL}models/houses.glb`;

export default function Houses() {
  const { scene } = useGLTF(HOUSES_URL);

  useEffect(() => {
    setupNamedMaterials(scene);
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [scene]);

  return <primitive object={scene} />;
}
