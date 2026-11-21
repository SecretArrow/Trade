import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2021',
    sourcemap: false,
  },
  worker: {
    format: 'es',
  },
});
