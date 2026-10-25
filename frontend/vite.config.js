import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies /api to the backend so cookies stay same-origin.
// In dev, the proxy target is configurable via VITE_DEV_API_TARGET.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_TARGET || 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
    // Production build output.
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
    },
    // `vite preview` inside a container needs to bind all interfaces.
    preview: {
      host: true,
      port: 4173,
    },
  };
});
