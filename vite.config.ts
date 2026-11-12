import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base para GitHub Pages  /low_poly_map_tour/
export default defineConfig({
  plugins: [react()],
  base: './',
});
