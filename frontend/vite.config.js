import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/search': 'http://localhost:8000', '/history': 'http://localhost:8000', '/static': 'http://localhost:8000', '/url_response': 'http://localhost:8000', '/url_pending': 'http://localhost:8000', '/providers': 'http://localhost:8000' } }
})
