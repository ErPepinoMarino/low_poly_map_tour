import { useEffect, useMemo, useRef, useState } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
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

const ORB_RADIUS = 10;
const ORB_HEIGHT = 12;
const PANEL_WIDTH = 100;
const PANEL_HEIGHT = 25;
const PANEL_Y = ORB_HEIGHT + ORB_RADIUS + 8 + PANEL_HEIGHT / 2;
const ORB_COLOR = '#ff7a14';
const ORB_HOVER_COLOR = '#ffb24a';

function RoadOrb({ exit }: { exit: RoadExit }) {
  const language = useStore((state) => state.language);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const orbRef = useRef<THREE.Mesh>(null);
  const panelRef = useRef<THREE.Group>(null);
  const reveal = useRef(0.001);
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
    if (orbRef.current) {
      orbRef.current.position.y = ORB_HEIGHT + Math.sin(time * 0.8 + phase) * 0.55;
      orbRef.current.rotation.y += delta * 0.28;
      const pulse = 1 + Math.sin(time * 1.25 + phase) * 0.035;
      orbRef.current.scale.setScalar(pulse);
    }

    if (panelRef.current) {
      reveal.current = THREE.MathUtils.damp(reveal.current, open ? 1 : 0.001, 12, delta);
      panelRef.current.scale.setScalar(reveal.current);
      panelRef.current.position.y = PANEL_Y + Math.sin(time * 0.8 + phase) * 0.35;
      panelRef.current.visible = reveal.current > 0.01;
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
    <group position={exit.position}>
      <mesh ref={orbRef} position={[0, ORB_HEIGHT, 0]}>
        <icosahedronGeometry args={[ORB_RADIUS, 0]} />
        <meshStandardMaterial
          color={hovered || open ? ORB_HOVER_COLOR : ORB_COLOR}
          emissive={ORB_COLOR}
          emissiveIntensity={hovered || open ? 0.7 : 0.28}
          roughness={0.62}
          metalness={0.05}
          flatShading
        />
      </mesh>

      <mesh
        position={[0, ORB_HEIGHT, 0]}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onClick={onClick}
      >
        <sphereGeometry args={[ORB_RADIUS * 1.8, 10, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group ref={panelRef} position={[0, PANEL_Y, 0]} scale={0.001} visible={false}>
        <Billboard>
          <mesh>
            <planeGeometry args={[PANEL_WIDTH, PANEL_HEIGHT]} />
            <meshBasicMaterial
              map={texture}
              side={THREE.DoubleSide}
              transparent
              depthTest
              depthWrite={false}
              toneMapped={false}
              fog
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
