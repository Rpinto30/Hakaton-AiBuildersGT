import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// El backend FastAPI corre aparte, en :8000. Reenviar /api desde el servidor de
// Vite evita CORS en desarrollo y deja el código del frontend pidiendo rutas
// relativas, iguales a las que usará en producción.
const API = process.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@resources': fileURLToPath(new URL('./resources', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/health': { target: API, changeOrigin: true },
    },
  },
})
