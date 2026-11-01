import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { setupNamedMaterials } from '../lib/materials';

// Calles/carreteras/vía (exportadas desde Blender, con materiales nombrados).
const STREETS_URL = `${import.meta.env.BASE_URL}models/streets.glb`;

export default function Streets() {
  const { scene } = useGLTF(STREETS_URL);

  useEffect(() => {
    setupNamedMaterials(scene);
  }, [scene]);

  return <primitive object={scene} />;
}
