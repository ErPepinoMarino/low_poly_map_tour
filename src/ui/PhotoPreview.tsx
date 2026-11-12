import { useEffect } from 'react';
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

export default function PhotoPreview() {
  const { t } = useTranslation();
  const photo = useStore((state) => state.photo);
  const clearPhoto = useStore((state) => state.clearPhoto);

  useEffect(() => {
    if (!photo) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearPhoto();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [clearPhoto, photo]);

  if (!photo) return null;

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
      <div className="photo-card">
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
            {t('photo.share')}
          </button>
          <button
            type="button"
            className="photo-button"
            onClick={() => downloadPhoto(photo.blob, photo.fileName)}
          >
            {t('photo.download')}
          </button>
          <button type="button" className="photo-button photo-button-muted" onClick={clearPhoto}>
            {t('photo.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
