import { useEffect, useMemo, useRef, useState } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { ROAD_EXITS, type RoadExit } from '../data/road-exits';
import { useStore } from '../store/useStore';

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function createSignTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);

  context.clearRect(0, 0, canvas.width, canvas.height);
  roundedRect(context, 12, 12, canvas.width - 24, canvas.height - 24, 24);
  context.fillStyle = 'rgba(17, 19, 21, 0.86)';
  context.fill();
  context.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  context.lineWidth = 3;
  context.stroke();

  context.fillStyle = '#d5a246';
  context.fillRect(34, 58, 5, canvas.height - 116);

  const label = `→ ${text}`;
  let fontSize = 78;
  context.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
  while (fontSize > 34 && context.measureText(label).width > canvas.width - 120) {
    fontSize -= 3;
    context.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
  }

  context.fillStyle = '#f4eee4';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillText(label, 68, canvas.height / 2 + 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Tamaño del orbe en píxeles, independiente de la distancia.
const ORB_SCREEN_PX = 26;
// El panel tiene escala propia: no crece con el orbe.
const PANEL_SCREEN_WIDTH_PX = 120;
const ORB_RADIUS = 7;
const PANEL_WIDTH = 30;
const PANEL_HEIGHT = 7.5;
const ORB_COLOR = '#ff7a14';
const ORB_HOVER_COLOR = '#ffb24a';

function RoadOrb({ exit }: { exit: RoadExit }) {
  const language = useStore((state) => state.language);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const signRef = useRef<THREE.Group>(null);
  const orbRef = useRef<THREE.Mesh>(null);
  const hitboxRef = useRef<THREE.Mesh>(null);
  const panelRef = useRef<THREE.Group>(null);
  const panelReveal = useRef(0.001);
  const camera = useThree((state) => state.camera);
  const viewport = useThree((state) => state.size);
  const label = language === 'en' ? exit.label.en : exit.label.es;
  const texture = useMemo(() => createSignTexture(label), [label]);
  const phase = useMemo(
    () => (exit.position[0] * 0.011 + exit.position[2] * 0.017) % (Math.PI * 2),
    [exit.position],
  );

  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(
    () => () => {
      document.body.style.cursor = '';
    },
    [],
  );

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    const distance = Math.max(
      1,
      camera.position.distanceTo(signRef.current?.position ?? camera.position),
    );
    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 45;
    const visibleHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(fov * 0.5));
    const pixelsPerUnit = viewport.height / Math.max(1, visibleHeight);
    const orbScale = ORB_SCREEN_PX / (ORB_RADIUS * 2) / Math.max(0.0001, pixelsPerUnit);
    const panelScale =
      Math.min(PANEL_SCREEN_WIDTH_PX, viewport.width * 0.8) /
      PANEL_WIDTH /
      Math.max(0.0001, pixelsPerUnit);
    const orbRadiusWorld = ORB_RADIUS * orbScale;
    const orbCenterY = orbRadiusWorld + 2 + Math.sin(time * 0.8 + phase) * 0.55 * orbScale;

    if (orbRef.current) {
      orbRef.current.position.y = orbCenterY;
      orbRef.current.rotation.y += delta * 0.28;
      const pulse = 1 + Math.sin(time * 1.25 + phase) * 0.035;
      orbRef.current.scale.setScalar(orbScale * pulse);
    }

    if (hitboxRef.current) {
      hitboxRef.current.position.y = orbCenterY;
      hitboxRef.current.scale.setScalar(orbScale);
    }

    if (panelRef.current) {
      panelReveal.current = THREE.MathUtils.damp(panelReveal.current, open ? 1 : 0.001, 12, delta);
      panelRef.current.scale.setScalar(panelScale * panelReveal.current);
      panelRef.current.position.y =
        orbCenterY + orbRadiusWorld + 2 + (PANEL_HEIGHT * panelScale) / 2;
      panelRef.current.visible = panelReveal.current > 0.01;
    }
  });

  const onPointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };
  const onPointerOut = () => {
    setHovered(false);
    document.body.style.cursor = '';
  };
  const onClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 4) return;
    event.stopPropagation();
    setOpen((value) => !value);
  };

  return (
    <group ref={signRef} position={exit.position}>
      <mesh ref={orbRef} position={[0, ORB_RADIUS, 0]}>
        <icosahedronGeometry args={[ORB_RADIUS, 0]} />
        <meshStandardMaterial
          color={hovered || open ? ORB_HOVER_COLOR : ORB_COLOR}
          emissive={ORB_COLOR}
          emissiveIntensity={hovered || open ? 0.7 : 0.28}
          roughness={0.62}
          metalness={0.05}
          flatShading
          fog={false}
        />
      </mesh>

      {/* Zona de interacción más cómoda, sobre todo en móvil. */}
      <mesh
        ref={hitboxRef}
        position={[0, ORB_RADIUS, 0]}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onClick={onClick}
      >
        <sphereGeometry args={[ORB_RADIUS * 1.9, 10, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group ref={panelRef} position={[0, 20, 0]} scale={0.001} visible={false}>
        <Billboard>
          <mesh renderOrder={999}>
            <planeGeometry args={[PANEL_WIDTH, PANEL_HEIGHT]} />
            <meshBasicMaterial
              map={texture}
              side={THREE.DoubleSide}
              transparent
              toneMapped={false}
              fog={false}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
        </Billboard>
      </group>
    </group>
  );
}

export default function RoadSigns() {
  return (
    <>
      {ROAD_EXITS.map((exit) => (
        <RoadOrb key={exit.id} exit={exit} />
      ))}
    </>
  );
}
