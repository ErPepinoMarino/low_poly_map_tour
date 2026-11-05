import { create } from 'zustand';
import { LIGHTING } from '../data/scene-config';

export type UiState = 'free' | 'selected';
export type LightMode = 'real' | 'day' | 'night' | 'manual';
export type QualityTier = 'low' | 'high';
export type EffectId = 'dof' | 'bloom' | 'vignette' | 'fog' | 'smaa' | 'shadows';

export interface CameraInfo {
  position: [number, number, number];
  rotation: [number, number, number];
  target: [number, number, number];
  distance: number;
  polar: number;
  azimuth: number;
}

const isMobile =
  typeof window !== 'undefined' &&
  (window.matchMedia('(max-width: 768px)').matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));

interface AppState {
  uiState: UiState;
  selectedPoiId: string | null;
  routeIndex: number;
  language: string;
  lightMode: LightMode;
  manualHour: number;
  effects: Record<EffectId, boolean>;
  dofNear: number;
  dofFar: number;
  cameraInfo: CameraInfo | null;
  performanceMode: boolean;
  qualityTier: QualityTier;
  openSignId: string | null;
  extras: Record<string, boolean>;
  selectPoi: (id: string) => void;
  closePoi: () => void;
  nextPoi: () => void;
  prevPoi: () => void;
  setLanguage: (lang: string) => void;
  setLightMode: (mode: LightMode) => void;
  setManualHour: (hour: number) => void;
  setEffect: (id: EffectId, enabled: boolean) => void;
  setDofNear: (value: number) => void;
  setDofFar: (value: number) => void;
  setCameraInfo: (info: CameraInfo) => void;
  setPerformanceMode: (enabled: boolean) => void;
  setQualityTier: (tier: QualityTier) => void;
  openSign: (id: string) => void;
  closeSign: () => void;
  resetCamera: () => void;
  setExtra: (id: string, enabled: boolean) => void;
}

// Fase 6: estado del look final. Los efectos caros (DOF) nacen apagados en móvil;
// el resto se puede desactivar desde el HUD.
export const useStore = create<AppState>((set) => ({
  uiState: 'free',
  selectedPoiId: null,
  routeIndex: 0,
  language: 'es',
  lightMode: 'real',
  manualHour: 22.5,
  effects: {
    dof: !isMobile,
    bloom: true,
    vignette: true,
    fog: true,
    smaa: true,
    shadows: !isMobile,
  },
  dofNear: LIGHTING.dof.near,
  dofFar: LIGHTING.dof.far,
  cameraInfo: null,
  performanceMode: false,
  qualityTier: isMobile ? 'low' : 'high',
  openSignId: null,
  extras: {},
  selectPoi: (id) => set({ selectedPoiId: id, uiState: 'selected' }),
  closePoi: () => set({ selectedPoiId: null, uiState: 'free' }),
  nextPoi: () => set((s) => ({ routeIndex: s.routeIndex + 1 })),
  prevPoi: () => set((s) => ({ routeIndex: s.routeIndex - 1 })),
  setLanguage: (language) => set({ language }),
  setLightMode: (lightMode) => set({ lightMode }),
  setManualHour: (manualHour) => set({ manualHour, lightMode: 'manual' }),
  setEffect: (id, enabled) =>
    set((s) => ({ effects: { ...s.effects, [id]: enabled } })),
  setDofNear: (value) =>
    set((s) => ({ dofNear: Math.max(20, Math.min(value, s.dofFar - 10)) })),
  setDofFar: (value) => set((s) => ({ dofFar: Math.max(value, s.dofNear + 10) })),
  setCameraInfo: (cameraInfo) => set({ cameraInfo }),
  setPerformanceMode: (performanceMode) => set({ performanceMode }),
  setQualityTier: (qualityTier) => set({ qualityTier }),
  openSign: (id) => set({ openSignId: id }),
  closeSign: () => set({ openSignId: null }),
  resetCamera: () => {},
  setExtra: (id, enabled) => set((s) => ({ extras: { ...s.extras, [id]: enabled } })),
}));
