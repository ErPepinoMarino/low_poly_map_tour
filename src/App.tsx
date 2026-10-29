import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Scene from './scene/Scene';
import Overlay from './ui/Overlay';

export default function App() {
  return (
    <>
      <Canvas camera={{ position: [0, 2400, 2600], fov: 45, near: 1, far: 20000 }} dpr={[1, 2]}>
        <Scene />
        <OrbitControls
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
