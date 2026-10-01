import { createHash } from 'node:crypto'
import { tmpdir, userInfo } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Restricted runners may not expose the OS account lookup. Give those runs an
// isolated cache rather than trusting inherited USERNAME from the host account.
const cacheOwner = (() => {
  try { return userInfo().username }
  catch { return 'isolated-process-' + process.pid }
})()

export default defineConfig(({ command, mode }) => {
  if (command === 'serve' && (mode === 'production' || process.env.NODE_ENV === 'production')) {
    throw new Error('Use the compiled backend production server; Vite dev/preview is disabled in production.');
  }
  return {
  // Sandbox and interactive Windows users must not share generated cache ACLs.
  cacheDir: join(tmpdir(), 'smartlab-vite-' + createHash('sha256')
    .update(import.meta.dirname + ':' + cacheOwner).digest('hex').slice(0, 16)),
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5000,
    allowedHosts: ['localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
  }
})
