import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LIGHTING, PALETTE } from '../data/scene-config';
import { useTimeOfDay } from '../lighting/useTimeOfDay';
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
  fogDay: new THREE.Color(LIGHTING.colors.fogDay),
  fogNight: new THREE.Color(LIGHTING.colors.fogNight),
  backgroundDay: new THREE.Color(LIGHTING.colors.backgroundDay),
  backgroundNight: new THREE.Color(LIGHTING.colors.backgroundNight),
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

// Sol/luna, hemisférica, ambiente, niebla y fondo sincronizados con la hora.
export default function SunMoon() {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const backgroundRef = useRef<THREE.Color>(null);
  const fogRef = useRef<THREE.FogExp2>(null);
  const firstFrame = useRef(true);
  const time = useTimeOfDay();
  const fogEnabled = useStore((s) => s.effects.fog);

  useFrame((_, delta) => {
    const sun = sunRef.current;
    const hemi = hemiRef.current;
    const ambient = ambientRef.current;
    if (!sun || !hemi || !ambient) return;

    const instant = firstFrame.current;
    const daylight = 1 - time.nightFactor;
    const altitude = time.sunAltitude;
    const isNight = altitude < -0.02;

    // Dirección: sol de día, luna de noche. Mantenemos la luz por encima del horizonte.
    const dir = isNight
      ? directionFromAltAz(time.moonAltitude, time.moonAzimuth)
      : directionFromAltAz(time.sunAltitude, time.sunAzimuth);
    const dirY = Math.max(0.16, dir.y);
    tmpSunPos.set(dir.x, dirY, dir.z).normalize().multiplyScalar(3200);
    sun.position.lerp(tmpSunPos, instant ? 1 : 1 - Math.exp(-delta * 1.8));

    // Color e intensidad: blanco cálido al mediodía, naranja al horizonte, luna fría de noche.
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
      tmpFog.copy(C.fogNight).lerp(C.fogDay, daylight);
      fog.color.lerp(tmpFog, colorAlpha);
      const fogDensity = fogEnabled ? LIGHTING.fogDensity : 0;
      fog.density = instant
        ? fogDensity
        : THREE.MathUtils.damp(fog.density, fogDensity, 0.8, delta);
    }

    const background = backgroundRef.current;
    if (background) {
      tmpBackground.copy(C.backgroundNight).lerp(C.backgroundDay, daylight);
      background.lerp(tmpBackground, colorAlpha);
    }

    firstFrame.current = false;
  });

  return (
    <>
      <color attach="background" ref={backgroundRef} args={[PALETTE.background]} />
      <fogExp2
        attach="fog"
        ref={fogRef}
        args={[LIGHTING.colors.fogNight, LIGHTING.fogDensity]}
      />
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
      />
    </>
  );
}
