import { useEffect, useMemo, useRef, useState } from 'react';
import { LIGHTING } from '../data/scene-config';
import { dateAtTownHour, getTimeState, getTownParts, type TimeState } from '../lib/timeOfDay';
import { useStore } from '../store/useStore';

function townHour(date: Date): number {
  const p = getTownParts(date);
  return p.hour + p.minute / 60 + p.second / 3600;
}

// Fuente única de tiempo para la escena y el HUD.
// - real: hora actual de Almenara, refresco cada minuto.
// - day / night: transición animada de ~2,6 s para que el sol y las sombras se muevan.
// - manual: slider 0–24 h, sin animación (el propio slider marca el ritmo).
export function useTimeOfDay(): TimeState {
  const mode = useStore((s) => s.lightMode);
  const manualHour = useStore((s) => s.manualHour);
  const [now, setNow] = useState(() => new Date());
  const [displayHour, setDisplayHour] = useState(() => townHour(new Date()));
  const displayHourRef = useRef(displayHour);

  useEffect(() => {
    displayHourRef.current = displayHour;
  }, [displayHour]);

  // Modo real: reloj del pueblo cada minuto.
  useEffect(() => {
    if (mode !== 'real') return;
    const tick = () => {
      const d = new Date();
      const h = townHour(d);
      setNow(d);
      setDisplayHour(h);
      displayHourRef.current = h;
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [mode]);

  // Día/Noche: animar la hora para que el sol recorra el cielo y las sombras giren.
  useEffect(() => {
    if (mode === 'real') return;

    if (mode === 'manual') {
      displayHourRef.current = manualHour;
      return;
    }

    const target = mode === 'day' ? LIGHTING.dayHour : LIGHTING.nightHour;
    const start = displayHourRef.current;
    const duration = 2600;
    const t0 = performance.now();
    let raf = 0;

    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const eased = k * k * (3 - 2 * k);
      const h = start + (target - start) * eased;
      setDisplayHour(h);
      displayHourRef.current = h;
      if (k < 1) raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [mode, manualHour]);

  const effectiveHour = mode === 'manual' ? manualHour : displayHour;
  const date = useMemo(
    () => (mode === 'real' ? now : dateAtTownHour(effectiveHour, now)),
    [mode, now, effectiveHour],
  );

  return useMemo(() => getTimeState(date), [date]);
}
