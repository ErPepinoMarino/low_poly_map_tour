import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LIGHTING } from '../data/scene-config';
import { useTimeOfDay } from '../lighting/useTimeOfDay';
import { useStore, type EffectId } from '../store/useStore';
import './overlay.css';

const OPTIONS: Array<{ id: EffectId; label: string }> = [
  { id: 'dof', label: 'hud.dof' },
  { id: 'bloom', label: 'hud.bloom' },
  { id: 'vignette', label: 'hud.vignette' },
  { id: 'fog', label: 'hud.fog' },
  { id: 'shadows', label: 'hud.shadows' },
  { id: 'smaa', label: 'hud.smaa' },
];

function formatClock(hour: number, language: string): string {
  const totalMinutes = Math.round(hour * 60) % (24 * 60);
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const hour12 = hour24 % 12 || 12;
  const suffix = language === 'en' ? (hour24 < 12 ? 'AM' : 'PM') : hour24 < 12 ? 'am' : 'pm';
  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function formatTownDate(date: Date, language: string): string {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

const formatVector = (vector: [number, number, number]) =>
  vector.map((value) => value.toFixed(1)).join(', ');

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.2 15.1A8.4 8.4 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z" />
    </svg>
  );
}

function TimePanel() {
  const { t, i18n } = useTranslation();
  const language = useStore((state) => state.language);
  const setLanguage = useStore((state) => state.setLanguage);
  const lightMode = useStore((state) => state.lightMode);
  const setLightMode = useStore((state) => state.setLightMode);
  const resetCamera = useStore((state) => state.resetCamera);
  const manualHour = useStore((state) => state.manualHour);
  const setManualHour = useStore((state) => state.setManualHour);
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
    <section className="hud-panel hud-clock" aria-label={t('hud.timePanel')}>
      <div className="clock-town">Almenara</div>
      <div className="clock-time">{formatClock(time.townHour, i18n.language)}</div>
      <div className="clock-date">{formatTownDate(time.date, i18n.language)}</div>

      <div className="clock-modes">
        <button
          className={`clock-icon-button${lightMode === 'day' ? ' selected' : ''}`}
          type="button"
          title={t('hud.day')}
          aria-label={t('hud.day')}
          aria-pressed={lightMode === 'day'}
          onClick={() => setLightMode('day')}
        >
          <SunIcon />
        </button>
        <button
          className={`clock-now-button${lightMode === 'real' ? ' selected' : ''}`}
          type="button"
          aria-pressed={lightMode === 'real'}
          onClick={() => setLightMode('real')}
        >
          {t('hud.now')}
        </button>
        <button
          className={`clock-icon-button${lightMode === 'night' ? ' selected' : ''}`}
          type="button"
          title={t('hud.night')}
          aria-label={t('hud.night')}
          aria-pressed={lightMode === 'night'}
          onClick={() => setLightMode('night')}
        >
          <MoonIcon />
        </button>
      </div>

      <label className="hud-slider">
        <span>
          <span>{t('hud.simulateTime')}</span>
          <strong>{formatClock(sliderHour, i18n.language)}</strong>
        </span>
        <input
          type="range"
          min={0}
          max={24}
          step={0.25}
          value={sliderHour}
          onChange={(event) => setManualHour(Number(event.target.value))}
        />
      </label>
      <button className="clock-center-view" type="button" onClick={resetCamera}>
        {t('hud.centerView')}
      </button>
      <nav className="language-switch clock-language-switch" aria-label={t('hud.language')}>
        {(['en', 'es'] as const).map((lng, index) => (
          <span className="language-item" key={lng}>
            {index > 0 ? <span className="language-divider">|</span> : null}
            <button
              type="button"
              className={language === lng ? 'selected' : ''}
              aria-pressed={language === lng}
              onClick={() => {
                setLanguage(lng);
                void i18n.changeLanguage(lng);
              }}
            >
              {lng.toUpperCase()}
            </button>
          </span>
        ))}
      </nav>
    </section>
  );
}

export default function Overlay() {
  const { t } = useTranslation();
  const effects = useStore((state) => state.effects);
  const setEffect = useStore((state) => state.setEffect);
  const performanceMode = useStore((state) => state.performanceMode);
  const setPerformanceMode = useStore((state) => state.setPerformanceMode);
  const [infoOpen, setInfoOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  // Los menús solo se cierran con su interruptor o con Escape. No se cierran
  // al orbitar/panear ni al hacer clic fuera: así se puede leer la telemetría
  // en tiempo real mientras se mueve la cámara.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setInfoOpen(false);
        setOptionsOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="hud">
      <div className="hud-clock-corner">
        <TimePanel />
      </div>

      <div className="hud-top-right">
        <button
          type="button"
          className={`hud-menu-button${infoOpen ? ' open' : ''}`}
          aria-expanded={infoOpen}
          onClick={() => {
            setInfoOpen((open) => !open);
            setOptionsOpen(false);
          }}
        >
          <span>{t('hud.nerdInfo')}</span>
          <span className={`menu-switch${infoOpen ? ' on' : ''}`} aria-hidden="true">
            <i />
          </span>
        </button>
        {infoOpen ? <NerdInfoPanel /> : null}
      </div>

      <div className="hud-options">
        {optionsOpen ? (
          <section className="hud-menu-panel options-panel">
            <div className="hud-menu-heading">
              <h2>{t('hud.options')}</h2>
            </div>
            <div className="options-list">
              {OPTIONS.map((option) => (
                <label className="hud-check" key={option.id}>
                  <input
                    type="checkbox"
                    checked={effects[option.id]}
                    onChange={(event) => setEffect(option.id, event.target.checked)}
                  />
                  {t(option.label)}
                </label>
              ))}
              <label className="hud-check">
                <input
                  type="checkbox"
                  checked={performanceMode}
                  onChange={(event) => setPerformanceMode(event.target.checked)}
                />
                {t('hud.performance')}
              </label>
            </div>
          </section>
        ) : null}
        <button
          type="button"
          className={`hud-menu-button${optionsOpen ? ' open' : ''}`}
          aria-expanded={optionsOpen}
          onClick={() => {
            setOptionsOpen((open) => !open);
            setInfoOpen(false);
          }}
        >
          <OptionsIcon />
          <span>{t('hud.options')}</span>
          <span className={`menu-switch${optionsOpen ? ' on' : ''}`} aria-hidden="true">
            <i />
          </span>
        </button>
      </div>
    </div>
  );
}

