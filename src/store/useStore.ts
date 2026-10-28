import { create } from 'zustand';

export type UiState = 'free' | 'selected';
export type LightMode = 'real' | 'day' | 'night';
export type QualityTier = 'low' | 'high';

interface AppState {
  uiState: UiState;
  selectedPoiId: string | null;
  routeIndex: number;
  language: string;
  lightMode: LightMode;
  qualityTier: QualityTier;
  openSignId: string | null;
  extras: Record<string, boolean>;
  selectPoi: (id: string) => void;
  closePoi: () => void;
  nextPoi: () => void;
  prevPoi: () => void;
  setLanguage: (lang: string) => void;
  setLightMode: (mode: LightMode) => void;
  setQualityTier: (tier: QualityTier) => void;
  openSign: (id: string) => void;
  closeSign: () => void;
  resetCamera: () => void;
  setExtra: (id: string, enabled: boolean) => void;
}

// Fase 1: esqueleto de estado. La lógica de ruta (wrap-around) y cámara
// se completa en Fases 4 (navegación robusta).
export const useStore = create<AppState>((set) => ({
  uiState: 'free',
  selectedPoiId: null,
  routeIndex: 0,
  language: 'es',
  lightMode: 'real',
  qualityTier: 'high',
  openSignId: null,
  extras: {},
  selectPoi: (id) => set({ selectedPoiId: id, uiState: 'selected' }),
  closePoi: () => set({ selectedPoiId: null, uiState: 'free' }),
  nextPoi: () => set((s) => ({ routeIndex: s.routeIndex + 1 })),
  prevPoi: () => set((s) => ({ routeIndex: s.routeIndex - 1 })),
  setLanguage: (language) => set({ language }),
  setLightMode: (lightMode) => set({ lightMode }),
  setQualityTier: (qualityTier) => set({ qualityTier }),
  openSign: (id) => set({ openSignId: id }),
  closeSign: () => set({ openSignId: null }),
  resetCamera: () => {},
  setExtra: (id, enabled) => set((s) => ({ extras: { ...s.extras, [id]: enabled } })),
}));
