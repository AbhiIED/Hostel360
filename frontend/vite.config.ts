import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err: any) => {
            // Suppress benign connection aborts during page reloads or tab closures
            if (['ECONNABORTED', 'ECONNRESET', 'EPIPE'].includes(err.code)) {
              return;
            }
            console.error('[vite ws proxy error]', err.message || err);
          });
        },
      },
    },
  },
})
