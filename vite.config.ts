import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa para funcionar en GitHub Pages (subruta /low_poly_map_tour/)
export default defineConfig({
  plugins: [react()],
  base: './',
});
