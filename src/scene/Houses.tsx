import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { setupHouseMaterials } from '../lib/houseMaterials';

// Casas del pueblo (exportadas desde Blender con materiales nombrados).
const HOUSES_URL = `${import.meta.env.BASE_URL}models/houses.glb`;

export default function Houses() {
  const { scene } = useGLTF(HOUSES_URL);

  useEffect(() => {
    setupHouseMaterials(scene);
  }, [scene]);

  return <primitive object={scene} />;
}
