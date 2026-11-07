import { getMoonPosition, getPosition, getTimes } from 'suncalc';
import * as THREE from 'three';
import { TOWN } from '../data/scene-config';

// Hora y posición solar/lunar para Almenara. La hora mostrada es SIEMPRE la del
// pueblo (Europe/Madrid), independientemente de la zona horaria del visitante.
export interface TimeState {
  date: Date;
  townTime: string; // HH:MM
  townHour: number; // 0–24, con decimales
  sunAltitude: number; // radianes
  sunAzimuth: number; // radianes (0 = sur, positivo hacia el oeste)
  moonAltitude: number;
  moonAzimuth: number;
  nightFactor: number; // 0 = día, 1 = noche
  duskHour: number; // anochecer civil, hora local decimal
  dawnHour: number; // amanecer civil, hora local decimal
}

const TOWN_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const TOWN_CLOCK = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function getTownParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = TOWN_PARTS.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

export function formatTownTime(date: Date): string {
  return TOWN_CLOCK.format(date);
}

function decimalTownHour(date: Date | null | undefined, fallback: number): number {
  if (!date || Number.isNaN(date.getTime())) return fallback;
  const parts = getTownParts(date);
  return parts.hour + parts.minute / 60 + parts.second / 3600;
}

// Construye un Date que, visto en Europe/Madrid, cae a la hora indicada del día
// actual del pueblo. El offset se toma del día actual (suficiente para el diorama).
export function dateAtTownHour(hour: number, base = new Date()): Date {
  const p = getTownParts(base);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const offset = asUTC - base.getTime();
  const h = Math.floor(hour) % 24;
  const m = Math.round((hour - Math.floor(hour)) * 60);
  return new Date(Date.UTC(p.year, p.month - 1, p.day, h, m, 0) - offset);
}

export function getTimeState(date: Date): TimeState {
  const sun = getPosition(date, TOWN.lat, TOWN.lon);
  const moon = getMoonPosition(date, TOWN.lat, TOWN.lon);
  const times = getTimes(date, TOWN.lat, TOWN.lon);
  const p = getTownParts(date);
  // SunCalc 2.x devuelve grados; el resto del código trabaja en radianes.
  const sunAltitude = (sun.altitude * Math.PI) / 180;
  const sunAzimuth = (sun.azimuth * Math.PI) / 180;
  return {
    date,
    townTime: formatTownTime(date),
    townHour: p.hour + p.minute / 60 + p.second / 3600,
    sunAltitude,
    sunAzimuth,
    moonAltitude: (moon.altitude * Math.PI) / 180,
    moonAzimuth: (moon.azimuth * Math.PI) / 180,
    // 0 con sol alto, 1 con sol por debajo de ~-7°; transición suave en el crepúsculo.
    nightFactor: 1 - smoothstep(-0.12, 0.08, sunAltitude),
    duskHour: decimalTownHour(times.dusk, 18.5),
    dawnHour: decimalTownHour(times.dawn, 6.5),
  };
}

// Dirección desde el observador hacia el sol/luna en coordenadas locales:
// X = este, Y = arriba, Z = sur. SunCalc 2.x mide azimuth en grados, horario
// desde el norte; aquí recibe radianes ya convertidos por getTimeState().
export function directionFromAltAz(altitude: number, azimuth: number): THREE.Vector3 {
  const cosAlt = Math.cos(altitude);
  return new THREE.Vector3(
    Math.sin(azimuth) * cosAlt,
    Math.sin(altitude),
    -Math.cos(azimuth) * cosAlt,
  );
}
