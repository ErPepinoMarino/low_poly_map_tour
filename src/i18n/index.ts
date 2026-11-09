import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { detectAppLanguage } from '../lib/appLanguage';
import es from './locales/es.json';
import en from './locales/en.json';

// Fase 1: scaffolding de i18n (ES/EN). El contenido de POIs/destinos
// se añade en Fases 4/5. Añadir idioma = añadir JSON y registrarlo aquí.
void i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: detectAppLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
