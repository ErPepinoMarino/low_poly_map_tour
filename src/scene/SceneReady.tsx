import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';

interface SceneReadyProps {
  onReady: () => void;
  onProgress: (progress: number) => void;
}

// Marca la escena como lista después del primer frame y de cargar los assets.
export default function SceneReady({ onProgress, onReady }: SceneReadyProps) {
  const { active, progress } = useProgress();
  const called = useRef(false);
  const lastProgress = useRef(-1);

  useFrame(() => {
    if (progress !== lastProgress.current) {
      lastProgress.current = progress;
      onProgress(progress);
    }

    if (called.current || active || progress < 100) return;
    called.current = true;
    onReady();
  });

  return null;
}
