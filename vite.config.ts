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
        target: "https://vpce-022addb9cb8f25e46-r91kb8z0.execute-api.us-east-1.vpce.amazonaws.com",
        changeOrigin: true,
        secure: true,
        rewrite: p => p.replace(/^\/api/, '/develop'),
        headers: {'x-apigw-api-id': "k87zzd1udb"}
      }
    }
  }
})
