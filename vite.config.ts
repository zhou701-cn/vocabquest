import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import sourceIdentifierPlugin from 'vite-plugin-source-identifier'

const isProd = process.env.BUILD_MODE === 'prod'
export default defineConfig({
  plugins: [
    react(), 
    sourceIdentifierPlugin({
      enabled: !isProd,
      attributePrefix: 'data-matrix',
      includeProps: true,
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
    watch: {
      // 轮询检测文件变化：避免部分文件系统上 fs 事件丢失，
      // 导致修改代码后 HMR / 页面刷新仍显示旧代码（需重启才生效）的问题
      usePolling: true,
      interval: 200,
    },
  },
})

