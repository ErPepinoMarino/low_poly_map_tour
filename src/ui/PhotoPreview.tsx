import { useEffect, useState, type CSSProperties } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import './photo.css';

function downloadPhoto(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className="photo-share-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
    </svg>
  );
}

export default function PhotoPreview() {
  const { t } = useTranslation();
  const photo = useStore((state) => state.photo);
  const clearPhoto = useStore((state) => state.clearPhoto);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 1200 : window.innerWidth,
    height: typeof window === 'undefined' ? 800 : window.innerHeight,
  }));

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!photo) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearPhoto();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [clearPhoto, photo]);

  if (!photo) return null;

  const aspect = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1.5;
  const horizontalPadding = viewport.width <= 600 ? 20 : 40;
  const cardChromeHeight = viewport.width <= 600 ? 190 : 180;
  const availableWidth = Math.max(0, viewport.width - horizontalPadding);
  const availableHeight = Math.max(0, viewport.height - cardChromeHeight);
  const cardWidth = Math.max(
    180,
    Math.min(photo.width, availableWidth, availableHeight * aspect),
  );
  const cardStyle = { width: `${cardWidth}px` } as CSSProperties;

  const share = async () => {
    const file = new File([photo.blob], photo.fileName, { type: 'image/png' });
    if (
      typeof navigator.share === 'function' &&
      navigator.canShare?.({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: t('photo.shareTitle'),
          text: t('photo.shareText'),
        });
        return;
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') return;
      }
    }
    downloadPhoto(photo.blob, photo.fileName);
  };

  return (
    <div className="photo-overlay" role="dialog" aria-modal="true" aria-label={t('photo.titleAria')}>
      <div className="photo-card" style={cardStyle}>
        <div className="photo-card-header">
          <div className="photo-card-title">
            <Trans i18nKey="photo.title" components={{ strong: <strong /> }} />
          </div>
          <button
            type="button"
            className="photo-close"
            aria-label={t('photo.close')}
            title={t('photo.close')}
            onClick={clearPhoto}
          >
            <CloseIcon />
          </button>
        </div>
        <img className="photo-image" src={photo.url} alt={t('photo.alt')} />
        <div className="photo-actions">
          <button type="button" className="photo-button photo-button-primary" onClick={share}>
            <ShareIcon />
            <span>{t('photo.share')}</span>
          </button>
          <button
            type="button"
            className="photo-button"
            onClick={() => downloadPhoto(photo.blob, photo.fileName)}
          >
            {t('photo.download')}
          </button>
        </div>
      </div>
    </div>
  );
}
