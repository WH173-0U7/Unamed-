import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the build works from any static host (or packaged as a mobile app).
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
});
