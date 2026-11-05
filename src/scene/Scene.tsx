import Houses from './Houses';
import Pois from './Pois';
import Streets from './Streets';
import SunMoon from './SunMoon';
import Terrain from './Terrain';

// Escena base + look final. SunMoon gobierna luz, fondo y niebla a partir de la
// hora de Almenara; el resto de capas son independientes.
export default function Scene() {
  return (
    <>
      <SunMoon />
      <Terrain />
      <Streets />
      <Houses />
      <Pois />
    </>
  );
}
