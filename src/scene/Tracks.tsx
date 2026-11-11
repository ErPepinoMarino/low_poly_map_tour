import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { setupNamedMaterials } from '../lib/materials';

const TRACKS_URL = `${import.meta.env.BASE_URL}models/vias.glb`;

// vias.glb contiene la malla de la vía y las polilíneas de recorrido del tren.
// La malla se renderiza; las polilíneas solo se usan desde Train.
export default function Tracks() {
  const { scene } = useGLTF(TRACKS_URL);
  const track = useMemo(() => scene.getObjectByName('viasTren') ?? null, [scene]);

  useEffect(() => {
    if (!track) return;
    setupNamedMaterials(track);
    track.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) mesh.receiveShadow = true;
    });
  }, [track]);

  return track ? <primitive object={track} /> : null;
}
