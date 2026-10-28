import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';

// Fase 1: HUD mínimo para validar i18n y store. Crece en Fases 4–6.
export default function Overlay() {
  const { t, i18n } = useTranslation();
  const language = useStore((s) => s.language);
  const setLanguage = useStore((s) => s.setLanguage);

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.85)',
        borderRadius: 8,
        color: '#1B2A4A',
        fontSize: 14,
      }}
    >
      <h1 style={{ fontSize: 16, margin: 0 }}>{t('app.title')}</h1>
      <p style={{ margin: '4px 0 0', opacity: 0.7 }}>{t('app.subtitle')}</p>
      <div style={{ marginTop: 10 }}>
        {(['es', 'en'] as const).map((lng) => (
          <button
            key={lng}
            type="button"
            onClick={() => {
              setLanguage(lng);
              void i18n.changeLanguage(lng);
            }}
            style={{
              marginRight: 6,
              padding: '4px 10px',
              cursor: 'pointer',
              fontWeight: language === lng ? 700 : 400,
            }}
          >
            {lng.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
