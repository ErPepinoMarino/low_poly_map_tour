import { useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTimeOfDay } from '../lighting/useTimeOfDay';
import { setupWindowMaterials, updateWindowLighting } from '../lib/windowMaterials';

// Ventanas: puede ser un solo mesh con varias islas o varios objetos con el
// material `luz`. El encendido nocturno se resuelve por ventana en el shader.
const WINDOWS_URL = `${import.meta.env.BASE_URL}models/ventanas.glb`;

export default function Windows() {
  const { scene } = useGLTF(WINDOWS_URL);
  const time = useTimeOfDay();

  useEffect(() => {
    // Este GLB es solo de ventanas, así que el material genérico `luz` también
    // debe tratarse como cristal aunque el nodo no se llame `ventana`.
    setupWindowMaterials(scene, true);
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        // Las ventanas van pegadas a la fachada y son emisivas: su sombra no
        // aporta nada y obliga a renderizar toda la malla en el shadow map.
        mesh.castShadow = false;
        mesh.receiveShadow = true;
      }
    });
  }, [scene]);

  useFrame(({ clock }) => {
    updateWindowLighting(time.nightFactor, time.townHour, time.duskHour, clock.elapsedTime);
  });

  return <primitive object={scene} />;
}
