# Almenara · Mapa turístico 3D low-poly

Diorama interactivo low-poly del pueblo de **Almenara (Castellón)**, navegable en navegador y móvil.

## Características

- Escena 3D low-poly navegable (órbita, zoom y rotación con límites)
- Puntos de interés interactuables con ficha informativa
- Ciclo día/noche y efecto maqueta (profundidad de campo)
- Disponible en español e inglés
- Desplegado en GitHub Pages

## Tecnologías

Three.js · React (`@react-three/fiber`) · Vite · TypeScript · Zustand · i18next

## Desarrollo

```bash
npm install        # instalar dependencias
npm run dev        # servidor de desarrollo
npm run build      # build de producción
npm run preview    # previsualizar el build
npm run lint       # ESLint
npm run format     # Prettier
```

### Datos del terreno

```bash
npm run fetch:dem      # descargar elevación (MDT05, 5 m) del CNIG
npm run build:terrain  # hornear el terreno low-poly (public/models/terrain.glb)
```
