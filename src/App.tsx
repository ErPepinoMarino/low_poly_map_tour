import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { LIGHTING } from './data/scene-config';
import Effects from './scene/Effects';
import Scene from './scene/Scene';
import Overlay from './ui/Overlay';
import { useStore } from './store/useStore';

export default function App() {
  const performanceMode = useStore((s) => s.performanceMode);
  const qualityTier = useStore((s) => s.qualityTier);
  const dpr: [number, number] = performanceMode
    ? [1, 1]
    : qualityTier === 'low'
      ? [1, 1.5]
      : [1, 2];

  return (
    <>
      <Canvas
        camera={{ position: [0, 2400, 2600], fov: 45, near: 1, far: 20000 }}
        dpr={dpr}
        shadows="percentage"
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.AgXToneMapping;
          gl.toneMappingExposure = LIGHTING.exposure.day;
        }}
      >
        <Scene />
        <Effects />
        <OrbitControls
          makeDefault
          enableDamping
          target={[0, 0, 0]}
          minDistance={400}
          maxDistance={8000}
          maxPolarAngle={Math.PI / 2.1}
        />
      </Canvas>
      <Overlay />
    </>
  );
}