function NerdInfoPanel() {
  const { t, i18n } = useTranslation();
  const cameraInfo = useStore((state) => state.cameraInfo);
  const stats = useStore((state) => state.sceneStats);
  const effects = useStore((state) => state.effects);
  const dofNear = useStore((state) => state.dofNear);
  const dofFar = useStore((state) => state.dofFar);
  const showDofGuide = useStore((state) => state.showDofGuide);
  const setShowDofGuide = useStore((state) => state.setShowDofGuide);
  const showCameraGizmo = useStore((state) => state.showCameraGizmo);
  const setShowCameraGizmo = useStore((state) => state.setShowCameraGizmo);
  const performanceMode = useStore((state) => state.performanceMode);
  const dofRequested = effects.dof && !performanceMode;
  const autoDisabled =
    dofRequested &&
    cameraInfo !== null &&
    cameraInfo.centerDistance > LIGHTING.dof.autoDisableDistance;
  const dofActive = dofRequested && cameraInfo !== null && !autoDisabled;
  const formatNumber = (value: number) => value.toLocaleString(i18n.language);

  return (
    <section className="hud-menu-panel nerd-panel" aria-label={t('hud.nerdInfo')}>
      <div className="hud-menu-heading">
        <h2>{t('hud.nerdInfo')}</h2>
      </div>

      <div className="nerd-section">
        <div className="nerd-section-title">{t('hud.camera')}</div>
        {cameraInfo ? (
          <>
            <div className="hud-mono">pos [{formatVector(cameraInfo.position)}]</div>
            <div className="hud-mono">rot [{formatVector(cameraInfo.rotation)}]°</div>
            <div className="hud-mono">target [{formatVector(cameraInfo.target)}]</div>
            <div className="hud-mono">
              {t('hud.distance')} {cameraInfo.distance.toFixed(1)} m · polar{' '}
              {cameraInfo.polar.toFixed(1)}° · azim {cameraInfo.azimuth.toFixed(1)}°
            </div>
            <div className="hud-mono">
              {t('hud.centerDistance')} {cameraInfo.centerDistance.toFixed(1)} m ·{' '}
              {t('hud.clearance')} {cameraInfo.clearance?.toFixed(1) ?? '—'} m
            </div>
            <div className="hud-mono">
              {cameraInfo.terrainHeight === null
                ? t('hud.cameraNoTerrainData')
                : `${t(cameraInfo.terrainInside ? 'hud.ground' : 'hud.nearestTerrain')} ${cameraInfo.terrainHeight.toFixed(1)} m`}
            </div>
            <label className="hud-check nerd-guide-toggle">
              <input
                type="checkbox"
                checked={showCameraGizmo}
                onChange={(event) => setShowCameraGizmo(event.target.checked)}
              />
              {t('hud.cameraGizmo')}
            </label>
          </>
        ) : (
          <div className="hud-mono">…</div>
        )}
      </div>

      <div className="nerd-section">
        <div className="nerd-section-title">{t('hud.dof')}</div>
        <div className="hud-mono">
          {autoDisabled
            ? `${t('hud.dofAutoOff')} · ${t('hud.centerDistance')} ${cameraInfo?.centerDistance.toFixed(0)} m`
            : dofActive
              ? `${t('hud.dofActive')} · ${t('hud.dofBand')} ${dofNear}–${dofFar} m`
              : t('hud.dofOff')}
        </div>
        <div className="hud-mono">
          {t('hud.dofAutoLimit')}: {LIGHTING.dof.autoDisableDistance.toLocaleString(i18n.language)}{' '}
          m · {t('hud.dofFarBlur')}: ×{LIGHTING.dof.farBlurMultiplier.toFixed(1)}
        </div>
        <label className="hud-check nerd-guide-toggle">
          <input
            type="checkbox"
            checked={showDofGuide}
            onChange={(event) => setShowDofGuide(event.target.checked)}
          />
          {t('hud.dofGuide')}
        </label>
      </div>

      <div className="nerd-section">
        <div className="nerd-section-title">{t('hud.sceneStats')}</div>
        {stats ? (
          <div className="nerd-stats-grid">
            <span>{t('hud.triangles')}</span>
            <strong>{formatNumber(stats.triangles)}</strong>
            <span>{t('hud.drawCalls')}</span>
            <strong>~{formatNumber(stats.drawCalls)}</strong>
            <span>{t('hud.meshes')}</span>
            <strong>{formatNumber(stats.meshes)}</strong>
            <span>{t('hud.materials')}</span>
            <strong>{formatNumber(stats.materials)}</strong>
            <span>{t('hud.textures')}</span>
            <strong>{formatNumber(stats.textures)}</strong>
          </div>
        ) : (
          <div className="hud-mono">{t('hud.measuring')}</div>
        )}
      </div>
    </section>
  );
}

function OptionsIcon() {
  return (
    <svg className="options-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="17" r="2" />
    </svg>
  );
}
