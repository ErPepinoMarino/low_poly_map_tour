import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Scene from './scene/Scene';
import Overlay from './ui/Overlay';

export default function App() {
  return (
    <>
      <Canvas camera={{ position: [6, 6, 8], fov: 45 }} dpr={[1, 2]}>
        <Scene />
        <OrbitControls enableDamping />
      </Canvas>
      <Overlay />
    </>
  );
}
