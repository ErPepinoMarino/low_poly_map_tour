import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { setupNamedMaterials } from '../lib/materials';
import { setupPoiMaterials } from '../lib/poiMaterials';

// POIs con materiales nombrados desde Blender: castillo, torres y colegio.
// Los materiales reciclados (tejados, jardín, acera) usan los mismos patrones
// procedurales que las casas; los nuevos (piedra y césped) se generan aquí.
const POIS_URL = `${import.meta.env.BASE_URL}models/pois.glb`;

export default function Pois() {
  const { scene } = useGLTF(POIS_URL);

  useEffect(() => {
    setupNamedMaterials(scene);
    setupPoiMaterials(scene);
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
