import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store/useStore';

interface OrbitControlsLike {
  target: THREE.Vector3;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

interface FlightStart {
  id: number;
  position: THREE.Vector3;
  target: THREE.Vector3;
  elapsed: number;
}

const targetPosition = new THREE.Vector3();
const targetLookAt = new THREE.Vector3();

// Vuelo de cámara cancelable hacia los encuadres de POI. El panel y la cámara
// son independientes: este componente solo ejecuta la petición del store.
export default function PoiCamera() {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as OrbitControlsLike | null;
  const request = useStore((state) => state.cameraFlightRequest);
  const requestId = request?.id;
  const start = useRef<FlightStart | null>(null);
  const panelTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => useStore.getState().cancelCameraFlight();
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [controls]);

  useEffect(() => {
    if (requestId === undefined || !controls) return;

    if (panelTimer.current !== null) {
      window.clearTimeout(panelTimer.current);
      panelTimer.current = null;
    }

    start.current = {
      id: requestId,
      position: camera.position.clone(),
      target: controls.target.clone(),
      elapsed: 0,
    };
  }, [requestId, camera, controls]);

  useEffect(
    () => () => {
      if (panelTimer.current !== null) window.clearTimeout(panelTimer.current);
    },
    [],
  );

  useFrame((_, delta) => {
    const active = useStore.getState().cameraFlightRequest;
    const flight = start.current;
    if (!active || !flight || flight.id !== active.id) return;

    flight.elapsed += delta;
    const progress = Math.min(1, flight.elapsed / active.duration);
    const eased = progress * progress * (3 - 2 * progress);

    if (!controls) return;

    targetPosition.set(...active.position);
    targetLookAt.set(...active.target);
    camera.position.lerpVectors(flight.position, targetPosition, eased);
    controls.target.lerpVectors(flight.target, targetLookAt, eased);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();

    if (progress < 1) return;

    start.current = null;
    const shouldOpenPanel = active.openPanelOnArrival;
    const completedId = active.id;
    const completedPoiId = active.poiId;
    const pauseMs = active.pauseMs;
    useStore.getState().finishCameraFlight(completedId);

    if (shouldOpenPanel) {
      panelTimer.current = window.setTimeout(() => {
        panelTimer.current = null;
        const state = useStore.getState();
        if (state.selectedPoiId === completedPoiId && !state.poiPanelOpen) {
          state.openPoiPanel();
        }
      }, pauseMs);
    }
  });

  return null;
}
