import { useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { POIS } from '../data/pois';
import { setupNamedMaterials } from '../lib/materials';
import { setupPoiMaterials } from '../lib/poiMaterials';
import { useStore } from '../store/useStore';
import PoiHighlight from './PoiHighlight';

// POIs con materiales nombrados desde Blender: castillo, torres, colegio,
// iglesia, mercado, estación y placeholders. La selección se hace por mesh,
// etiquetando cada objeto con el id del nodo de Blender.
const POIS_URL = `${import.meta.env.BASE_URL}models/pois.glb`;

function poiIdFromObject(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.userData.poiId) return current.userData.poiId as string;
    if (POIS.some((poi) => poi.node === current?.name)) return current.name;
    current = current.parent;
  }
  return null;
}

export default function Pois() {
  const { scene } = useGLTF(POIS_URL);
  const navigateToPoi = useStore((state) => state.navigateToPoi);
  const setHoveredPoiId = useStore((state) => state.setHoveredPoiId);
  const hoveredRef = useRef<string | null>(null);

  useEffect(() => {
    setupNamedMaterials(scene);
    setupPoiMaterials(scene);

    const nodeIds = new Set(POIS.map((poi) => poi.node));
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      let current: THREE.Object3D | null = mesh;
      while (current) {
        if (nodeIds.has(current.name)) {
          mesh.userData.poiId = current.name;
          break;
        }
        current = current.parent;
      }
    });
  }, [scene]);

  useEffect(
    () => () => {
      document.body.style.cursor = '';
      setHoveredPoiId(null);
    },
    [setHoveredPoiId],
  );

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    // Ignora el click que termina un arrastre de órbita/pan.
    if (event.delta > 4) return;
    const id = poiIdFromObject(event.object);
    if (!id) return;
    navigateToPoi(id, 'map');
  };

  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    const id = poiIdFromObject(event.object);
    document.body.style.cursor = id ? 'pointer' : '';
    if (hoveredRef.current === id) return;
    hoveredRef.current = id;
    setHoveredPoiId(id);
  };

  const onPointerOut = () => {
    hoveredRef.current = null;
    document.body.style.cursor = '';
    setHoveredPoiId(null);
  };

  return (
    <>
      <group onClick={onClick} onPointerMove={onPointerMove} onPointerOut={onPointerOut}>
        <primitive object={scene} />
      </group>
      <PoiHighlight scene={scene} />
    </>
  );
}
