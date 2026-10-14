import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { pdfjsAssets } from './scripts/vite-pdfjs-assets'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), pdfjsAssets()],
  build: {
    // Vite 8 defaults to baseline-widely-available (safari16.4+), which
    // requires macOS 13+. Tauri on macOS 12 uses Safari 15 WebView.
    target: ['es2021', 'safari15'],
    chunkSizeWarningLimit: 2200,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'INEFFECTIVE_DYNAMIC_IMPORT') return
        warn(warning)
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
    // Browser/H5 dev access (e.g. http://<lan-ip>:7788): proxy the server's
    // surface onto this origin so the renderer's same-origin server URL works
    // and the H5 connect page's /health probe answers with real JSON. WS paths
    // must bypass http-proxy's WS downgrade (ws: true).
    proxy: process.env.VITE_DEV_SERVER_PROXY
      ? {
          '/health': { target: 'http://127.0.0.1:3456', changeOrigin: true },
          '/api': { target: 'http://127.0.0.1:3456', changeOrigin: true },
          '/proxy': { target: 'http://127.0.0.1:3456', changeOrigin: true },
          '/ws': { target: 'ws://127.0.0.1:3456', ws: true },
          '/sdk': { target: 'ws://127.0.0.1:3456', ws: true },
          '/preview-fs': { target: 'http://127.0.0.1:3456', changeOrigin: true },
          '/local-file': { target: 'http://127.0.0.1:3456', changeOrigin: true },
        }
      : undefined,
  },
})
