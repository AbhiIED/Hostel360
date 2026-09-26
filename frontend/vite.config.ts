import react from '@vitejs/plugin-react'
import { createLogger, defineConfig } from 'vite'

// Configure Vite logger to suppress benign socket aborts/resets
// during page reloads, tab navigation, or WebSocket client disconnects.
const logger = createLogger()
const originalError = logger.error.bind(logger)

logger.error = (msg, options) => {
  const err = options?.error as any
  const errCode = err?.code || ''
  const isBenignDisconnect =
    errCode === 'ECONNABORTED' ||
    errCode === 'ECONNRESET' ||
    errCode === 'EPIPE' ||
    (typeof msg === 'string' &&
      (msg.includes('ECONNABORTED') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ws proxy socket error') ||
        msg.includes('ws proxy error')))

  if (isBenignDisconnect) {
    return
  }

  originalError(msg, options)
}

// https://vite.dev/config/
export default defineConfig({
  customLogger: logger,
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
            if (['ECONNABORTED', 'ECONNRESET', 'EPIPE'].includes(err.code)) {
              return
            }
            console.error('[vite ws proxy error]', err.message || err)
          })
        },
      },
    },
  },
})
