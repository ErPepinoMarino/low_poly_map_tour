import Terrain from './Terrain';
import Streets from './Streets';
import Pois from './Pois';
import { PALETTE } from '../data/scene-config';

// Fase 2: escena base. Iluminación básica neutra (se refina en Fase 3/6).
export default function Scene() {
  return (
    <>
      <hemisphereLight args={[PALETTE.skyDay, PALETTE.ground, 0.7]} />
      <directionalLight position={[2000, 3000, 1500]} intensity={1.4} />
      <Terrain />
      <Streets />
      <Pois />
    </>
  );
}
