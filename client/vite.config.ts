import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy code-execution requests to the local Piston container, so the
    // browser talks same-origin (no CORS) during development.
    // Client uses VITE_PISTON_URL=/piston-api to hit this.
    proxy: {
      '/piston-api': {
        target: 'http://localhost:2000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/piston-api/, '/api/v2'),
      },
    },
  },
});
