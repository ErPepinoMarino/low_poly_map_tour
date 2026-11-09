import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  createCameraFlightPlan,
  getCameraFlightProgress,
  sampleCameraFlightPosition,
  sampleCameraFlightQuaternion,
  type CameraFlightPlan,
} from '../lib/cameraFlight';
import { useStore } from '../store/useStore';

interface OrbitControlsLike {
  target: THREE.Vector3;
  update: () => void;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

interface FlightStart {
  id: number;
  plan: CameraFlightPlan;
  elapsed: number;
  lookDistance: number;
}

const flightPosition = new THREE.Vector3();
const flightQuaternion = new THREE.Quaternion();
const forward = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

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

    const request = useStore.getState().cameraFlightRequest;
    if (!request || request.id !== requestId) return;

    const plan = createCameraFlightPlan({
      startPosition: camera.position,
      startQuaternion: camera.quaternion,
      endPosition: new THREE.Vector3(...request.position),
      endTarget: new THREE.Vector3(...request.target),
      up: camera.up,
    });
    start.current = {
      id: requestId,
      plan,
      elapsed: 0,
      lookDistance: Math.max(20, camera.position.distanceTo(controls.target)),
    };

    if (Math.abs(plan.duration - request.duration) > 0.001) {
      useStore.getState().setCameraFlightDuration(requestId, plan.duration);
    }
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
    if (!active || !flight || flight.id !== active.id || !controls) return;

    flight.elapsed += delta;
    const progress = getCameraFlightProgress(flight.elapsed, flight.plan);

    sampleCameraFlightPosition(flight.plan, progress, flightPosition);
    sampleCameraFlightQuaternion(flight.plan, progress, flightQuaternion);
    camera.position.copy(flightPosition);
    camera.quaternion.copy(flightQuaternion);

    // Mantener el target de OrbitControls delante de la cámara mientras dura
    // el vuelo. Así, si el usuario interrumpe con el ratón, la órbita continúa
    // desde la orientación actual sin un salto de cámara.
    forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    lookTarget.copy(camera.position).addScaledVector(forward, flight.lookDistance);
    controls.target.copy(lookTarget);
    camera.updateMatrixWorld();

    if (flight.elapsed < flight.plan.duration) return;

    camera.position.copy(flight.plan.endPosition);
    camera.quaternion.copy(flight.plan.endQuaternion);
    controls.target.copy(flight.plan.endTarget);
    controls.update();
    camera.updateMatrixWorld();

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
