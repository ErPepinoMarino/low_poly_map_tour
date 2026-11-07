import type { Object3D } from 'three';
import { setupRoadMaterials } from './roadMaterials';
import { setupHouseMaterials } from './houseMaterials';
import { setupWindowMaterials } from './windowMaterials';

// Aplica a CUALQUIER escena los materiales conocidos por nombre.
//
// En glTF no se puede compartir un material entre dos archivos distintos, pero sí
// el criterio por nombre: un material llamado "Calle" o "Jardin" recibe la misma
// configuración procedural venga de streets.glb, houses.glb o de otro modelo.
// Así se "reciclan" las texturas sin duplicar código ni tocar la geometría.
export function setupNamedMaterials(scene: Object3D) {
  setupRoadMaterials(scene);
  setupHouseMaterials(scene);
  setupWindowMaterials(scene);
}
