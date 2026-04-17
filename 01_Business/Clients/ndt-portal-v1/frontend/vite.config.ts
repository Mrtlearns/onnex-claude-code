/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../dist'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Allows frontend tests to import real API pure functions without mirroring.
      // Usage: import { keywordDetectTypes } from '@ndtv1/api/lib/ndt-classify'
      '@ndtv1/api': path.resolve(__dirname, '../api/src'),
    },
  },
  server: {
    proxy: {
      '/api/msg': 'http://localhost:8000',
      // In Docker: Traefik at 8888 strips /api → routes to API at 3100
      // Local dev: proxy directly to API (started manually with ANTHROPIC_API_KEY), strip /api prefix
      // Current local API port: 3105 (start with: bash /tmp/start-api.sh)
      '/api': {
        target: 'http://localhost:3105',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'e2e'],
  },
})
