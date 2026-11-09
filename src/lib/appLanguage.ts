export type AppLanguage = 'es' | 'en';

// El diorama arranca en inglés salvo que el idioma principal del navegador sea
// español. No usamos los idiomas secundarios: la preferencia debe ser la del
// navegador, no una alternativa configurada detrás del inglés.
export function detectAppLanguage(): AppLanguage {
  if (typeof navigator === 'undefined') return 'en';
  const primary = (navigator.language || '').toLowerCase();
  return primary.startsWith('es') ? 'es' : 'en';
}
