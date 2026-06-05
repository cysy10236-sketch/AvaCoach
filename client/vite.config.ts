import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { avatarkitVitePlugin } from '@spatius/avatarkit/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), avatarkitVitePlugin()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
