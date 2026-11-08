import type { WebGLRenderer } from 'three';

// El shadow map direccional no depende de la cámara. Lo actualizamos a mano
// cuando cambia el sol, el tamaño del mapa o termina de cargar la escena.
export function disableShadowMapAutoUpdate(renderer: WebGLRenderer) {
  renderer.shadowMap.autoUpdate = false;
}

export function markShadowMapDirty(renderer: WebGLRenderer) {
  renderer.shadowMap.needsUpdate = true;
}
