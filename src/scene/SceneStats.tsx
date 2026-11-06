import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore, type SceneStats as SceneStatsData } from '../store/useStore';

function measureScene(scene: THREE.Scene): SceneStatsData {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  let meshes = 0;
  let triangles = 0;
  let drawCalls = 0;

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.excludeFromSceneStats) return;
    meshes++;
    geometries.add(mesh.geometry);

    const position = mesh.geometry.getAttribute('position');
    const indexedCount = mesh.geometry.index?.count ?? position?.count ?? 0;
    if (mesh.geometry.groups.length > 0) {
      for (const group of mesh.geometry.groups) triangles += Math.floor(group.count / 3);
      drawCalls += mesh.geometry.groups.length;
    } else {
      triangles += Math.floor(indexedCount / 3);
      drawCalls += Array.isArray(mesh.material) ? mesh.material.length : 1;
    }

    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of meshMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value && typeof value === 'object' && (value as THREE.Texture).isTexture) {
          textures.add(value as THREE.Texture);
        }
      }
    }
  });

  return {
    meshes,
    triangles,
    geometries: geometries.size,
    materials: materials.size,
    textures: textures.size,
    drawCalls,
  };
}

// The scene is static, so measuring once per second is sufficient for nerd info.
export default function SceneStats() {
  const scene = useThree((state) => state.scene);
  const elapsed = useRef(0);
  const previous = useRef('');

  useFrame((_, delta) => {
    elapsed.current += delta;
    if (elapsed.current < 1) return;
    elapsed.current = 0;

    const stats = measureScene(scene);
    const key = JSON.stringify(stats);
    if (key === previous.current) return;
    previous.current = key;
    useStore.getState().setSceneStats(stats);
  });

  return null;
}
