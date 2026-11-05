import { useTranslation } from 'react-i18next';
import { LIGHTING } from '../data/scene-config';
import { useTimeOfDay } from '../lighting/useTimeOfDay';
import { useStore } from '../store/useStore';
import './overlay.css';

const MODES = [
  { id: 'real', label: 'hud.real' },
  { id: 'day', label: 'hud.day' },
  { id: 'night', label: 'hud.night' },
] as const;

const EFFECTS = [
  { id: 'dof', label: 'hud.dof' },
  { id: 'bloom', label: 'hud.bloom' },
  { id: 'vignette', label: 'hud.vignette' },
  { id: 'fog', label: 'hud.fog' },
  { id: 'shadows', label: 'hud.shadows' },
] as const;

function formatHour(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.round((hour - Math.floor(hour)) * 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function Overlay() {
  const { t, i18n } = useTranslation();
  const language = useStore((s) => s.language);
  const setLanguage = useStore((s) => s.setLanguage);
  const lightMode = useStore((s) => s.lightMode);
  const setLightMode = useStore((s) => s.setLightMode);
  const manualHour = useStore((s) => s.manualHour);
  const setManualHour = useStore((s) => s.setManualHour);
  const effects = useStore((s) => s.effects);
  const setEffect = useStore((s) => s.setEffect);
  const performanceMode = useStore((s) => s.performanceMode);
  const setPerformanceMode = useStore((s) => s.setPerformanceMode);
  const time = useTimeOfDay();

  const sliderHour =
    lightMode === 'day'
      ? LIGHTING.dayHour
      : lightMode === 'night'
        ? LIGHTING.nightHour
        : lightMode === 'manual'
          ? manualHour
          : time.townHour;

  return (
    <div className="hud">
      <section className="hud-panel hud-title">
        <h1>{t('app.title')}</h1>
        <p>{t('app.subtitle')}</p>
        <div className="hud-row" style={{ marginTop: 10 }}>
          {(['es', 'en'] as const).map((lng) => (
            <button
              key={lng}
              type="button"
              className={language === lng ? 'active' : ''}
              onClick={() => {
                setLanguage(lng);
                void i18n.changeLanguage(lng);
              }}
            >
              {lng.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      <section className="hud-panel hud-controls">
        <div className="hud-label">
          {t('hud.townTime')}: <strong>{time.townTime}</strong>
        </div>

        <div className="hud-row">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={lightMode === mode.id ? 'active' : ''}
              onClick={() => setLightMode(mode.id)}
            >
              {t(mode.label)}
            </button>
          ))}
        </div>

        <label className="hud-slider">
          <span>
            {t('hud.time')}: {formatHour(sliderHour)}
          </span>
          <input
            type="range"
            min={0}
            max={24}
            step={0.25}
            value={sliderHour}
            onChange={(e) => setManualHour(Number(e.target.value))}
          />
        </label>

        <div className="hud-label">{t('hud.effects')}</div>
        <div className="hud-grid">
          {EFFECTS.map((effect) => (
            <label key={effect.id} className="hud-check">
              <input
                type="checkbox"
                checked={effects[effect.id]}
                onChange={(e) => setEffect(effect.id, e.target.checked)}
              />
              {t(effect.label)}
            </label>
          ))}
          <label className="hud-check">
            <input
              type="checkbox"
              checked={performanceMode}
              onChange={(e) => setPerformanceMode(e.target.checked)}
            />
            {t('hud.performance')}
          </label>
        </div>
      </section>
    </div>
  );
}
