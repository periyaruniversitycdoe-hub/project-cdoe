import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
    allowedHosts: true,
  },
  resolve: {
    alias: {
      '@admin':      path.resolve(__dirname, './src'),
      '@supervisor': path.resolve(__dirname, '../../supervisor/frontend/src'),
      '@center':     path.resolve(__dirname, '../../center/frontend/src'),
      'react':       path.resolve(__dirname, './node_modules/react'),
      'react-dom':   path.resolve(__dirname, './node_modules/react-dom'),
      'react-router-dom': path.resolve(__dirname, './node_modules/react-router-dom'),
    }
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui':    ['axios', 'react-hot-toast'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios'],
  },
})
