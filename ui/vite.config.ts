import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy: the app talks same-origin to the Vite server; /api is forwarded to the local
// claude-kit API (KIT-T131) on 127.0.0.1:4319. Same-origin in dev means CORS never enters the
// picture — the server's CORS allow-list is only the fallback for a direct cross-origin fetch.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4319',
        changeOrigin: true,
      },
    },
  },
});
