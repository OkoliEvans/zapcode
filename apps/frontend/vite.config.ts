import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: ['@cartridge/controller'],
    },
  },
  optimizeDeps: {
    exclude: ['@cartridge/controller'],
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
})