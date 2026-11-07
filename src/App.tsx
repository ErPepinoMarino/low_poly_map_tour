import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { CAMERA_LIMITS, DEFAULT_VIEW, LIGHTING } from './data/scene-config';
import CameraGizmo from './scene/CameraGizmo';
import CameraTelemetry from './scene/CameraTelemetry';
import CameraSafetyBounds from './scene/CameraSafetyBounds';
import CameraReset from './scene/CameraReset';
import Effects from './scene/Effects';
import SceneStats from './scene/SceneStats';
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
        camera={{ position: DEFAULT_VIEW.position, fov: 45, near: 1, far: 20000 }}
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
          target={DEFAULT_VIEW.target}
          minDistance={CAMERA_LIMITS.minDistance}
          maxDistance={CAMERA_LIMITS.maxDistance}
          minPolarAngle={CAMERA_LIMITS.minPolarAngle}
          maxPolarAngle={CAMERA_LIMITS.maxPolarAngle}
        />
        <CameraReset />
        <CameraSafetyBounds />
        <CameraTelemetry />
        <CameraGizmo />
        <SceneStats />
      </Canvas>
      <Overlay />
    </>
  );
}
