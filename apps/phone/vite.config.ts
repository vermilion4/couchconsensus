import {defineConfig} from 'vite';
import preact from '@preact/preset-vite';

// Dev: phones open http://<mac-lan-ip>:5173/r/ABCD; API and socket are proxied to the session service.
export default defineConfig({
  plugins: [preact()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': {target: 'ws://localhost:8080', ws: true},
    },
  },
  build: {target: 'es2020', outDir: 'dist', emptyOutDir: true},
});
