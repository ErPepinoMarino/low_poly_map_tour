import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getPoi, POIS } from '../data/pois';
import { useStore } from '../store/useStore';

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="poi-chevron">
      <path d={direction === 'left' ? 'M15 5 8 12l7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="poi-book-icon">
      <path d="M4 4.8c2.5-.8 5.3-.4 8 1.2 2.7-1.6 5.5-2 8-1.2v14.4c-2.5-.8-5.3-.4-8 1.2-2.7-1.6-5.5-2-8-1.2V4.8Z" />
      <path d="M12 6v14.4" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="poi-center-icon">
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}

export default function PoiPanel() {
  const { t } = useTranslation();
  const language = useStore((state) => state.language);
  const selectedPoiId = useStore((state) => state.selectedPoiId);
  const panelOpen = useStore((state) => state.poiPanelOpen);
  const openPoiPanel = useStore((state) => state.openPoiPanel);
  const closePoiPanel = useStore((state) => state.closePoiPanel);
  const navigateToPoi = useStore((state) => state.navigateToPoi);
  const nextPoi = useStore((state) => state.nextPoi);
  const prevPoi = useStore((state) => state.prevPoi);

  const poi = getPoi(selectedPoiId) ?? POIS[0];
  const index = poi ? POIS.findIndex((item) => item.id === poi.id) : 0;
  const [failedPhotoId, setFailedPhotoId] = useState<string | null>(null);
  const isEnglish = language === 'en';
  const photoFailed = failedPhotoId === poi?.id;
  const description = poi ? (isEnglish ? poi.description.en : poi.description.es) : '';

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT';

      if (event.key === 'Escape' && panelOpen) {
        closePoiPanel();
        return;
      }
      if (!panelOpen || typing) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prevPoi();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextPoi();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [panelOpen, closePoiPanel, prevPoi, nextPoi]);

  const photoUrl = poi ? `${import.meta.env.BASE_URL}${poi.photo}` : '';

  return (
    <>
      <button
        type="button"
        className={`poi-tab${panelOpen ? ' open' : ''}`}
        aria-expanded={panelOpen}
        aria-label={t(panelOpen ? 'poi.hidePanel' : 'poi.showPanel')}
        title={t(panelOpen ? 'poi.hidePanel' : 'poi.showPanel')}
        onClick={() => (panelOpen ? closePoiPanel() : openPoiPanel())}
      >
        <Chevron direction={panelOpen ? 'right' : 'left'} />
        <BookIcon />
      </button>

      <aside
        className={`poi-panel${panelOpen ? ' open' : ''}`}
        aria-label={t('poi.panel')}
        aria-hidden={!panelOpen}
      >
        {poi ? (
          <>
            <div className="poi-photo-frame">
              {photoFailed ? (
                <div className="poi-photo-fallback">
                  <span>{t('poi.photoPending')}</span>
                </div>
              ) : (
                <img
                  className="poi-photo"
                  src={photoUrl}
                  alt={t('poi.photoAlt', { name: isEnglish ? poi.nameEn : poi.name })}
                  onError={() => setFailedPhotoId(poi.id)}
                />
              )}
            </div>

            <div className="poi-panel-body">
              <div className="poi-kind">
                {t(poi.tipo === 'edificio' ? 'poi.building' : 'poi.place')}
              </div>
              <h2>{isEnglish ? poi.nameEn : poi.name}</h2>
              {description ? <p>{description}</p> : null}

              <button
                type="button"
                className="poi-center"
                onClick={() => navigateToPoi(poi.id, 'panel')}
              >
                <TargetIcon />
                <span>{t('poi.center')}</span>
              </button>

              <div className="poi-nav">
                <button
                  type="button"
                  onClick={prevPoi}
                  aria-label={t('poi.prev')}
                  title={t('poi.prev')}
                >
                  <Chevron direction="left" />
                </button>
                <span>
                  {index + 1} / {POIS.length}
                </span>
                <button
                  type="button"
                  onClick={nextPoi}
                  aria-label={t('poi.next')}
                  title={t('poi.next')}
                >
                  <Chevron direction="right" />
                </button>
              </div>
            </div>
          </>
        ) : null}
      </aside>
    </>
  );
}
