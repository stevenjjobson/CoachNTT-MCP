import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.MCP_UI_PORT || '5173'),
    strictPort: true, // Don't allow port incrementing - fail if port is in use
    host: true, // Listen on all addresses for Docker/WSL
    proxy: {
      '/ws': {
        target: `ws://localhost:${process.env.MCP_WEBSOCKET_PORT || '8080'}`,
        ws: true,
        changeOrigin: true,
      },
    },
  },
})