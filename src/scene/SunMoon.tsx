import { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { LIGHTING } from '../data/scene-config';
import { useTimeOfDay } from '../lighting/useTimeOfDay';
import { disableShadowMapAutoUpdate, markShadowMapDirty } from '../lib/shadowMap';
import { directionFromAltAz } from '../lib/timeOfDay';
import { useStore } from '../store/useStore';

const C = {
  sunDay: new THREE.Color(LIGHTING.colors.sunDay),
  sunSet: new THREE.Color(LIGHTING.colors.sunSet),
  moon: new THREE.Color(LIGHTING.colors.moon),
  skyDay: new THREE.Color(LIGHTING.colors.skyDay),
  skyNight: new THREE.Color(LIGHTING.colors.skyNight),
  groundDay: new THREE.Color(LIGHTING.colors.groundDay),
  groundNight: new THREE.Color(LIGHTING.colors.groundNight),
  ambientDay: new THREE.Color(LIGHTING.colors.ambientDay),
  ambientNight: new THREE.Color(LIGHTING.colors.ambientNight),
  fogNight: new THREE.Color(LIGHTING.colors.fogNight),
  fogSunset: new THREE.Color(LIGHTING.colors.fogSunset),
  fogDay: new THREE.Color(LIGHTING.colors.fogDay),
  backgroundNight: new THREE.Color(LIGHTING.colors.backgroundNight),
  backgroundSunset: new THREE.Color(LIGHTING.colors.backgroundSunset),
  backgroundDay: new THREE.Color(LIGHTING.colors.backgroundDay),
};

const tmpSunPos = new THREE.Vector3();
const tmpSunColor = new THREE.Color();
const tmpSky = new THREE.Color();
const tmpGround = new THREE.Color();
const tmpAmbient = new THREE.Color();
const tmpFog = new THREE.Color();
const tmpBackground = new THREE.Color();

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Cielo: azul profundo de noche → naranja en el horizonte → azul claro de día.
function backgroundForAltitude(altitude: number, out: THREE.Color): THREE.Color {
  if (altitude <= -0.12) return out.copy(C.backgroundNight);
  if (altitude < 0) {
    return out.copy(C.backgroundNight).lerp(C.backgroundSunset, smoothstep(-0.12, 0, altitude));
  }
  return out.copy(C.backgroundSunset).lerp(C.backgroundDay, smoothstep(0, 0.35, altitude));
}

// La niebla sigue al cielo, un poco más apagada para leerse sobre él.
function fogForAltitude(altitude: number, out: THREE.Color): THREE.Color {
  if (altitude <= -0.12) return out.copy(C.fogNight);
  if (altitude < 0) {
    return out.copy(C.fogNight).lerp(C.fogSunset, smoothstep(-0.12, 0, altitude));
  }
  return out.copy(C.fogSunset).lerp(C.fogDay, smoothstep(0, 0.35, altitude));
}

// Sol/luna, hemisférica, ambiente, niebla y fondo sincronizados con la hora.
export default function SunMoon() {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const backgroundRef = useRef<THREE.Color>(null);
  const fogRef = useRef<THREE.FogExp2>(null);
  const firstFrame = useRef(true);
  const gl = useThree((state) => state.gl);
  const { loaded, total } = useProgress();
  const lastShadowAzimuth = useRef<number | null>(null);
  const shadowWasEnabled = useRef(false);
  const time = useTimeOfDay();
  const fogEnabled = useStore((s) => s.effects.fog);
  const shadowsEnabled = useStore((s) => s.effects.shadows);
  const performanceMode = useStore((s) => s.performanceMode);
  const qualityTier = useStore((s) => s.qualityTier);
  const [shadowPassEnabled, setShadowPassEnabled] = useState(
    () => shadowsEnabled && !performanceMode && time.nightFactor < 0.999,
  );
  const shadowSize =
    qualityTier === 'low' ? LIGHTING.shadow.mapSizeLow : LIGHTING.shadow.mapSizeHigh;

  // El shadow map direccional no depende de la cámara. Lo congelamos y pedimos
  // un render nuevo solo al cargar modelos, cambiar el tamaño o girar el sol.
  useEffect(() => {
    disableShadowMapAutoUpdate(gl);
  }, [gl]);

  useEffect(() => {
    markShadowMapDirty(gl);
  }, [gl, shadowSize, loaded, total]);

  useFrame((_, delta) => {
    const sun = sunRef.current;
    const hemi = hemiRef.current;
    const ambient = ambientRef.current;
    if (!sun || !hemi || !ambient) return;

    const instant = firstFrame.current;
    const daylight = 1 - time.nightFactor;
    const altitude = time.sunAltitude;
    const isNight = altitude < -0.02;
    const shadowRequested = shadowsEnabled && !performanceMode;
    const targetShadowIntensity = shadowRequested ? 1 - time.nightFactor : 0;
    const shadowDelta = Math.min(delta, 1 / 30);
    if (!shadowPassEnabled) {
      sun.shadow.intensity = 0;
      if (targetShadowIntensity > 0.005) setShadowPassEnabled(true);
    } else {
      sun.shadow.intensity = instant
        ? targetShadowIntensity
        : THREE.MathUtils.damp(
            sun.shadow.intensity,
            targetShadowIntensity,
            LIGHTING.shadow.fadeRate,
            shadowDelta,
          );
      if (targetShadowIntensity <= 0.005 && sun.shadow.intensity <= 0.005) {
        setShadowPassEnabled(false);
      }
    }

    // Elevación fija 40° (sombras largas) + azimut real del sol/luna: la sombra gira
    // con la hora. De noche las sombras se apagan, así que solo importa la luz.
    const lightAzimuth = isNight ? time.moonAzimuth : time.sunAzimuth;
    const dir = directionFromAltAz(LIGHTING.shadow.elevation, lightAzimuth);
    const dirY = Math.max(0.16, dir.y);
    tmpSunPos.set(dir.x, dirY, dir.z).normalize().multiplyScalar(3200);
    sun.position.lerp(tmpSunPos, instant ? 1 : 1 - Math.exp(-delta * 1.8));

    // El mapa de sombras solo se recalcula cuando el sol ha girado lo suficiente.
    // Se usa la posición real (con damping), no el target: así los cambios
    // manuales de hora no se quedan con un mapa viejo a medio interpolar.
    if (!shadowPassEnabled) {
      shadowWasEnabled.current = false;
    } else {
      const actualAzimuth = Math.atan2(sun.position.x, -sun.position.z);
      const last = lastShadowAzimuth.current;
      const azimuthDelta =
        last === null
          ? Infinity
          : Math.atan2(Math.sin(actualAzimuth - last), Math.cos(actualAzimuth - last));
      const threshold = THREE.MathUtils.degToRad(LIGHTING.shadow.updateAngleDeg);
      if (!shadowWasEnabled.current || Math.abs(azimuthDelta) >= threshold) {
        markShadowMapDirty(gl);
        lastShadowAzimuth.current = actualAzimuth;
        shadowWasEnabled.current = true;
      }
    }

    // Color e intensidad sí siguen la hora: blanco cálido, naranja al horizonte, luna fría.
    const horizonMix = 1 - smoothstep(0.0, 0.45, altitude);
    if (isNight) {
      tmpSunColor.copy(C.moon);
    } else {
      tmpSunColor.copy(C.sunDay).lerp(C.sunSet, horizonMix);
    }
    const sunHeight = Math.max(0, Math.sin(altitude));
    const sunIntensity = isNight
      ? LIGHTING.intensities.moon * time.nightFactor
      : LIGHTING.intensities.sunDay * sunHeight +
        LIGHTING.intensities.sunSet * (1 - sunHeight) * 0.35;

    const colorAlpha = instant ? 1 : 1 - Math.exp(-delta * 3);
    sun.color.lerp(tmpSunColor, colorAlpha);
    sun.intensity = instant
      ? sunIntensity
      : THREE.MathUtils.damp(sun.intensity, sunIntensity, 0.6, delta);

    tmpSky.copy(C.skyNight).lerp(C.skyDay, daylight);
    tmpGround.copy(C.groundNight).lerp(C.groundDay, daylight);
    hemi.color.lerp(tmpSky, colorAlpha);
    hemi.groundColor.lerp(tmpGround, colorAlpha);
    const hemiIntensity = THREE.MathUtils.lerp(
      LIGHTING.intensities.hemisphereNight,
      LIGHTING.intensities.hemisphereDay,
      daylight,
    );
    hemi.intensity = instant
      ? hemiIntensity
      : THREE.MathUtils.damp(hemi.intensity, hemiIntensity, 0.6, delta);

    tmpAmbient.copy(C.ambientNight).lerp(C.ambientDay, daylight);
    ambient.color.lerp(tmpAmbient, colorAlpha);
    const ambientIntensity = THREE.MathUtils.lerp(
      LIGHTING.intensities.ambientNight,
      LIGHTING.intensities.ambientDay,
      daylight,
    );
    ambient.intensity = instant
      ? ambientIntensity
      : THREE.MathUtils.damp(ambient.intensity, ambientIntensity, 0.6, delta);

    const fog = fogRef.current;
    if (fog) {
      fogForAltitude(altitude, tmpFog);
      fog.color.lerp(tmpFog, colorAlpha);
      const fogDensity = fogEnabled ? LIGHTING.fogDensity : 0;
      fog.density = instant
        ? fogDensity
        : THREE.MathUtils.damp(fog.density, fogDensity, 0.8, delta);
    }

    const background = backgroundRef.current;
    if (background) {
      backgroundForAltitude(altitude, tmpBackground);
      background.lerp(tmpBackground, colorAlpha);
    }

    firstFrame.current = false;
  });

  return (
    <>
      <color attach="background" ref={backgroundRef} args={[LIGHTING.colors.backgroundNight]} />
      <fogExp2 attach="fog" ref={fogRef} args={[LIGHTING.colors.fogNight, LIGHTING.fogDensity]} />
      <ambientLight
        ref={ambientRef}
        color={LIGHTING.colors.ambientDay}
        intensity={LIGHTING.intensities.ambientDay}
      />
      <hemisphereLight
        ref={hemiRef}
        color={LIGHTING.colors.skyDay}
        groundColor={LIGHTING.colors.groundDay}
        intensity={LIGHTING.intensities.hemisphereDay}
      />
      <directionalLight
        ref={sunRef}
        color={LIGHTING.colors.sunDay}
        intensity={LIGHTING.intensities.sunDay}
        position={[2000, 3000, 1500]}
        castShadow={shadowPassEnabled}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-left={-LIGHTING.shadow.cameraSize}
        shadow-camera-right={LIGHTING.shadow.cameraSize}
        shadow-camera-top={LIGHTING.shadow.cameraSize}
        shadow-camera-bottom={-LIGHTING.shadow.cameraSize}
        shadow-camera-near={LIGHTING.shadow.near}
        shadow-camera-far={LIGHTING.shadow.far}
        shadow-bias={LIGHTING.shadow.bias}
        shadow-normalBias={LIGHTING.shadow.normalBias}
      />
    </>
  );
}
