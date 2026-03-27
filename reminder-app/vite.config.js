import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 确保 Live2D 模型文件被正确复制
    assetsInlineLimit: 0,
    // 多页面配置
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        pet: resolve(__dirname, 'pet.html')
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
