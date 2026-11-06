import { useTranslation } from 'react-i18next';
import { LIGHTING } from '../data/scene-config';
import { useTimeOfDay } from '../lighting/useTimeOfDay';
import { useStore, type CameraInfo } from '../store/useStore';
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

const fmtVec = (v: [number, number, number]) => v.map((n) => n.toFixed(1)).join(', ');

// Live readout of the camera-relative sharp band.
function DofStatus() {
  const { t } = useTranslation();
  const effects = useStore((s) => s.effects);
  const performanceMode = useStore((s) => s.performanceMode);
  const dofNear = useStore((s) => s.dofNear);
  const dofFar = useStore((s) => s.dofFar);
  const cameraDistance = useStore((s) => s.cameraInfo?.distance ?? null);

  const requested = effects.dof && !performanceMode;
  const autoDisabled =
    requested && cameraDistance !== null && cameraDistance > LIGHTING.dof.autoDisableDistance;
  const active = requested && !autoDisabled;

  return (
    <div className={`hud-dof-status${active ? ' active' : ''}`}>
      {autoDisabled
        ? `${t('hud.dofAutoOff')} · ${cameraDistance?.toFixed(0)} m`
        : active
        ? `${t('hud.dofActive')} · ${t('hud.dofBand')} ${dofNear}–${dofFar} m`
        : `${t('hud.dofOff')} · ${dofNear}–${dofFar} m`}
    </div>
  );
}

function copyCamera(info: CameraInfo) {
  const text = [
    `position: [${fmtVec(info.position)}]`,
    `target: [${fmtVec(info.target)}]`,
    `rotation: [${fmtVec(info.rotation)}]`,
    `distance: ${info.distance.toFixed(1)}`,
    `polar: ${info.polar.toFixed(1)}`,
    `azimuth: ${info.azimuth.toFixed(1)}`,
  ].join('\n');
  void navigator.clipboard?.writeText(text).catch(() => {});
}

function CameraPanel() {
  const { t } = useTranslation();
  const cameraInfo = useStore((s) => s.cameraInfo);

  return (
    <section className="hud-panel hud-camera">
      <div className="hud-label">{t('hud.camera')}</div>
      {cameraInfo ? (
        <>
          <div className="hud-mono">pos [{fmtVec(cameraInfo.position)}]</div>
          <div className="hud-mono">rot [{fmtVec(cameraInfo.rotation)}]°</div>
          <div className="hud-mono">tgt [{fmtVec(cameraInfo.target)}]</div>
          <div className="hud-mono">
            dist {cameraInfo.distance.toFixed(1)} m · polar {cameraInfo.polar.toFixed(1)}° · azim{' '}
            {cameraInfo.azimuth.toFixed(1)}°
          </div>
          <div className="hud-mono">
            {cameraInfo.terrainHeight === null
              ? t('hud.cameraNoTerrainData')
              : `${t(cameraInfo.terrainInside ? 'hud.ground' : 'hud.nearestTerrain')} ${cameraInfo.terrainHeight.toFixed(1)} m · ${t('hud.clearance')} ${cameraInfo.clearance?.toFixed(1)} m`}
          </div>
          <button type="button" onClick={() => copyCamera(cameraInfo)}>
            {t('hud.copy')}
          </button>
        </>
      ) : (
        <div className="hud-mono">…</div>
      )}
    </section>
  );
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
  const dofNear = useStore((s) => s.dofNear);
  const dofFar = useStore((s) => s.dofFar);
  const setDofNear = useStore((s) => s.setDofNear);
  const setDofFar = useStore((s) => s.setDofFar);
  const showDofGuide = useStore((s) => s.showDofGuide);
  const setShowDofGuide = useStore((s) => s.setShowDofGuide);
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
          <label className="hud-check">
            <input
              type="checkbox"
              checked={showDofGuide}
              onChange={(e) => setShowDofGuide(e.target.checked)}
            />
            {t('hud.dofGuide')}
          </label>
        </div>
        {effects.shadows && time.sunAltitude <= -0.02 ? (
          <div className="hud-dof-status">{t('hud.shadowsNight')}</div>
        ) : null}

        <div className="hud-dof-range">
          <label>
            {t('hud.dofNear')}
            <input
              type="number"
              min={20}
              max={7990}
              step={50}
              value={Math.round(dofNear)}
              onChange={(e) => setDofNear(Number(e.target.value))}
            />
          </label>
          <label>
            {t('hud.dofFar')}
            <input
              type="number"
              min={30}
              max={8000}
              step={50}
              value={Math.round(dofFar)}
              onChange={(e) => setDofFar(Number(e.target.value))}
            />
          </label>
        </div>
        <DofStatus />
        <div className="hud-dof-explanation">{t('hud.dofZoomHelp')}</div>
        <div className="hud-dof-explanation">{t('hud.dofGuideHelp')}</div>
      </section>

      <CameraPanel />
    </div>
  );
}
