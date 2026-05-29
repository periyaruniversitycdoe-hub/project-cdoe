import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    port: 5174
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
  }
})
