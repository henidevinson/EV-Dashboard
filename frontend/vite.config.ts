import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          // Suppress proxy-level network disconnects
          proxy.on('error', (err) => {
            const code = (err as NodeJS.ErrnoException).code;
            if (code === 'ECONNRESET' || code === 'EPIPE' || code === 'ECONNREFUSED') {
              return;
            }
            console.warn('[vite-proxy] WebSocket error:', err.message);
          });

          // Suppress client-side socket EPIPE when refreshing/closing browser tabs
          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            socket.on('error', (err: any) => {
              if (err.code === 'EPIPE' || err.code === 'ECONNRESET') {
                return;
              }
            });
          });
        },
      },
    },
  },
});
