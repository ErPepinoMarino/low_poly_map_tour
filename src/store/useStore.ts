import { create } from 'zustand';
import { getPoi, POIS } from '../data/pois';
import { LIGHTING } from '../data/scene-config';
import { detectAppLanguage } from '../lib/appLanguage';

export type UiState = 'free' | 'selected';
export type LightMode = 'real' | 'day' | 'night' | 'manual';
export type QualityTier = 'low' | 'high';
export type EffectId = 'dof' | 'bloom' | 'vignette' | 'fog' | 'smaa' | 'shadows' | 'clouds';
export type PoiNavigationSource = 'map' | 'panel' | 'next' | 'prev' | 'deep';

export interface CameraFlightRequest {
  id: number;
  poiId: string;
  position: [number, number, number];
  target: [number, number, number];
  duration: number;
  pauseMs: number;
  openPanelOnArrival: boolean;
}

export interface CameraInfo {
  position: [number, number, number];
  rotation: [number, number, number];
  target: [number, number, number];
  distance: number; // distancia al target de OrbitControls (órbita)
  centerDistance: number; // distancia al centro del diorama, usada por el DOF
  polar: number;
  azimuth: number;
  terrainHeight: number | null;
  terrainInside: boolean;
  clearance: number | null;
}

export interface SceneStats {
  meshes: number;
  triangles: number;
  geometries: number;
  materials: number;
  textures: number;
  drawCalls: number;
}

export interface PhotoShot {
  blob: Blob;
  url: string;
  fileName: string;
}

const isMobile =
  typeof window !== 'undefined' &&
  (window.matchMedia('(max-width: 768px)').matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));

interface AppState {
  uiState: UiState;
  selectedPoiId: string | null;
  hoveredPoiId: string | null;
  routeIndex: number;
  poiPanelOpen: boolean;
  cameraFlightRequest: CameraFlightRequest | null;
  cameraFlightSerial: number;
  language: string;
  lightMode: LightMode;
  manualHour: number;
  effects: Record<EffectId, boolean>;
  dofNear: number;
  dofFar: number;
  dofActive: boolean;
  showDofGuide: boolean;
  showCameraGizmo: boolean;
  cameraInfo: CameraInfo | null;
  sceneStats: SceneStats | null;
  fps: number;
  cameraResetRequest: number;
  performanceMode: boolean;
  qualityTier: QualityTier;
  openSignId: string | null;
  extras: Record<string, boolean>;
  photoRequest: number;
  photo: PhotoShot | null;
  selectPoi: (id: string) => void;
  setHoveredPoiId: (id: string | null) => void;
  navigateToPoi: (id: string, source?: PoiNavigationSource) => void;
  openPoiPanel: () => void;
  closePoiPanel: () => void;
  cancelCameraFlight: () => void;
  setCameraFlightDuration: (id: number, duration: number) => void;
  finishCameraFlight: (id: number) => void;
  closePoi: () => void;
  nextPoi: () => void;
  prevPoi: () => void;
  setLanguage: (lang: string) => void;
  setLightMode: (mode: LightMode) => void;
  setManualHour: (hour: number) => void;
  setEffect: (id: EffectId, enabled: boolean) => void;
  setDofNear: (value: number) => void;
  setDofFar: (value: number) => void;
  setDofActive: (active: boolean) => void;
  setShowDofGuide: (enabled: boolean) => void;
  setShowCameraGizmo: (enabled: boolean) => void;
  setCameraInfo: (info: CameraInfo) => void;
  setSceneStats: (stats: SceneStats) => void;
  setFps: (fps: number) => void;
  setPerformanceMode: (enabled: boolean) => void;
  setQualityTier: (tier: QualityTier) => void;
  openSign: (id: string) => void;
  closeSign: () => void;
  resetCamera: () => void;
  setExtra: (id: string, enabled: boolean) => void;
  requestPhoto: () => void;
  setPhoto: (photo: PhotoShot) => void;
  clearPhoto: () => void;
}

// Valor inicial del request; PoiCamera lo sustituye por la duración calculada
// (3–8 s) en cuanto conoce la pose de salida y la ruta.
const POI_FLIGHT_DURATION = 3;
const POI_PANEL_OPEN_DELAY = 250;

function routeIndexFor(id: string): number {
  const index = POIS.findIndex((poi) => poi.id === id);
  return index >= 0 ? index : 0;
}

function navigationState(
  state: AppState,
  id: string,
  source: PoiNavigationSource,
): Partial<AppState> {
  const poi = getPoi(id);
  if (!poi) return {};

  const fromMap = source === 'map' || source === 'deep';
  const panelOpen = fromMap ? (source === 'deep' ? false : state.poiPanelOpen) : true;
  const hasCamera = Boolean(poi.camera);
  const serial = state.cameraFlightSerial + 1;
  const openPanelOnArrival = fromMap && !panelOpen;

  return {
    selectedPoiId: id,
    routeIndex: routeIndexFor(id),
    uiState: 'selected',
    poiPanelOpen: hasCamera ? panelOpen : true,
    cameraFlightSerial: serial,
    cameraFlightRequest:
      hasCamera && poi.camera
        ? {
            id: serial,
            poiId: id,
            position: poi.camera.position,
            target: poi.camera.target,
            duration: POI_FLIGHT_DURATION,
            pauseMs: POI_PANEL_OPEN_DELAY,
            openPanelOnArrival,
          }
        : null,
  };
}

