import { useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface RoutePoint {
  id: number;
  position: [number, number, number];
}

function isShaderMaterial(material: THREE.Material | THREE.Material[] | undefined): boolean {
  if (Array.isArray(material)) {
    return material.some((entry) => entry instanceof THREE.ShaderMaterial);
  }
  return material instanceof THREE.ShaderMaterial;
}

// Helper de desarrollo: activar con ?pickTrain=1.
// Haz clic sobre la vía en orden, de la entrada a la salida.
export default function TrainRoutePicker() {
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const nextId = useRef(1);
  const raycaster = useRef(new THREE.Raycaster());
  const pointer = useRef(new THREE.Vector2());

  useEffect(() => {
    const canvas = gl.domElement;

    const logPoints = (next: RoutePoint[]) => {
      console.info(
        '[train-route]',
        JSON.stringify(
          next.map((point) => point.position),
          null,
          2,
        ),
      );
    };

    const onPointerDown = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(pointer.current, camera);

      const hits = raycaster.current.intersectObjects(scene.children, true);
      const hit = hits.find((intersection) => {
        const object = intersection.object as THREE.Mesh;
        return (
          object.isMesh && !object.userData.trainRouteMarker && !isShaderMaterial(object.material)
        );
      });
      if (!hit) return;

      const position: [number, number, number] = [
        Math.round(hit.point.x * 10) / 10,
        Math.round(hit.point.y * 10) / 10,
        Math.round(hit.point.z * 10) / 10,
      ];
      const point = { id: nextId.current, position };
      nextId.current += 1;
      setPoints((current) => {
        const next = [...current, point];
        logPoints(next);
        return next;
      });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace') return;
      event.preventDefault();
      setPoints((current) => {
        const next = current.slice(0, -1);
        logPoints(next);
        return next;
      });
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    console.info(
      '[train-route] picker activo: haz clic en la vía de entrada a salida. Backspace borra el último punto.',
    );

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [camera, gl, scene]);

  return (
    <>
      {points.map((point) => (
        <group key={point.id} position={point.position}>
          <mesh userData={{ trainRouteMarker: true }} renderOrder={999}>
            <sphereGeometry args={[2.5, 12, 12]} />
            <meshBasicMaterial color="#ffb13b" depthTest={false} toneMapped={false} />
          </mesh>
          <Html center zIndexRange={[60, 40]} style={{ pointerEvents: 'none' }}>
            <div
              style={{
                padding: '2px 6px',
                borderRadius: 4,
                background: 'rgba(17, 19, 21, 0.9)',
                color: '#f4eee4',
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11,
                whiteSpace: 'nowrap',
              }}
            >
              {point.id} · {point.position.join(', ')}
            </div>
          </Html>
        </group>
      ))}
    </>
  );
}
