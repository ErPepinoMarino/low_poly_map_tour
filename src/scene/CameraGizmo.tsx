import { useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { DIORAMA_CENTER } from '../data/scene-config';
import { useStore } from '../store/useStore';

interface OrbitControlsLike {
  target: THREE.Vector3;
}

const ORIGIN = new THREE.Vector3(...DIORAMA_CENTER);
const ORIGIN_AXIS_LENGTH = 55;

// Gizmo de depuración: pelota en el target de OrbitControls y ejes en (0,0,0).
// Se activa desde Info técnica y no entra en las estadísticas de la escena.
export default function CameraGizmo() {
  const { t } = useTranslation();
  const show = useStore((state) => state.showCameraGizmo);
  const controls = useThree((state) => state.controls) as unknown as OrbitControlsLike | null;
  const camera = useThree((state) => state.camera);
  const targetGroup = useRef<THREE.Group>(null);
  const targetBall = useRef<THREE.Group>(null);

  const originAxes = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          -ORIGIN_AXIS_LENGTH,
          0,
          0,
          ORIGIN_AXIS_LENGTH,
          0,
          0,
          0,
          -ORIGIN_AXIS_LENGTH,
          0,
          0,
          ORIGIN_AXIS_LENGTH,
          0,
          0,
          0,
          -ORIGIN_AXIS_LENGTH,
          0,
          0,
          ORIGIN_AXIS_LENGTH,
        ],
        3,
      ),
    );
    return geometry;
  }, []);

  useFrame(() => {
    const target = controls?.target;
    const group = targetGroup.current;
    if (!group || !target) return;
    group.position.copy(target);

    // Tamaño angular aproximadamente constante para que la pelota se vea
    // tanto en una vista general como en un primer plano.
    const distance = camera.position.distanceTo(target);
    const scale = THREE.MathUtils.clamp(distance * 0.015, 1.5, 40);
    targetBall.current?.scale.setScalar(scale);
  });

  if (!show) return null;

  return (
    <group>
      <group ref={targetGroup}>
        <group ref={targetBall}>
          <mesh renderOrder={1001} frustumCulled={false} userData={{ excludeFromSceneStats: true }}>
            <sphereGeometry args={[1, 20, 14]} />
            <meshBasicMaterial
              color="#49e3d0"
              transparent
              opacity={0.28}
              depthTest={false}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh renderOrder={1002} frustumCulled={false} userData={{ excludeFromSceneStats: true }}>
            <sphereGeometry args={[1, 20, 14]} />
            <meshBasicMaterial
              color="#49e3d0"
              wireframe
              transparent
              opacity={0.9}
              depthTest={false}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
        <Html center zIndexRange={[40, 0]}>
          <div
            className="camera-gizmo-label"
            style={{
              borderColor: '#49e3d0',
              color: '#49e3d0',
              transform: 'translateY(-26px)',
            }}
          >
            {t('hud.gizmoTarget')}
          </div>
        </Html>
      </group>

      <group position={ORIGIN}>
        <mesh renderOrder={1001} frustumCulled={false} userData={{ excludeFromSceneStats: true }}>
          <sphereGeometry args={[5, 12, 8]} />
          <meshBasicMaterial
            color="#E0A23C"
            transparent
            opacity={0.55}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <lineSegments
          geometry={originAxes}
          renderOrder={1002}
          frustumCulled={false}
          userData={{ excludeFromSceneStats: true }}
        >
          <lineBasicMaterial
            color="#E0A23C"
            transparent
            opacity={0.9}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </lineSegments>
        <Html center zIndexRange={[40, 0]}>
          <div
            className="camera-gizmo-label"
            style={{
              borderColor: '#E0A23C',
              color: '#E0A23C',
              transform: 'translateY(26px)',
            }}
          >
            {t('hud.gizmoOrigin')}
          </div>
        </Html>
      </group>
    </group>
  );
}