// Fase 6: estado del look final. DOF y sombras se mantienen activos por defecto
// también en móvil; se pueden desactivar desde el HUD o con modo rendimiento.
export const useStore = create<AppState>((set) => ({
  uiState: 'free',
  selectedPoiId: null,
  hoveredPoiId: null,
  routeIndex: 0,
  poiPanelOpen: false,
  cameraFlightRequest: null,
  cameraFlightSerial: 0,
  language: detectAppLanguage(),
  lightMode: 'real',
  manualHour: 22.5,
  effects: {
    dof: true,
    bloom: true,
    vignette: true,
    fog: true,
    smaa: true,
    shadows: true,
    clouds: true,
  },
  dofNear: LIGHTING.dof.near,
  dofFar: LIGHTING.dof.far,
  dofActive: false,
  showDofGuide: false,
  showCameraGizmo: false,
  cameraInfo: null,
  sceneStats: null,
  fps: 0,
  cameraResetRequest: 0,
  performanceMode: false,
  qualityTier: isMobile ? 'low' : 'high',
  openSignId: null,
  extras: {},
  photoRequest: 0,
  photo: null,
  selectPoi: (id) => set((s) => navigationState(s, id, 'deep')),
  setHoveredPoiId: (hoveredPoiId) => set({ hoveredPoiId }),
  navigateToPoi: (id, source = 'panel') => set((s) => navigationState(s, id, source)),
  openPoiPanel: () =>
    set((s) => {
      const id = s.selectedPoiId ?? POIS[0]?.id;
      if (!id) return { poiPanelOpen: true };
      return {
        poiPanelOpen: true,
        selectedPoiId: id,
        routeIndex: routeIndexFor(id),
        uiState: 'selected',
      };
    }),
  closePoiPanel: () =>
    set((s) => ({
      poiPanelOpen: false,
      uiState: 'free',
      cameraFlightRequest: s.cameraFlightRequest
        ? { ...s.cameraFlightRequest, openPanelOnArrival: false }
        : null,
    })),
  cancelCameraFlight: () => set({ cameraFlightRequest: null }),
  setCameraFlightDuration: (id, duration) =>
    set((s) =>
      s.cameraFlightRequest?.id === id
        ? { cameraFlightRequest: { ...s.cameraFlightRequest, duration } }
        : {},
    ),
  finishCameraFlight: (id) =>
    set((s) => (s.cameraFlightRequest?.id === id ? { cameraFlightRequest: null } : {})),
  closePoi: () =>
    set({
      selectedPoiId: null,
      routeIndex: 0,
      poiPanelOpen: false,
      uiState: 'free',
      cameraFlightRequest: null,
    }),
  nextPoi: () =>
    set((s) => {
      const index = s.selectedPoiId ? routeIndexFor(s.selectedPoiId) : -1;
      const target = POIS[(index + 1 + POIS.length) % POIS.length];
      return target ? navigationState(s, target.id, 'next') : {};
    }),
  prevPoi: () =>
    set((s) => {
      const index = s.selectedPoiId ? routeIndexFor(s.selectedPoiId) : 0;
      const target = POIS[(index - 1 + POIS.length) % POIS.length];
      return target ? navigationState(s, target.id, 'prev') : {};
    }),
  setLanguage: (language) => set({ language }),
  setLightMode: (lightMode) => set({ lightMode }),
  setManualHour: (manualHour) => set({ manualHour, lightMode: 'manual' }),
  setEffect: (id, enabled) => set((s) => ({ effects: { ...s.effects, [id]: enabled } })),
  setDofNear: (value) => set((s) => ({ dofNear: Math.max(20, Math.min(value, s.dofFar - 10)) })),
  setDofFar: (value) => set((s) => ({ dofFar: Math.max(value, s.dofNear + 10) })),
  setDofActive: (dofActive) => set({ dofActive }),
  setShowDofGuide: (showDofGuide) => set({ showDofGuide }),
  setShowCameraGizmo: (showCameraGizmo) => set({ showCameraGizmo }),
  setCameraInfo: (cameraInfo) => set({ cameraInfo }),
  setSceneStats: (sceneStats) => set({ sceneStats }),
  setFps: (fps) => set({ fps }),
  setPerformanceMode: (performanceMode) => set({ performanceMode }),
  setQualityTier: (qualityTier) => set({ qualityTier }),
  openSign: (id) => set({ openSignId: id }),
  closeSign: () => set({ openSignId: null }),
  resetCamera: () =>
    set((state) => ({
      cameraResetRequest: state.cameraResetRequest + 1,
      cameraFlightRequest: null,
    })),
  setExtra: (id, enabled) => set((s) => ({ extras: { ...s.extras, [id]: enabled } })),
  requestPhoto: () => set((s) => ({ photoRequest: s.photoRequest + 1 })),
  setPhoto: (photo) =>
    set((s) => {
      if (s.photo) URL.revokeObjectURL(s.photo.url);
      return { photo };
    }),
  clearPhoto: () =>
    set((s) => {
      if (s.photo) URL.revokeObjectURL(s.photo.url);
      return { photo: null };
    }),
}));
