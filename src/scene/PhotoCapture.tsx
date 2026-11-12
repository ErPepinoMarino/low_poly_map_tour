import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '../store/useStore';

const WATERMARK_TEXT =
  'ALMENARA · MAPA 3D · erpepinomarino.github.io/low_poly_map_tour';

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo generar la imagen'));
    }, 'image/png');
  });
}

async function decodeImage(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(blob);
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function addWatermark(source: Blob, sourceWidth: number, sourceHeight: number) {
  const canvas = document.createElement('canvas');
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo crear el lienzo de la foto');

  return decodeImage(source).then((image) => {
    context.drawImage(image, 0, 0, sourceWidth, sourceHeight);
    if ('close' in image) image.close();

    const pad = Math.max(10, Math.round(sourceHeight * 0.025));
    const fontSize = Math.max(9, Math.min(20, Math.round(sourceWidth * 0.011)));
    context.textAlign = 'right';
    context.textBaseline = 'bottom';
    context.shadowColor = 'rgba(0, 0, 0, 0.28)';
    context.shadowBlur = Math.max(1, Math.round(fontSize * 0.25));
    context.fillStyle = 'rgba(255, 249, 238, 0.5)';
    context.font = `500 ${fontSize}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
    context.fillText(WATERMARK_TEXT, sourceWidth - pad, sourceHeight - pad);

    return toBlob(canvas);
  });
}

export default function PhotoCapture() {
  const gl = useThree((state) => state.gl);
  const photoRequest = useStore((state) => state.photoRequest);
  const setPhoto = useStore((state) => state.setPhoto);
  const lastRequest = useRef(0);
  const captureRequested = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    if (photoRequest <= lastRequest.current) return;
    lastRequest.current = photoRequest;
    captureRequested.current = true;
  }, [photoRequest]);

  useFrame(() => {
    if (!captureRequested.current || busy.current) return;
    captureRequested.current = false;
    busy.current = true;

    const canvas = gl.domElement;
    toBlob(canvas)
      .then((source) =>
        addWatermark(source, canvas.width, canvas.height).then((watermarked) => {
          const fileName = `almenara-${new Date().toISOString().slice(0, 10)}.png`;
          setPhoto({
            blob: watermarked,
            url: URL.createObjectURL(watermarked),
            fileName,
            width: canvas.width,
            height: canvas.height,
          });
        }),
      )
      .catch((error: unknown) => {
        console.error('[photo] No se pudo capturar la escena', error);
      })
      .finally(() => {
        busy.current = false;
      });
  });

  return null;
}
