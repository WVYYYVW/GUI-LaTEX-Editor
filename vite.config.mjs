import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: r('./src/renderer'),
  base: './',
  publicDir: r('./src/renderer/public'),
  build: {
    outDir: r('./dist/renderer'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
  server: { port: 5183, strictPort: false },
});
