import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from project root (one level up from frontend/)
  const env = loadEnv(mode, '..', '')

  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Only expose in development, empty string in production
      __DEV_API_KEY__: mode === 'development'
        ? JSON.stringify(env.GOOGLE_API_KEY || '')
        : JSON.stringify('')
    }
  }
})
