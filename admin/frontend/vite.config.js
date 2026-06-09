import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
    strictPort: true,
    allowedHosts: true,
  },
  resolve: {
    alias: {
      '@admin':      path.resolve(__dirname, './src'),
      '@supervisor': path.resolve(__dirname, '../../supervisor/frontend/src'),
      '@center':     path.resolve(__dirname, '../../center/frontend/src'),
      '@student':    path.resolve(__dirname, '../../student/frontend/src'),
      'react':       path.resolve(__dirname, './node_modules/react'),
      'react-dom':   path.resolve(__dirname, './node_modules/react-dom'),
      'react-router-dom': path.resolve(__dirname, './node_modules/react-router-dom'),
    }
  },
  build: {
    target: 'es2020',
    minify: false,
    cssMinify: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('axios') || id.includes('react-hot-toast')) {
              return 'vendor-ui';
            }
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios'],
  },
})
