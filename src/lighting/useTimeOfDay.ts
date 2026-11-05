import { useEffect, useMemo, useState } from 'react';
import { LIGHTING } from '../data/scene-config';
import { dateAtTownHour, getTimeState, type TimeState } from '../lib/timeOfDay';
import { useStore } from '../store/useStore';

// Fuente única de tiempo para la escena y el HUD.
// - real: hora actual de Almenara, refresco cada minuto.
// - day / night: horas representativas elegidas.
// - manual: slider 0–24 h.
export function useTimeOfDay(): TimeState {
  const mode = useStore((s) => s.lightMode);
  const manualHour = useStore((s) => s.manualHour);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (mode !== 'real') return;
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [mode]);

  return useMemo(() => {
    if (mode === 'real') return getTimeState(now);
    const hour =
      mode === 'day' ? LIGHTING.dayHour : mode === 'night' ? LIGHTING.nightHour : manualHour;
    return getTimeState(dateAtTownHour(hour, now));
  }, [mode, manualHour, now]);
}
