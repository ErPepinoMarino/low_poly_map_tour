import { useStore } from '../store/useStore';
import Clouds from './Clouds';
import Houses from './Houses';
import RoadSigns from './RoadSigns';
import NightSky from './NightSky';
import Pois from './Pois';
import Streets from './Streets';
import SunMoon from './SunMoon';
import Terrain from './Terrain';
import Windows from './Windows';

// Escena base + look final. SunMoon gobierna luz, fondo y niebla a partir de la
// hora de Almenara; el resto de capas son independientes.
export default function Scene() {
  const cloudsEnabled = useStore((state) => state.effects.clouds);

  return (
    <>
      <SunMoon />
      <NightSky />
      <Clouds enabled={cloudsEnabled} />
      <Terrain />
      <Streets />
      <RoadSigns />
      <Houses />
      <Windows />
      <Pois />
    </>
  );
}
