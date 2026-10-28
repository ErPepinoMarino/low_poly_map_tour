import type { ComponentType } from 'react';

// Fase 1: stub del sistema de extras (modular y desactivable).
// La Fase 7 solo añade contenido (nubes, coches, tren, pájaros) vía registerExtra.
export interface Extra {
  id: string;
  component: ComponentType;
  defaultEnabled: boolean;
  cost: 'low' | 'medium' | 'high';
}

const registry = new Map<string, Extra>();

export function registerExtra(extra: Extra): void {
  registry.set(extra.id, extra);
}

export function getExtras(): Extra[] {
  return [...registry.values()];
}
