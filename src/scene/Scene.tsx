import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { PALETTE } from '../data/scene-config';

// Fase 1: escena de prueba. Se sustituye por el diorama real en Fase 2.
export default function Scene() {
  const cube = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (cube.current) {
      cube.current.rotation.y += delta * 0.4;
      cube.current.rotation.x += delta * 0.2;
    }
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} />
      {/* Cubo placeholder */}
      <mesh ref={cube}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={PALETTE.roof} flatShading />
      </mesh>
      {/* Suelo placeholder */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color={PALETTE.vegetation} />
      </mesh>
    </>
  );
}
