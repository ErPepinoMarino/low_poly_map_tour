import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { setupRoadMaterials } from '../lib/roadMaterials';

// Calles/carreteras/vía (exportadas desde Blender, con materiales nombrados).
const STREETS_URL = `${import.meta.env.BASE_URL}models/streets.glb`;

export default function Streets() {
  const { scene } = useGLTF(STREETS_URL);

  useEffect(() => {
    setupRoadMaterials(scene);
  }, [scene]);

  return <primitive object={scene} />;
}
