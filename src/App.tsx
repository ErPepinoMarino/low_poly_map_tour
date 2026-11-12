import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { CAMERA_LIMITS, DEFAULT_VIEW, LIGHTING } from './data/scene-config';
import CameraGizmo from './scene/CameraGizmo';
import CameraTelemetry from './scene/CameraTelemetry';
import PoiCamera from './scene/PoiCamera';
import CameraSafetyBounds from './scene/CameraSafetyBounds';
import CameraReset from './scene/CameraReset';
import Effects from './scene/Effects';
import SceneStats from './scene/SceneStats';
import PhotoCapture from './scene/PhotoCapture';
import Scene from './scene/Scene';
import SceneReady from './scene/SceneReady';
import LoadingScreen from './ui/LoadingScreen';
import Overlay from './ui/Overlay';
import PhotoPreview from './ui/PhotoPreview';
import PoiPanel from './ui/PoiPanel';
import { usePoiDeepLink } from './router/usePoiDeepLink';
import { useStore } from './store/useStore';

export default function App() {
  const performanceMode = useStore((s) => s.performanceMode);
  const qualityTier = useStore((s) => s.qualityTier);
  const language = useStore((s) => s.language);
  const [sceneReady, setSceneReady] = useState(false);
  const [assetProgress, setAssetProgress] = useState(0);
  usePoiDeepLink();

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
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
        gl={{ preserveDrawingBuffer: true }}
        shadows="percentage"
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.AgXToneMapping;
          gl.toneMappingExposure = LIGHTING.exposure.day;
        }}
      >
        <Scene />
        <Effects />
        <PhotoCapture />
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
        <PoiCamera />
        <CameraSafetyBounds />
        <CameraTelemetry />
        <CameraGizmo />
        <SceneStats />
        <SceneReady
          onProgress={setAssetProgress}
          onReady={() => setSceneReady(true)}
        />
      </Canvas>
      <Overlay />
      <PoiPanel />
      <PhotoPreview />
      <LoadingScreen progress={assetProgress} ready={sceneReady} />
    </>
  );
}
