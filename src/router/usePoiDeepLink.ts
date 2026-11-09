import { useEffect } from 'react';
import { POI_BY_ID } from '../data/pois';
import { useStore } from '../store/useStore';

// Mantiene `?poi=<id>` sincronizado con la ficha abierta. El estado del store
// sigue siendo la única fuente de verdad; la URL es una proyección de él.
export function usePoiDeepLink() {
  const selectedPoiId = useStore((s) => s.selectedPoiId);
  const panelOpen = useStore((s) => s.poiPanelOpen);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get('poi');
    if (query && POI_BY_ID.has(query)) {
      useStore.getState().selectPoi(query);
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedPoiId && panelOpen && POI_BY_ID.has(selectedPoiId)) {
      url.searchParams.set('poi', selectedPoiId);
    } else {
      url.searchParams.delete('poi');
    }
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [selectedPoiId, panelOpen]);
}
