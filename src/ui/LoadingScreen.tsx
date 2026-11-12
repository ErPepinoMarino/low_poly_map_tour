import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import './loading.css';

const LOGO_URL = `${import.meta.env.BASE_URL}textures/logoAlmenaraSvg.svg`;
const MIN_VISIBLE_MS = 800;
const HOLD_AFTER_READY_MS = 250;
const FADE_OUT_MS = 350;

interface LoadingScreenProps {
  progress: number;
  ready: boolean;
}

export default function LoadingScreen({ progress, ready }: LoadingScreenProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [now, setNow] = useState(() => performance.now());
  const [shownAt] = useState(() => performance.now());

  useEffect(() => {
    if (!visible || fading) return;
    const timer = window.setInterval(() => setNow(performance.now()), 50);
    return () => window.clearInterval(timer);
  }, [visible, fading]);

  useEffect(() => {
    if (!visible || !ready) return;
    const start = shownAt ?? performance.now();
    const delay =
      Math.max(0, MIN_VISIBLE_MS - (performance.now() - start)) +
      HOLD_AFTER_READY_MS;
    const timer = window.setTimeout(() => setFading(true), delay);
    return () => window.clearTimeout(timer);
  }, [ready, shownAt, visible]);

  useEffect(() => {
    if (!fading) return;
    const timer = window.setTimeout(() => setVisible(false), FADE_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [fading]);

  if (!visible) return null;

  const elapsed = Math.max(0, now - shownAt);
  const completion = Math.min(1, elapsed / MIN_VISIBLE_MS);
  const realProgress = Math.max(0, Math.min(1, progress / 100));
  // La carga real puede llegar por bloques; este mínimo visual evita que la
  // silueta se quede congelada mientras el navegador termina los assets.
  const displayedProgress = ready
    ? completion
    : Math.max(realProgress, completion * 0.9);
  const progressPercent = Math.round(displayedProgress * 100);

  const logoStyle = {
    '--loading-logo': `url("${LOGO_URL}")`,
    '--loading-progress': `${progressPercent}%`,
  } as CSSProperties;

  return (
    <div
      className={`loading-screen${fading ? ' fading' : ''}`}
      role="progressbar"
      aria-label={t('loading.label')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progressPercent}
      style={logoStyle}
    >
      <div className="loading-mark-wrap">
        <div className="loading-mark" aria-hidden="true">
          <div className="loading-mark-fill" />
        </div>
      </div>
    </div>
  );
}
