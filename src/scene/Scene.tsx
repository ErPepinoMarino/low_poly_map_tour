import { useStore } from '../store/useStore';
import Birds from './Birds';
import Clouds from './Clouds';
import Houses from './Houses';
import RoadSigns from './RoadSigns';
import Train from './Train';
import TrainRoutePicker from './TrainRoutePicker';
import NightSky from './NightSky';
import Pois from './Pois';
import Streets from './Streets';
import Tracks from './Tracks';
import SunMoon from './SunMoon';
import Terrain from './Terrain';
import Windows from './Windows';

// Ajustes visuales del convoy.
const TRAIN_TUNING = {
  carGap: 1,
  verticalOffset: -2,
  returnStartDelay: 4,
} as const;

// Escena base + look final. SunMoon gobierna luz, fondo y niebla a partir de la
// hora de Almenara; el resto de capas son independientes.
export default function Scene() {
  const cloudsEnabled = useStore((state) => state.effects.clouds);
  const pickTrain =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('pickTrain');

  return (
    <>
      <SunMoon />
      <NightSky />
      <Clouds enabled={cloudsEnabled} />
      <Terrain />
      <Birds />
      <Streets />
      <Tracks />
      <RoadSigns />
      <Train
        pathName="trenPathIda"
        carGap={TRAIN_TUNING.carGap}
        verticalOffset={TRAIN_TUNING.verticalOffset}
      />
      <Train
        pathName="trenPathVuelta"
        reverse
        carGap={TRAIN_TUNING.carGap}
        verticalOffset={TRAIN_TUNING.verticalOffset}
        startDelay={TRAIN_TUNING.returnStartDelay}
      />
      <Houses />
      <Windows />
      <Pois />
      {pickTrain ? <TrainRoutePicker /> : null}
    </>
  );
}
