import react from '@vitejs/plugin-react'
import { createLogger, defineConfig } from 'vite'

// Configure Vite logger to suppress benign socket aborts/resets
// during page reloads, tab navigation, or WebSocket client disconnects.
const logger = createLogger()
const originalError = logger.error.bind(logger)

const isBenignError = (err: any, msg?: string): boolean => {
  const code = err?.code || ''
  if (['ECONNABORTED', 'ECONNRESET', 'EPIPE', 'ECONNREFUSED'].includes(code)) {
    return true
  }
  if (Array.isArray(err?.errors)) {
    if (err.errors.some((e: any) => ['ECONNABORTED', 'ECONNRESET', 'EPIPE', 'ECONNREFUSED'].includes(e?.code))) {
      return true
    }
  }
  const str = `${msg || ''} ${err?.message || ''}`
  return (
    str.includes('ECONNABORTED') ||
    str.includes('ECONNRESET') ||
    str.includes('ECONNREFUSED') ||
    str.includes('EPIPE') ||
    str.includes('ws proxy socket error') ||
    str.includes('ws proxy error')
  )
}

logger.error = (msg, options) => {
  const err = options?.error as any
  if (isBenignError(err, typeof msg === 'string' ? msg : undefined)) {
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
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err: any) => {
            if (isBenignError(err)) {
              return
            }
            console.error('[vite api proxy error]', err.message || err)
          })
        },
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err: any) => {
            if (isBenignError(err)) {
              return
            }
            console.error('[vite ws proxy error]', err.message || err)
          })
        },
      },
    },
  },
})
