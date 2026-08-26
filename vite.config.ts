import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: "https://2ikkcnfdpd.execute-api.ap-southeast-1.amazonaws.com",
        changeOrigin: true,
        secure: true,
        rewrite: p => p.replace(/^\/api/, '/develop')
      }
    }
  }
})
