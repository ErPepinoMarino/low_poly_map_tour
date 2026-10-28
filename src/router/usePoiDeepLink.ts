import { useEffect } from 'react';
import { useStore } from '../store/useStore';

// Fase 1: stub de deep-linking. Se completa en Fase 4:
// - selectPoi/next/prev → history.replaceState('?poi=<id>')
// - closePoi → limpiar ?poi
// - al cargar → leer ?poi y volar al POI.
export function usePoiDeepLink() {
  const selectPoi = useStore((s) => s.selectPoi);

  useEffect(() => {
    const poi = new URLSearchParams(window.location.search).get('poi');
    if (poi) selectPoi(poi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
