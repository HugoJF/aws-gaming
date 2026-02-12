import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const devApiTarget =
  process.env.VITE_DEV_API_PROXY_TARGET ??
  process.env.VITE_API_URL ??
  'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: devApiTarget,
        changeOrigin: true,
      },
      '/health': {
        target: devApiTarget,
        changeOrigin: true,
      },
    },
  },
});
